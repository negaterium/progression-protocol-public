"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { gameDb as db, withGameTransaction } from "@/lib/server/game-db";
import { getDeveloperUser } from "@/lib/server/admin-auth";
import { extractShadow } from "@/lib/server/shadow-extraction";
import { getAccessibleQuest, assertQuestOpen } from "@/lib/server/quest-access";
import { safeAction } from "@/lib/action-utils";
import { z } from "zod";
import { logTransaction } from "@/lib/server/audit";
import { completeQuest } from "@/lib/server/quest-completion";
import { calculateEliteLimit, calculateStorageLimit } from "@/lib/game-logic/shadow-limits";
import { calculateShadowEffect, getShadowPriorityScore } from "@/lib/game-logic/shadow-data";

// Configuration
const REQUIRED_CLASS = 'Necromancer';

// Cost & Duration Configuration
// [BALANCED] - Increased costs for "Epic" Army Scale
const DELEGATION_CONFIG: Record<string, { cost: number, durationHours: number }> = {
    'E': { cost: 10, durationHours: 1 },    // Was 3
    'D': { cost: 25, durationHours: 2 },    // Was 5
    'C': { cost: 50, durationHours: 4 },    // Was 15
    'B': { cost: 100, durationHours: 8 },   // Was 40
    'A': { cost: 250, durationHours: 12 },  // Was 100
    'S': { cost: 500, durationHours: 24 },  // Was 250
};

// Generic fallback
const DEFAULT_DELEGATION = { cost: 5, durationHours: 2 };

// --- 1. Shadow Extraction Action ---
// (Kept mostly same, but updated limit calculation)
export async function extractShadowAction(input: { bossId?: string, source: 'BOSS' | 'DUNGEON' }) {
    return safeAction(z.object({ bossId: z.string().optional(), source: z.enum(['BOSS', 'DUNGEON']) }), input, async parsed => {
        const user = await getDeveloperUser();
        return extractShadow(user, parsed);
    });
}

// --- 2. Create Shadow Army View ---
export async function getShadowArmyAction() {
    const user = await getAuthenticatedUser();

    // Fetch Boss Shadows
    const shadows = await db.query(`
        SELECT s.*, b.image_url, b.name as boss_name
        FROM shadows s
        LEFT JOIN bosses b ON s.boss_id = b.id
        WHERE s.user_id = $1
        ORDER BY CASE s.rank WHEN 'XX' THEN 1 WHEN 'S+' THEN 2 WHEN 'S' THEN 3 WHEN 'A' THEN 4 ELSE 5 END ASC
    `, [user.id]);

    // Fetch Army Stats
    const profile = await db.queryOne<{ shadow_infantry_count: number, level: number, hunter_class: string, shadow_storage_limit: number }>(
        "SELECT shadow_infantry_count, level, hunter_class, shadow_storage_limit FROM profiles WHERE id = $1",
        [user.id]
    );

    if (profile?.hunter_class !== REQUIRED_CLASS) {
        return { shadows: [], infantryCount: 0, availableInfantry: 0, storageLimit: 0 };
    }

    const level = profile?.level || 1;
    // Use DB limit, fallback to calculation if 0 (migration safety)
    const storageLimit = profile.shadow_storage_limit || calculateStorageLimit(level);
    const totalInfantry = profile?.shadow_infantry_count || 0;

    // Calculate Available Infantry (Total - Assigned)
    const activeAssignments = await db.query<{ total_assigned: string }>(`
        SELECT SUM(shadow_count) as total_assigned
        FROM shadow_assignments
        WHERE user_id = $1 AND expires_at > NOW()
    `, [user.id]);

    const assignedCount = parseInt(activeAssignments.rows[0]?.total_assigned || '0');
    const availableInfantry = Math.max(0, totalInfantry - assignedCount);

    return {
        shadows: shadows.rows,
        infantryCount: totalInfantry,
        availableInfantry: availableInfantry,
        storageLimit: storageLimit
    };
}

// --- 3. Delegation Action (Timeout Based) ---
export async function delegateQuestAction(input: { questId: string }) {
    return safeAction(
        z.object({ questId: z.string() }),
        input,
        async ({ questId }) => {
            const user = await getAuthenticatedUser();
            return withGameTransaction(user.id, async () => {

                // 1. Validate User Class
                const profile = await db.queryOne<{ hunter_class: string }>(
                    "SELECT hunter_class FROM profiles WHERE id = $1",
                    [user.id]
                );

                if (profile?.hunter_class !== REQUIRED_CLASS) {
                    throw new Error("Only Necromancers can delegate to shadows.");
                }

                // 2. Get Quest Details
                const quest = await getAccessibleQuest<{ id: string, difficulty: string, type: string, mana_cost: number, xp_reward: number, frequency: string }>(user.id, questId);
                await assertQuestOpen(user.id, questId);

                if (!quest) throw new Error("Quest not found.");

                // 2. Determine Cost & Duration
                const config = DELEGATION_CONFIG[quest.difficulty || 'E'] || DEFAULT_DELEGATION;
                let durationHours = config.durationHours;
                if (quest.type === 'Daily' || quest.frequency === 'Daily') durationHours = 20; // Allow 1/day cycle with buffer
                else if (quest.frequency === 'Weekly') durationHours = 24 * 6; // 6 days? Or just 24h busy time. Let's say 24h.
                else if (quest.frequency === 'Monthly') durationHours = 24 * 3;

                let cost = config.cost;

                // --- APPLY BERU'S EFFECT ---
                const beru = await db.queryOne<{ level: number, status: string }>(
                    "SELECT level, status FROM shadows WHERE user_id = $1 AND name = 'Ant King (Beru)'",
                    [user.id]
                );

                if (beru && beru.status === 'SUMMONED') {
                    const buffValue = calculateShadowEffect('Ant King (Beru)', beru.level);
                    // Reduce cost and duration by the buff value (percentage) - Capped at 90% reduction
                    const multiplier = Math.max(0.1, 1 - (buffValue / 100));
                    cost = Math.max(1, Math.floor(cost * multiplier));
                    durationHours = Math.max(0.1, durationHours * multiplier);
                }
                // --------------------------

                // 3. Check Availability
                const armyData = await getShadowArmyAction();
                if (armyData.availableInfantry < cost) {
                    throw new Error(`Insufficient Shadow Infantry. Need ${cost}, Available ${armyData.availableInfantry}.`);
                }

                // 4. Assign Shadows
                const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);
                await db.query(`
                INSERT INTO shadow_assignments (user_id, quest_id, shadow_count, expires_at)
                VALUES ($1, $2, $3, $4)
            `, [user.id, questId, cost, expiresAt]);

                // Completion and infantry reservation commit together; the mana exception
                // is available only to this server-side, class-checked delegation path.
                const result = await completeQuest(user, questId, { skipManaCost: true });
                await logTransaction(user.id, "SHADOW_DELEGATION", {}, { questId, cost, durationHours });

                revalidatePath('/dashboard');
                return {
                    message: `Delegated to ${cost} Shadows. They will return in ${durationHours}h.`,
                    ...result,
                    bossDamage: result.bossDamage
                };
            });
        }
    );
}

// --- 4. Toggle Summon Status ---
export async function toggleSummonAction(input: { shadowId: string }) {
    return safeAction(
        z.object({ shadowId: z.string() }),
        input,
        async ({ shadowId }) => {
            const user = await getAuthenticatedUser();

            // 1. Validate User Class
            const profile = await db.queryOne<{ hunter_class: string }>(
                "SELECT hunter_class FROM profiles WHERE id = $1",
                [user.id]
            );

            if (profile?.hunter_class !== REQUIRED_CLASS) {
                throw new Error("Only Necromancers can summon shadows.");
            }

            const shadow = await db.queryOne<{ status: string }>(
                "SELECT status FROM shadows WHERE id = $1 AND user_id = $2",
                [shadowId, user.id]
            );

            if (!shadow) throw new Error("Shadow not found.");

            const newStatus = shadow.status === 'SUMMONED' ? 'STORED' : 'SUMMONED';

            // LIMIT CHECK: If trying to SUMMON
            if (newStatus === 'SUMMONED') {
                const profile = await db.queryOne<{ level: number, intelligence: number }>(
                    `SELECT p.level, s.intelligence
                     FROM profiles p
                     JOIN hunter_stats s ON p.id = s.user_id
                     WHERE p.id = $1`,
                    [user.id]
                );

                if (profile) {
                    const limit = calculateEliteLimit(profile.level, profile.intelligence || 0);
                    const currentElites = await db.queryOne<{ count: string }>(
                        "SELECT COUNT(*) as count FROM shadows WHERE user_id = $1 AND boss_id IS NOT NULL AND status = 'SUMMONED'",
                        [user.id]
                    );
                    const activeCount = parseInt(currentElites?.count || '0');

                    if (activeCount >= limit) {
                        throw new Error(`Elite Command Limit Reached (${activeCount}/${limit}). Store another Commander first.`);
                    }
                }
            }

            await db.query("UPDATE shadows SET status = $1 WHERE id = $2", [newStatus, shadowId]);

            revalidatePath('/dashboard');
            return { success: true, status: newStatus };
        }
    );
}

// --- 5. Auto-Allocate Best Elites ---
// Scores all boss shadows by hunter class, stores all, then summons the top N.
export async function autoAllocateElitesAction() {
    const user = await getAuthenticatedUser();

    // 1. Validate class
    const profile = await db.queryOne<{ hunter_class: string; level: number; intelligence: number }>(
        `SELECT p.hunter_class, p.level, s.intelligence
         FROM profiles p
         JOIN hunter_stats s ON p.id = s.user_id
         WHERE p.id = $1`,
        [user.id]
    );

    if (!profile || profile.hunter_class !== 'Necromancer') {
        throw new Error('Only Necromancers can command Elite Shadows.');
    }

    const limit = calculateEliteLimit(profile.level, profile.intelligence || 0);

    // 2. Fetch all boss shadows
    const allShadows = await db.query<{ id: string; name: string; rank: string; level: number; status: string }>(
        `SELECT id, name, rank, level, status FROM shadows WHERE user_id = $1 AND boss_id IS NOT NULL`,
        [user.id]
    );

    if (allShadows.rows.length === 0) {
        return { success: false, error: 'No elite shadows available to allocate.' };
    }

    // 3. Score and sort all shadows by class priority
    const scored = allShadows.rows
        .map(s => ({
            ...s,
            score: getShadowPriorityScore(s.name, s.rank, s.level, profile.hunter_class)
        }))
        .sort((a, b) => b.score - a.score);

    const toSummon = scored.slice(0, limit);
    const toStore = scored.slice(limit);

    // 4. Store all currently summoned
    if (toStore.length > 0) {
        await db.query(
            `UPDATE shadows SET status = 'STORED' WHERE user_id = $1 AND boss_id IS NOT NULL`,
            [user.id]
        );
    }

    // 5. Summon the top-scored ones
    const summonIds = toSummon.map(s => s.id);
    if (summonIds.length > 0) {
        await db.query(
            `UPDATE shadows SET status = 'SUMMONED' WHERE id = ANY($1::uuid[])`,
            [summonIds]
        );
    }

    await logTransaction(user.id, 'AUTO_ALLOCATE_ELITES', {}, {
        limit,
        summoned: toSummon.map(s => s.name),
        stored: toStore.map(s => s.name)
    });

    revalidatePath('/dashboard');
    return {
        success: true,
        summoned: toSummon.map(s => ({ name: s.name, rank: s.rank, score: Math.round(s.score * 10) / 10 })),
        limit
    };
}
