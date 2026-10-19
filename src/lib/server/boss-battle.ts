import { revalidatePath } from "next/cache";
import type { AuthenticatedUser } from "@/lib/auth-utils";
import { gameDb as db, withGameTransaction } from "./game-db";
import { RANK_LEVELS, getBossKeySuffix } from "@/lib/system/rank-constants";
import { calculateBossMaxHP, isPostCap } from "@/lib/system/formula";
import { calculateBossCooldown } from "@/lib/game-logic/boss-cooldowns";
import { BOSS_BALANCE_VERSION } from '@/lib/game-logic/boss-balance-policy';

type BossProgressionRecord = {
    id: string;
    name: string;
    phase?: number | null;
};

/**
 * Keep the server authorization boundary aligned with the Bosses page's
 * player-specific, phase-scoped sequence. Catalog status is global legacy
 * metadata used by developer controls, so it is intentionally not used here.
 */
async function assertBossProgression(
    userId: string,
    boss: BossProgressionRecord,
    userLevel: number,
    requiredLevel: number
) {
    const phase = Number(boss.phase);

    // Older test fixtures and imported records without a phase retain the
    // existing level/key-only behavior. Production catalog rows always have a
    // valid phase because the database schema requires it.
    if (!Number.isInteger(phase) || phase < 1) return;

    // Match the client-side post-cap exception for Phase 5.
    if (userLevel >= 999 && phase === 5) return;

    const previousBoss = await db.queryOne<{ id: string; name: string }>(`
        SELECT id, name
        FROM bosses
        WHERE phase = $1
          AND (
              COALESCE(required_level, 0) < $2
              OR (COALESCE(required_level, 0) = $2 AND name < $3)
              OR (COALESCE(required_level, 0) = $2 AND name = $3 AND id < $4)
          )
        ORDER BY COALESCE(required_level, 0) DESC, name DESC, id DESC
        LIMIT 1
    `, [phase, requiredLevel, boss.name, boss.id]);

    if (!previousBoss) return;

    const previousDefeat = await db.queryOne<{ id: string }>(`
        SELECT id
        FROM active_encounters
        WHERE user_id = $1 AND boss_id = $2 AND status = 'DEFEATED'
        ORDER BY created_at DESC
        LIMIT 1
    `, [userId, previousBoss.id]);

    if (!previousDefeat) {
        throw new Error(`TRIAL LOCKED. Defeat ${previousBoss.name} before challenging ${boss.name}.`);
    }
}

export async function startBossBattle(user: AuthenticatedUser, bossId: string, keyAlreadyValidated = false) {
    return withGameTransaction(user.id, async () => {

        // 1. Fetch Boss Info
        const boss = await db.queryOne<any>("SELECT * FROM bosses WHERE id = $1", [bossId]);

        if (!boss) throw new Error("Boss not found");

        // 2. CHECK LEVEL REQUIREMENT
        const profileRes = await db.queryOne<{ level: number }>("SELECT level FROM profiles WHERE id = $1", [user.id]);
        const userLevel = profileRes?.level || 1;

        let requiredLevel = boss.required_level || 0;
        if (!requiredLevel) {
            const rawRank = (boss.rank as string || 'E').split('-')[0].trim().toUpperCase();
            requiredLevel = RANK_LEVELS[rawRank] || RANK_LEVELS[rawRank.charAt(0)] || 1;
        }

        if (userLevel < requiredLevel) {
            throw new Error(`AUTHORIZED PERSONNEL ONLY. Level ${requiredLevel} required for this sector.`);
        }

        // 3. VALIDATE COMBAT STATUS
        // 2a. Check if already in combat
        const aeRes = await db.queryOne<{ count: string }>(
            "SELECT COUNT(*) as count FROM active_encounters WHERE user_id = $1 AND status = 'ACTIVE'",
            [user.id]
        );
        const count = parseInt(aeRes?.count || '0');

        if (count > 0) {
            console.log('[Boss Battle] BLOCKED: User has', count, 'active encounter(s)');
            throw new Error("ALREADY IN COMBAT. Complete your current dungeon first.");
        }

        // 2c. Enforce the same phase sequence shown by the Bosses page.
        await assertBossProgression(user.id, boss, userLevel, requiredLevel);

        // 2b. Check cooldown (Phases)
        const lastDefeat = await db.queryOne<any>(`
            SELECT created_at FROM active_encounters
            WHERE user_id = $1 AND boss_id = $2 AND status = 'DEFEATED'
            ORDER BY created_at DESC LIMIT 1
        `, [user.id, boss.id]);

        if (lastDefeat) {
            const cooldown = calculateBossCooldown(lastDefeat.created_at, boss.rank);

            if (!cooldown.isReady) {
                throw new Error(`GATE REGENERATING. Time Remaining: ${cooldown.d > 0 ? `${cooldown.d}d ` : ''}${cooldown.h}h ${cooldown.m}m.`);
            }
        }

        // 3. CHECK AND CONSUME KEY
        // EXCEPTION: Igris (Job Change) does not require a key
        // EXCEPTION: Post-Cap Players (Level 999+) do not require keys (Transcendent)
        const isIgris = boss.name.includes("Igris");
        const isPostCapUser = userLevel >= 999;

        if (!keyAlreadyValidated && !isIgris && !isPostCapUser) {
            const requiredKeyStart = getBossKeySuffix(boss.rank);
            const requiredKeyName = `Instant Dungeon Key (${requiredKeyStart})`;

            // Check Inventory
            const keyMeta = await db.queryOne<{ id: string }>("SELECT id FROM items WHERE name = $1", [requiredKeyName]);

            if (!keyMeta) {
                throw new Error(`System Error: Key '${requiredKeyName}' not defined in database.`);
            }

            const userKey = await db.queryOne<{ id: string | number, quantity: number }>(`
                SELECT id, quantity FROM inventory
                WHERE user_id = $1 AND item_id = $2
            `, [user.id, keyMeta.id]);

            if (!userKey || userKey.quantity < 1) {
                throw new Error(`REQUIRED ITEM MISSING: [${requiredKeyName}]`);
            }

            // CONSUME KEY
            if (userKey.quantity === 1) {
                await db.query("DELETE FROM inventory WHERE id = $1", [userKey.id]);
            } else {
                await db.query("UPDATE inventory SET quantity = quantity - 1 WHERE id = $1", [userKey.id]);
            }
        }

        // --- BOSS SCALING LOGIC ---
        const profile = await db.queryOne<{ level: number }>(
            "SELECT level FROM profiles WHERE id = $1", [user.id]
        );
        const playerLevel = profile?.level || 1;
        const playerIsPostCap = isPostCap(playerLevel);

        // Base HP per rank
        // Calibrated against observed Level 132 DPS: ~7,206 per E-rank quest vs B-rank boss.
        // The army passive levelMult cap (1.5x in quests.ts) is the primary balancing lever for
        // endgame S/S+/XX fights. Base HP only needs modest adjustments from original values.
        //
        // Design targets at Level 132 (20 mixed quests/day benchmark):
        //   E-Rank:    instant     (~5k HP)
        //   D-Rank:    few hours   (~28k HP)
        //   C-Rank:    < 1 day     (~47k HP)
        //   B-Rank:    ~1.4 days   (~210k HP)
        //   A-Rank:    ~2 days     (~187k HP)
        //   S-Rank:    ~4 days     (~122k HP, Kamish)
        //   S+:        ~7 days     (~182k HP)
        //   XX:        ~10 days    (~251k HP)
        //   COSMIC:    ~21+ days   (fixed 5M, no scaling)
        const finalMaxHP = calculateBossMaxHP(boss.rank, playerLevel, boss.max_hp || 1000, playerIsPostCap);


        const { rows: newEncounters } = await db.query(`
            INSERT INTO active_encounters (user_id, boss_id, current_hp, max_hp, status, streak_bonus, balance_version, is_first_clear)
            VALUES ($1, $2, $3, $4, 'ACTIVE', 0, $5, $6)
            RETURNING *
        `, [user.id, boss.id, finalMaxHP, finalMaxHP, BOSS_BALANCE_VERSION, !lastDefeat]);

        const newEncounter = newEncounters[0];

        revalidatePath('/dashboard', 'layout');
        revalidatePath('/dashboard/bosses');

        return {
            message: "GATE OPENED. INCURSION STARTED.",
            bossName: boss.name,
            encounter: newEncounter
        };
    });
}
