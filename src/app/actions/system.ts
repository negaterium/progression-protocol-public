"use server";

import { revalidatePath } from "next/cache";
import { getXpRequiredForLevel } from "@/lib/system/leveling";
import { StatsManager } from "@/lib/stats-manager";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { recalculateAndClampPlayerStats } from "@/lib/server/user-stats";
import { logTransaction } from "@/lib/server/audit";
import { gameDb as db, withGameTransaction } from "@/lib/server/game-db";
import { awardXp } from "@/lib/server/xp-rewards";
import { getDeveloperUser } from "@/lib/server/admin-auth";
import { safeAction } from "@/lib/action-utils";
import { z } from "zod";

export async function addXpAction(amount: number) {
    const result = await safeAction(z.number().finite().int(), amount, async value => {
        const user = await getDeveloperUser();
        return awardXp(user.id, value);
    });
    if (!result.success) throw new Error(result.error);
    return result.data!;
}

export async function regenerateManaAction() {
    const user = await getAuthenticatedUser();
    return withGameTransaction(user.id, async () => {

        // 1. Get Profile & Stats
        const [profile, stats, inventoryRows, skillRows] = await Promise.all([
            db.queryOne<any>("SELECT current_hp, current_mana, last_regen_at, level, hunter_class, status_effects, prestige_level FROM profiles WHERE id = $1", [user.id]),
            db.queryOne<any>("SELECT mana, intelligence, crystallized_stats FROM hunter_stats WHERE user_id = $1", [user.id]),
            db.query(`
            SELECT i.effect FROM inventory inv
            JOIN items i ON inv.item_id = i.id
            WHERE inv.user_id = $1 AND inv.equipped = true
        `, [user.id]),
            db.query(`
            SELECT us.*, s.name, s.stat_bonus, s.category, s.max_level
            FROM user_skills us
            JOIN skills s ON us.skill_id = s.id
            WHERE us.user_id = $1 AND us.current_level > 0
        `, [user.id])
        ]);

        if (!profile || !stats) return;

        // Use the shared formulas for Max HP and Max MP caps.
        const hClass = profile.hunter_class || 'NONE';
        const statusEffects = Array.isArray(profile.status_effects) ? profile.status_effects : [];

        // Aggregate Modifiers
        const modifierSources: Record<string, any>[] = [];
        inventoryRows.rows.forEach(r => { if (r.effect) modifierSources.push(r.effect); });
        modifierSources.push(...StatsManager.calculateScaledSkillModifiers(skillRows.rows || [], profile.level || 1));
        const modifiers = StatsManager.aggregateModifiers(modifierSources);

        // Effective INT for Max Mana
        const baseStats = { strength: 10, agility: 10, intelligence: stats.intelligence || 10, vitality: 10, perception: 10 };
        const crystallizedStats = stats.crystallized_stats || {};
        const prestigeLevel = profile.prestige_level || 0;

        const effectiveStats = StatsManager.calculateEffectiveStats(baseStats, modifiers, statusEffects, hClass, crystallizedStats);

        const maxHp = StatsManager.calculateMaxHP(effectiveStats.vitality, effectiveStats.strength, profile.level || 1, modifiers, hClass, prestigeLevel);
        const maxMana = StatsManager.calculateMaxMana(effectiveStats.intelligence, profile.level || 1, modifiers, hClass, prestigeLevel);
        const currentHp = profile.current_hp || 0;
        const currentMana = profile.current_mana || 0;

        if (currentHp >= maxHp && currentMana >= maxMana) return;

        const lastRegen = new Date(profile.last_regen_at);
        const now = new Date();
        const diffMs = now.getTime() - lastRegen.getTime();

        const hoursElapsed = diffMs / (1000 * 60 * 60);
        const { hpPerHour, manaPerHour } = StatsManager.getRegenRates(maxHp, maxMana, hClass, modifiers);
        const hpToAdd = Math.floor(hoursElapsed * hpPerHour);
        const manaToAdd = Math.floor(hoursElapsed * manaPerHour);
        const newHp = Math.min(maxHp, currentHp + hpToAdd);
        const newMana = Math.min(maxMana, currentMana + manaToAdd);

        if (newHp !== currentHp || newMana !== currentMana) {
            await db.query(
                "UPDATE profiles SET current_hp = $1, current_mana = $2, last_regen_at = $3 WHERE id = $4",
                [newHp, newMana, now.toISOString(), user.id]
            );
        }

        revalidatePath("/dashboard", "layout");
    });
}

export async function checkDailyPenalty(userId: string, timezoneOffset?: number) {
    const result = await safeAction(z.object({ userId: z.string().min(1), timezoneOffset: z.number().finite().min(-840).max(840).optional() }),
        { userId, timezoneOffset }, async () => {
            const user = await getAuthenticatedUser();
            if (userId !== user.id) throw new Error("Cannot process another player's penalties.");
            return withGameTransaction(user.id, async () => {
                // 0. TUTORIAL PROTECTION: Skip Level 1 players
                const profile = await db.queryOne<{ level: number, id: string }>("SELECT level, id FROM profiles WHERE id = $1", [userId]);
                const level = profile?.level || 1;

                if (level === 1) {
                    return { status: 'SAFE', reason: 'TUTORIAL_PROTECTION', bossDamage: null, quest: null };
                }

                // 0.5 TRANSACTIONAL LOCK
                // Use an Advisory Lock to prevent Race Conditions (Strict Mode double-mounting)
                // We must execute the check AND the insert within the same transaction lock.
                return await db.transaction(async (client) => {
                    // Hash user ID to integer for lock key (approximate, usually safe enough for this collision-resistant case)
                    // Or simpler: Just take a lock based on a fixed system ID + user hash.
                    // For simplicity in Postgres, we can try to use the numeric part of UUID if possible, but UUID is hex.
                    // Let's use string hashing to int.

                    const hashStr = userId.replace(/-/g, '');
                    const lockId1 = parseInt(hashStr.substring(0, 8), 16) | 0;
                    const lockId2 = parseInt(hashStr.substring(8, 16), 16) | 0;

                    await client.query("SELECT pg_advisory_xact_lock($1, $2)", [lockId1, lockId2]);

                    // 1. Check Yesterday's Activity (Calendar Day relative to User's Timezone)
                    const now = new Date();
                    const offset = timezoneOffset || 0;
                    const offsetMs = offset * 60 * 1000;

                    // Start of Today UTC for User
                    const localMs = now.getTime() - offsetMs;
                    const localDatePseudoUTC = new Date(localMs);
                    const startOfLocalTodayPseudoUTC = new Date(Date.UTC(
                        localDatePseudoUTC.getUTCFullYear(),
                        localDatePseudoUTC.getUTCMonth(),
                        localDatePseudoUTC.getUTCDate()
                    ));
                    const startOfTodayUTC = new Date(startOfLocalTodayPseudoUTC.getTime() + offsetMs);

                    // Start of Yesterday UTC for User
                    const startOfYesterdayUTC = new Date(startOfTodayUTC.getTime() - (24 * 60 * 60 * 1000));
                    const endOfYesterdayUTC = startOfTodayUTC;

                    // --- BOSS DAMAGE CHECK ---
                    let bossDamageDetails = null;
                    const activeBossRes = await client.query(`
            SELECT ae.id, b.name as boss_name
            FROM active_encounters ae
            JOIN bosses b ON ae.boss_id = b.id
            WHERE ae.user_id = $1 AND ae.status = 'ACTIVE'
        `, [userId]);
                    const activeBoss = activeBossRes.rows[0];

                    if (activeBoss) {
                        const damageLogRes = await client.query(`
                SELECT COUNT(*) as count FROM habit_logs
                WHERE user_id = $1
                AND habit_name = 'BOSS_DAMAGE_ONGOING'
                AND completed_at >= $2
            `, [userId, startOfTodayUTC.toISOString()]);
                        const damageLog = damageLogRes.rows[0];

                        if (parseInt(damageLog?.count || '0') === 0) {
                            // APPLY DAMAGE
                            const { maxHp } = await recalculateAndClampPlayerStats(userId);
                            const damage = Math.floor(maxHp * 0.10); // 10%

                            const pRes = await client.query("SELECT current_hp FROM profiles WHERE id = $1", [userId]);
                            const currentHp = pRes.rows[0]?.current_hp || maxHp;

                            let newHp = currentHp - damage;
                            if (newHp < 1) newHp = 1;

                            await client.query("UPDATE profiles SET current_hp = $1 WHERE id = $2", [newHp, userId]);

                            await client.query(`
                    INSERT INTO habit_logs (user_id, habit_name, completed_at)
                    VALUES ($1, 'BOSS_DAMAGE_ONGOING', NOW())
                `, [userId]);

                            bossDamageDetails = { damage, bossName: activeBoss.boss_name, newHp };
                            console.log(`[Daily Boss Damage] User ${userId} took ${damage} dmg from ${activeBoss.boss_name}`);
                        }
                    }

                    const res = await client.query(`
            SELECT COUNT(*) as count FROM habit_logs
            WHERE user_id = $1
            AND completed_at >= $2
            AND completed_at < $3
        `, [userId, startOfYesterdayUTC.toISOString(), endOfYesterdayUTC.toISOString()]);

                    const completedCount = parseInt(res.rows[0]?.count || '0');
                    const DAILY_TARGET = 3;

                    // If Target Met, No Penalty
                    if (completedCount >= DAILY_TARGET) {
                        return { status: 'SAFE', bossDamage: bossDamageDetails, reason: 'TARGET_MET', quest: null };
                    }

                    // 2. PENALTY TRIGGERED
                    // Check for ANY system penalty created TODAY (Active, Expired, OR Complete)
                    const { rows: existingPenaltyData } = await client.query(`
            SELECT q.*, uq.status as user_status
            FROM quests q
            JOIN user_quests uq ON q.id = uq.quest_id
            WHERE uq.user_id = $1
            AND (q.type = 'PENALTY' OR (q.type = 'System' AND q.title ILIKE 'PENALTY%'))
            AND q.created_at >= $2
            LIMIT 1
        `, [userId, startOfTodayUTC.toISOString()]);

                    const existingPenalty = existingPenaltyData[0];

                    if (existingPenalty) {
                        // Penalty already issued today. Check status.
                        if (existingPenalty.user_status === 'Complete') {
                            return { status: 'SAFE', reason: 'PENALTY_COMPLETED', bossDamage: bossDamageDetails };
                        }
                        if (existingPenalty.user_status === 'EXPIRED') {
                            // PHASE 2: PUNISHMENT (HP = 1) - Only if not already punished?
                            // Actually, if it's expired in DB, check if we need to re-punish?
                            // For now, if it's expired, we assume punishment happens or has happened.
                            // Let's ensure punishment is consistent.

                            // Optimization: If they have 1 HP, we assume they are punished.
                            // If they healed up, we punish again?
                            // "Survival" implies you survive. If you fail, you get punished.
                            // Strict Mode: Punishment is 1 HP.
                            await client.query("UPDATE profiles SET current_hp = 1 WHERE id = $1", [userId]);
                            return { status: 'PUNISHED', bossDamage: bossDamageDetails, quest: existingPenalty.title, reason: 'PENALTY_FAILED_PUNISHMENT' };
                        }
                        return { status: 'WARNING', quest: existingPenalty.title, bossDamage: bossDamageDetails };
                    }

                    // PHASE 1: WARNING (HP / 2 + New Quest + MIASMA)

                    // A. Reduce HP and Apply MIASMA
                    const userProfileRes = await client.query(
                        "SELECT current_hp, level, status_effects FROM profiles WHERE id = $1",
                        [userId]
                    );
                    const userProfile = userProfileRes.rows[0];

                    if (userProfile) {
                        // DOUBLE CHECK: Level 1 Safety
                        if ((userProfile.level || 1) === 1) {
                            return { status: 'SAFE', reason: 'TUTORIAL_PROTECTION', bossDamage: bossDamageDetails, quest: null };
                        }

                        const newHp = Math.max(1, Math.floor((userProfile.current_hp || 100) / 2));

                        // Willpower Miasma Resist: 1% per point
                        const statsRes = await client.query("SELECT willpower FROM hunter_stats WHERE user_id = $1", [userId]);
                        const willpowerEqRes = await client.query(`
                SELECT i.effect FROM inventory inv
                JOIN items i ON inv.item_id = i.id
                WHERE inv.user_id = $1 AND inv.equipped = true
            `, [userId]);

                        const willpower = (statsRes.rows[0]?.willpower || 10) + willpowerEqRes.rows.reduce((sum, e) => sum + (e.effect?.willpower || 0), 0);
                        const resistChance = willpower / 100;
                        const resisted = Math.random() < resistChance;

                        const effects = Array.isArray(userProfile.status_effects) ? userProfile.status_effects : [];
                        if (resisted) {
                            console.log(`[Daily Penalty] User ${userId} RESISTED Miasma via Willpower (${Math.floor(resistChance * 100)}% chance)`);
                        } else {
                            // Add Miasma to Status Effects if not already present
                            const hasMiasma = effects.some((e: any) => e.type === 'MIASMA');

                            if (!hasMiasma) {
                                const { STATUS_EFFECT_DEFINITIONS } = await import("@/lib/system/status-effects");

                                // Ensure MIASMA doesn't overlap with massive buffs if desired,
                                // but keep it simple: just add it.
                                effects.push({
                                    ...STATUS_EFFECT_DEFINITIONS.MIASMA,
                                    applied_at: new Date().toISOString()
                                });
                            }
                        }

                        await client.query(
                            "UPDATE profiles SET current_hp = $1, status_effects = $2 WHERE id = $3",
                            [newHp, JSON.stringify(effects), userId]
                        );
                    }

                    // B. Create Penalty Quest
                    const variants = [
                        { title: "PENALTY: Survival (Run)", desc: "Method: Run until your heart stops." },
                        { title: "PENALTY: Survival (Pushups)", desc: "Method: Push the earth away until it accepts your submission." },
                        { title: "PENALTY: Survival (Situps)", desc: "Method: Strengthen the core that failed you." },
                        { title: "PENALTY: Survival (Squats)", desc: "Method: Carry the weight of your failure." },
                        { title: "PENALTY: Survival (Lunges)", desc: "Method: Step forward into the abyss." },
                        { title: "PENALTY: Survival (Burpees)", desc: "Method: Fall and rise until you are worthy." },
                        { title: "PENALTY: Survival (Plank)", desc: "Method: Become as rigged as death itself." },
                        { title: "PENALTY: Survival (Climbing)", desc: "Method: Ascend from your mediocrity." },
                        { title: "PENALTY: Survival (Swimming)", desc: "Method: Drown your weakness." },
                        { title: "PENALTY: Survival (Boxing)", desc: "Method: Fight the shadows within." },
                        { title: "PENALTY: Survival (Walking)", desc: "Method: Walk the path of atonement." },
                        { title: "PENALTY: Survival (Stretching)", desc: "Method: Expand your limits or break." }
                    ];

                    const variant = variants[Math.floor(Math.random() * variants.length)];
                    const fullDescription = `SYSTEM ALERT: Weakened core detected. Penalty issued. Objective: Complete 50 ${variant.title.split('(')[1].replace(')', '')} to restore system stability. Failure will result in severe punishment.`;

                    const newQRes = await client.query(`
            INSERT INTO quests (user_id, title, description, type, difficulty, xp_reward, gold_reward, mana_cost, created_at)
            VALUES ($1, $2, $3, 'PENALTY', 'S', 0, 0, 0, NOW())
            RETURNING id
        `, [userId, variant.title, fullDescription]);

                    const newQuestId = newQRes.rows[0].id;

                    await client.query(`
            INSERT INTO user_quests (user_id, quest_id, status, expires_at)
            VALUES ($1, $2, 'Active', $3)
        `, [userId, newQuestId, new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()]); // 4 hours

                    revalidatePath("/dashboard", "layout");
                    return { status: 'PENALTY_ISSUED', quest: variant.title, bossDamage: bossDamageDetails };
                });
            });
        });
    if (!result.success) throw new Error(result.error);
    return result.data!;
}

// Helper for Seeding
async function seedDefaultQuests(userId: string) {
    const { rows: existingQuests } = await db.query("SELECT id FROM quests WHERE user_id = $1", [userId]);
    if (existingQuests.length > 0) return; // Already has quests

    console.log(`Seeding Default Quests for User: ${userId}`);

    // 1. Daily Quest: Strength Training
    // Helper to insert Definition + State
    const insertQuest = async (title: string, desc: string, diff: string, freq: string, xp: number, gold: number, cost: number, type: string = 'Normal') => {
        const { rows } = await db.query(`
            INSERT INTO quests (user_id, title, description, type, difficulty, xp_reward, gold_reward, frequency, mana_cost)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
        `, [userId, title, desc, type, diff, xp, gold, freq, cost]);

        await db.query(`
            INSERT INTO user_quests (user_id, quest_id, status)
            VALUES ($1, $2, 'Available')
        `, [userId, rows[0].id]);
    };

    await insertQuest(
        "Daily Quest: Strength Training",
        "Goal: [Push-ups: 100], [Sit-ups: 100], [Squats: 100], [Running: 10km].\nWarning: Failure to complete will result in a Penalty Quest.",
        "E", "Daily", 100, 0, 0, "Daily"
    );

    await insertQuest(
        "The First Step",
        "Enter a Dungeon for the first time. (Navigate to 'Zone Select' and enter 'Training Grounds').",
        "E", "Once", 50, 1000, 0
    );

    await insertQuest(
        "Collect Wolf Fangs",
        "Hunt Steel-Fanged Lycans in the E-Rank Dungeon. Collect 10 fangs.",
        "E", "Once", 75, 1500, 10
    );
}

export async function resetSystemAction() {
    const result = await safeAction(z.void(), undefined, async () => {
        const user = await getDeveloperUser();
        return withGameTransaction(user.id, async () => {
            const userId = user.id;

            console.log(`EXECUTING ADMIN RESET for User: ${userId}`);

            await db.query(`
        UPDATE profiles SET
            level = 1, current_xp = 0, next_level_xp = $2, available_sp = 0, available_ap = 0,
            hunter_rank = 'E', hunter_class = null, title = 'The Recruit',
            current_hp = 260, current_mana = 160, gold_credits = 0,
            status_effects = '[]'::jsonb,
            last_permanent_stat_at = null
        WHERE id = $1
    `, [userId, getXpRequiredForLevel(2)]);

            await logTransaction(userId, "SYSTEM_RESET", {}, { source: 'AdminReset' });

            await db.query("DELETE FROM quests WHERE user_id = $1 AND title = 'Class Change: The Trial'", [userId]);
            await db.query("DELETE FROM user_skills WHERE user_id = $1", [userId]);
            await db.query("DELETE FROM user_achievements WHERE user_id = $1", [userId]);
            await db.query("DELETE FROM user_titles WHERE user_id = $1", [userId]);
            await db.query("DELETE FROM inventory WHERE user_id = $1", [userId]);

            await db.query(`
        UPDATE hunter_stats SET
            strength = 10, agility = 10, intelligence = 10, vitality = 10, perception = 10, mana = 160
        WHERE user_id = $1
    `, [userId]);

            // Reset Quests: Remove user states to revert to 'Available' (assuming global templates exist), or just delete user-private quests?
            // Since seedDefaultQuests creates NEW rows, we should probably delete ALL quests belonging to this user?
            // Based on original seed logic, these are private quests.
            await db.query("DELETE FROM quests WHERE user_id = $1", [userId]);
            await db.query("DELETE FROM user_quests WHERE user_id = $1", [userId]); // Cascade should handle this but to be safe

            await db.query("DELETE FROM quest_logs WHERE user_id = $1", [userId]);
            await db.query("DELETE FROM habit_logs WHERE user_id = $1", [userId]);

            // Clear Active Encounters (Fixes "Already in Combat" loop)
            await db.query("DELETE FROM active_encounters WHERE user_id = $1", [userId]);

            // PENALTY PREVENTION: Seed fake 'Yesterday' logs so the user starts with a clean slate
            // Otherwise, if they level up to 2 on Day 1, the system thinks they missed Day 0 dailies.
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yStr = yesterday.toISOString();

            await db.query(`
        INSERT INTO habit_logs (user_id, habit_name, completed_at)
        VALUES
            ($1, 'System Grace Period 1', $2),
            ($1, 'System Grace Period 2', $2),
            ($1, 'System Grace Period 3', $2)
    `, [userId, yStr]);

            // Per-player unlocks reset with the encounter history above.

            // Check and Seed Default Quests
            await seedDefaultQuests(userId);

            revalidatePath("/dashboard", "layout");
            return { success: true };
        });
    });
    if (!result.success) throw new Error(result.error);
    return result.data!;
}

export async function resetQuestsAction() {
    const result = await safeAction(z.void(), undefined, async () => {
        const user = await getDeveloperUser();
        return withGameTransaction(user.id, async () => {
            const userId = user.id;

            console.log(`EXECUTING QUEST RESET for User: ${userId}`);

            // 1. Reset 'System' and 'Main' quests to Available
            // 1. Delete user_quests rows to reset to 'Available'
            await db.query("DELETE FROM user_quests WHERE user_id = $1", [userId]);

            // 2. Delete logs to allow re-completion
            await db.query("DELETE FROM quest_logs WHERE user_id = $1", [userId]);

            // 3. Clear any Penalty quests (Private Definitions)
            await db.query("DELETE FROM quests WHERE user_id = $1 AND type = 'System' AND title ILIKE 'PENALTY%'", [userId]);

            // 4. Seed if missing
            await seedDefaultQuests(userId);

            revalidatePath("/dashboard", "layout");
            return { success: true };
        });
    });
    if (!result.success) throw new Error(result.error);
    return result.data!;
}

export async function failQuestPenaltyAction(questId: string) {
    const user = await getAuthenticatedUser();

    // Mark the quest as FAILED
    // Mark the quest as FAILED in user_quests
    await db.query("UPDATE user_quests SET status = 'Failed' WHERE quest_id = $1 AND user_id = $2", [questId, user.id]);

    // Apply penalty: Reduce HP to 1
    await db.query("UPDATE profiles SET current_hp = 1 WHERE id = $1", [user.id]);

    revalidatePath("/dashboard", "layout");
    return { status: 'PUNISHED' };
}

export async function injectGoldAction(amount: number) {
    const result = await safeAction(z.number().finite().int().nonnegative(), amount, async value => {
        const user = await getDeveloperUser();
        return withGameTransaction(user.id, async () => {
            const balance = await db.queryOne<{ gold_credits: number }>(
                "UPDATE profiles SET gold_credits = gold_credits + $1 WHERE id = $2 RETURNING gold_credits",
                [value, user.id]
            );
            await logTransaction(user.id, "GOLD_INJECT", { gold: value }, { source: 'DevConsole' });
            revalidatePath("/dashboard", "layout");
            return { success: true, newBalance: balance!.gold_credits };
        });
    });
    if (!result.success) throw new Error(result.error);
    return result.data!;
}

export async function injectBulkCompletionsAction(amount: number) {
    const result = await safeAction(z.number().int().min(1).max(1000), amount, async value => {
        const user = await getDeveloperUser();
        return withGameTransaction(user.id, async () => {
            await db.query(`
                INSERT INTO quest_logs (user_id, quest_title, quest_type, difficulty, xp_reward, gold, completed_at)
                SELECT $1, 'Simulated Mission #' || mission::text, 'System', 'E', 0, 0, NOW()
                FROM generate_series(1, $2::integer) AS mission
            `, [user.id, value]);
            revalidatePath('/dashboard', 'layout');
            revalidatePath('/dashboard/profile');
            return { success: true, added: value };
        });
    });
    if (!result.success) throw new Error(result.error);
    return result.data!;
}

/**
 * Fetch fresh profile data for UI updates
 * Used after quest completion to sync HP/Mana changes
 */
export async function refreshProfileAction() {
    const user = await getAuthenticatedUser();

    const profile = await db.queryOne<{
        id: string;
        username: string;
        level: number;
        current_hp: number;
        current_mana: number;
        current_xp: number;
        next_level_xp: number;
        hunter_rank: string;
        hunter_class: string;
        gold_credits: number;
        available_sp: number;
        available_ap: number;
        title: string | null;
        shadow_infantry_count: number;
    }>(
        `SELECT id, username, level, current_hp, current_mana, current_xp, next_level_xp,
                hunter_rank, hunter_class, gold_credits, available_sp, available_ap,
                title, shadow_infantry_count
         FROM profiles WHERE id = $1`,
        [user.id]
    );

    if (!profile) {
        return { success: false, error: "Profile not found" };
    }

    return { success: true, data: profile };
}

/**
 * DEV ONLY: Jump to Level 999 instantly.
 * Requires explicit deployment-controlled developer authorization.
 */
export async function jumpToLevel999Action() {
    const result = await safeAction(z.void(), undefined, async () => {
        const user = await getDeveloperUser();
        return withGameTransaction(user.id, async () => {

            // Use correct Linear Formula
            const xpAt999 = getXpRequiredForLevel(999);
            const xpAt1000 = getXpRequiredForLevel(1000);

            await db.query(
                `UPDATE profiles SET
                    current_xp    = $1,
                    level         = 999,
                    next_level_xp = $2,
                    hunter_rank   = 'S+'
                 WHERE id = $3`,
                [xpAt999, xpAt1000, user.id]
            );

            await logTransaction(user.id, "DEBUG_JUMP_999", { xp: xpAt999 }, { source: 'jumpToLevel999Action', level: 999 });

            revalidatePath("/dashboard", "layout");
            revalidatePath("/dashboard/profile");

            return { success: true, level: 999, xp: xpAt999 };
        });
    });
    if (!result.success) throw new Error(result.error);
    return result.data!;
}

export async function syncOfflineProgressAction(dates: string[]) {
    const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
        const time = Date.parse(`${value}T00:00:00Z`);
        if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) return false;
        const today = new Date().toISOString().slice(0, 10);
        const earliest = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
        return value >= earliest && value < today;
    }, 'Offline sync dates must be real dates in the previous 90 days.');
    const response = await safeAction(z.array(dateSchema).max(90), dates, async dates => {
        const user = await getAuthenticatedUser();
        const uniqueDates = [...new Set(dates)];
        if (!uniqueDates.length) return { success: true, count: 0 };
        return withGameTransaction(user.id, async () => {
            const synced = await db.query(`
                INSERT INTO quest_logs (user_id, quest_title, quest_type, difficulty, xp_reward, gold, completed_at)
                SELECT $1, 'Shadow Detachment: Observer Sync', 'System', 'E', 0, 0,
                    (day || 'T12:00:00Z')::timestamptz
                FROM unnest($2::text[]) AS day
                WHERE NOT EXISTS (SELECT 1 FROM quest_logs
                    WHERE user_id = $1 AND (completed_at AT TIME ZONE 'UTC')::date = day::date)
                RETURNING id
            `, [user.id, uniqueDates]);
            await db.query(`
                INSERT INTO habit_logs (user_id, habit_name, completed_at)
                SELECT $1, 'OFFLINE_SYNC_' || slot::text, (day || 'T12:00:00Z')::timestamptz
                FROM unnest($2::text[]) AS day CROSS JOIN generate_series(1, 3) AS slot
                WHERE NOT EXISTS (SELECT 1 FROM habit_logs WHERE user_id = $1
                    AND habit_name = 'OFFLINE_SYNC_' || slot::text
                    AND (completed_at AT TIME ZONE 'UTC')::date = day::date)
            `, [user.id, uniqueDates]);
            await db.query("DELETE FROM quests WHERE user_id = $1 AND type = 'System' AND title ILIKE 'PENALTY%'", [user.id]);
            const profile = await db.queryOne<{ status_effects: any }>('SELECT status_effects FROM profiles WHERE id = $1', [user.id]);
            if (profile) {
                const effects = Array.isArray(profile.status_effects) ? profile.status_effects : [];
                await db.query('UPDATE profiles SET status_effects = $1 WHERE id = $2',
                    [JSON.stringify(effects.filter((effect: { type: string }) => !['MIASMA', 'EXHAUSTION'].includes(effect.type))), user.id]);
            }
            await logTransaction(user.id, 'OFFLINE_SYNC', {}, { count: synced.rowCount, dates: uniqueDates });
            revalidatePath('/dashboard', 'layout');
            return { success: true, count: synced.rowCount || 0 };
        });
    });
    if (!response.success) throw new Error(response.error);
    return response.data!;
}
