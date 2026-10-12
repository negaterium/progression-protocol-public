import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getXpRequiredForLevel, calculateLevel, calculateCosmicEssenceGain } from "@/lib/system/leveling";
import { calculateRank } from "@/lib/system/formula";
import { AchievementManager } from "@/lib/achievement-manager";
import { recalculateAndClampPlayerStats } from "./user-stats";
import { logTransaction } from "./audit";
import { gameDb as db, withGameTransaction } from "./game-db";

export async function awardXp(userId: string, amount: number) {
    z.number().finite().parse(amount);
    return withGameTransaction(userId, async () => {

        // 1. Fetch current profile
        const profile = await db.queryOne<any>("SELECT *, prestige_level FROM profiles WHERE id = $1", [userId]);

        if (!profile) {
            throw new Error("Profile not found");
        }

        // 2. Calculate Multipliers and New Values
        const statusEffects = Array.isArray(profile.status_effects) ? profile.status_effects : [];
        let xpMult = 1.0;
        statusEffects.forEach((eff: any) => {
            if (eff.modifiers?.xp_gain_multiplier !== undefined) {
                xpMult *= eff.modifiers.xp_gain_multiplier;
            }
        });

        // 2b. Equipment Bonuses
        const eqRes = await db.query<{ effect: any }>(`
            SELECT i.effect FROM inventory inv
            JOIN items i ON inv.item_id = i.id
            WHERE inv.user_id = $1 AND inv.equipped = true
        `, [userId]);
        const equipment = eqRes.rows;

        equipment.forEach(e => {
            const effect = e.effect;
            if (!effect) return;

            if (effect.xp_multiplier) xpMult *= effect.xp_multiplier;
            if (effect.xp_boost_int && (effect as any).intelligence) {
                // Formula: (Intelligence * Boost) % extra XP
                xpMult += ((effect as any).intelligence * effect.xp_boost_int);
            }
        });

        const oldXp = profile.current_xp || 0;
        const finalAmount = Math.floor(amount * xpMult);
        const newXp = Math.max(0, oldXp + finalAmount);

        const oldLevel = profile.level || 1;

        // 2c. Cosmic Essence: Earned only at/after Level 999
        let ceIncrement = 0;
        if (oldLevel >= 999) {
            ceIncrement = calculateCosmicEssenceGain(finalAmount);
        }

        // ============================================================
        // Standard Leveling Logic (Infinite)
        // ============================================================
        const levelData = calculateLevel(newXp);
        const newLevel = levelData.level;

        const updates: Record<string, number | string> = {
            current_xp: newXp,
            level: newLevel,
            next_level_xp: levelData.nextLevelXp + getXpRequiredForLevel(newLevel), // Store Total XP for next level
            hunter_rank: calculateRank(newLevel, profile.prestige_level || 0),
        };

        // Track atomic increments for level-up rewards (avoids stale-read race condition
        // with recursive achievement XP calls that also call addXpAction).
        let apIncrement = 0;
        let spIncrement = 0;
        let goldIncrement = 0;

        // 3. Level Up Logic
        if (newLevel > oldLevel) {
            console.log(`LEVEL UP! ${oldLevel} -> ${newLevel}`);
            const levelsGained = newLevel - oldLevel;

            // Update Stats: Increase Max Mana Permanent Stat (+10 per level)
            const stats = await db.queryOne<any>("SELECT mana FROM hunter_stats WHERE user_id = $1", [userId]);
            if (stats) {
                const currentMaxManaBase = stats.mana || 100;
                const newMaxManaBase = currentMaxManaBase + (levelsGained * 10);

                await db.query(
                    "UPDATE hunter_stats SET mana = $1 WHERE user_id = $2",
                    [newMaxManaBase, userId]
                );
            }

            // Use increments instead of snapshot values to avoid race conditions
            // with recursive addXpAction calls triggered by achievement rewards.
            apIncrement = levelsGained * 5;   // +5 AP per level
            spIncrement = levelsGained * 1;   // +1 SP per level
            goldIncrement = levelsGained * 1000; // +1000 Gold per level

            // CRITICAL: Write the new level to the DB BEFORE recalculating stats,
            // so recalculateAndClampPlayerStats sees the correct level for maxHp/maxMana.
            await db.query(
                "UPDATE profiles SET level = $1, current_xp = $2 WHERE id = $3",
                [newLevel, newXp, userId]
            );

            // Full Sync Stats to get new max values (now correctly using the new level)
            const { maxHp, maxMana } = await recalculateAndClampPlayerStats(userId);

            // [MODIFIED] Suppress Full Restore during Boss Encounters
            const activeEncounter = await db.queryOne("SELECT id FROM active_encounters WHERE user_id = $1 AND status = 'ACTIVE'", [userId]);
            if (activeEncounter) {
                const hasInterference = statusEffects.some((e: any) => e.type === 'SYSTEM_INTERFERENCE');
                if (hasInterference) {
                    console.log(`[Level Up] HEALING BLOCKED by System Interference.`);
                    // No update to current_hp/mana
                } else {
                    console.log(`[Level Up] Partial Restore only (Combat Active).`);
                    const curHp = profile.current_hp || 0;
                    const curMana = profile.current_mana || 0;
                    updates.current_hp = Math.min(maxHp, curHp + Math.floor((maxHp - curHp) * 0.2));
                    updates.current_mana = Math.min(maxMana, curMana + Math.floor((maxMana - curMana) * 0.2));
                }
            } else {
                // Full Restore on Level Up outside of Boss combat
                updates.current_hp = maxHp;
                updates.current_mana = maxMana;
            }
        }

        // 4. Update Database
        // Build the SET clause for non-increment fields
        const updateKeys = Object.keys(updates);
        const setClause = updateKeys.map((k, i) => `${k} = $${i + 2}`).join(", ");
        const updateValues = updateKeys.map(k => updates[k]);

        // Append atomic increments for level-up rewards (safe against recursive call race conditions)
        const atomicClauses: string[] = [];
        for (const [column, increment] of [
            ['available_ap', apIncrement], ['available_sp', spIncrement],
            ['gold_credits', goldIncrement], ['cosmic_essence', ceIncrement]
        ] as const) {
            if (increment > 0) {
                updateValues.push(increment);
                atomicClauses.push(`${column} = COALESCE(${column}, 0) + $${updateValues.length + 1}`);
            }
        }
        const incrementClause = atomicClauses.length ? ', ' + atomicClauses.join(', ') : '';

        await db.query(
            `UPDATE profiles SET ${setClause}${incrementClause} WHERE id = $1`,
            [userId, ...updateValues]
        );

        // AUDIT LOG
        const metadata: Record<string, any> = { source: 'addXpAction', newLevel };
        if (ceIncrement > 0) metadata.ceGained = ceIncrement;

        await logTransaction(userId, "XP_GAIN", { xp: finalAmount, gold: goldIncrement }, metadata);

        // 5. Check Achievements
        let unlocked: Array<{ code: string; name: string; description: string; xp: number }> = [];
        let earnedXp = 0;

        try {
            const achievementManager = new AchievementManager();
            const { unlocked: newUnlocked, totalXp } = await achievementManager.checkAchievements(userId, 'LEVEL_UP', {
                level: newLevel
            });
            unlocked = newUnlocked;
            earnedXp = totalXp;

            if (totalXp > 0) {
                await awardXp(userId, totalXp);
            }
        } catch (err) {
            console.error("Achievement Check Failed:", err);
        }

        revalidatePath("/dashboard", "layout");
        return { success: true, newLevel: newLevel > oldLevel ? newLevel : undefined, unlocked, earnedXp, ceGained: ceIncrement };
    });
}
