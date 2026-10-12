"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { AchievementManager } from "@/lib/achievement-manager";
import { awardXp } from "@/lib/server/xp-rewards";
import { recalculateAndClampPlayerStats } from "@/lib/server/user-stats";
import { safeAction } from "@/lib/action-utils";
import { z } from "zod";
import db from "@/lib/db";

const allocateSchema = z.union([
    z.string().transform(s => ({ statName: s, amount: 1 })),
    z.object({
        statName: z.string(),
        amount: z.number().min(1).max(100).default(1)
    })
]);

export async function allocateStatAction(input: string | { statName: string; amount?: number }, amountParam: number = 1) {
    const rawInput = typeof input === 'string' && amountParam > 1 
        ? { statName: input, amount: amountParam }
        : input;

    return safeAction(allocateSchema, rawInput, async (parsed) => {
        const parsedStatName = typeof parsed === 'string' ? parsed : parsed.statName;
        const amount = typeof parsed === 'string' ? 1 : parsed.amount;
        const user = await getAuthenticatedUser();
        const allocAmount = Math.max(1, Math.min(100, Math.floor(amount || 1)));

        // 1. Fetch Profile (Check AP) & Stats
        const profile = await db.queryOne<{ available_ap: number }>(
            "SELECT available_ap FROM profiles WHERE id = $1",
            [user.id]
        );

        const stats = await db.queryOne<any>(
            "SELECT * FROM hunter_stats WHERE user_id = $1",
            [user.id]
        );

        if (!profile || !stats) throw new Error("Profile error");

        if ((profile.available_ap || 0) < allocAmount) {
            throw new Error(`Insufficient Attribute Points (Need ${allocAmount})`);
        }

        // 2. Determine Stat Column
        const mapStatName = (name: string) => {
            const lower = name.toLowerCase();
            switch (lower) {
                case 'str': return 'strength';
                case 'agi': return 'agility';
                case 'int': return 'intelligence';
                case 'vit': return 'vitality';
                case 'per': return 'perception';
                default: return lower;
            }
        };
        const statKey = mapStatName(parsedStatName);
        const validStats = ['strength', 'agility', 'intelligence', 'vitality', 'perception'];
        if (!validStats.includes(statKey)) throw new Error(`Invalid Stat: ${parsedStatName}`);

        const currentVal = (stats as any)[statKey] || 10;
        const newVal = currentVal + allocAmount;

        // 3. Update Stats
        await db.query(
            `UPDATE hunter_stats SET ${statKey} = $1 WHERE user_id = $2`,
            [newVal, user.id]
        );

        // 4. Update AP
        await db.query(
            "UPDATE profiles SET available_ap = $1 WHERE id = $2",
            [(profile.available_ap || 0) - allocAmount, user.id]
        );

        // 5. Recalculate Derived Stats (Centralized)
        await recalculateAndClampPlayerStats(user.id);

        // 6. Check Achievements
        let unlocked: Array<{ code: string; name: string; description: string; xp: number; gold?: number; item?: any }> = [];
        let earnedXp = 0;

        try {
            const achievementManager = new AchievementManager();
            const fullStats = { ...stats, [statKey]: newVal };
            const { unlocked: newUnlocked, totalXp } = await achievementManager.checkAchievements(user.id, 'STAT_UPDATE', {
                stats: fullStats
            });
            unlocked = newUnlocked;
            earnedXp = totalXp;

            if (totalXp > 0) {
                await awardXp(user.id, totalXp);
            }
        } catch (err) {
            console.error("Achievement Check Failed:", err);
        }

        revalidatePath("/dashboard");
        return { unlocked, earnedXp };
    });
}

/**
 * Resets all manually allocated attribute points back to base (10 per stat)
 * and refunds the spent AP to the player's available pool.
 * Available to ALL players at any time.
 */
export async function resetAttributePointsAction() {
    return safeAction(z.any().optional(), undefined, async () => {
        const user = await getAuthenticatedUser();

        // 1. Fetch current stats & available AP
        const [profile, stats] = await Promise.all([
            db.queryOne<{ available_ap: number }>(
                "SELECT available_ap FROM profiles WHERE id = $1",
                [user.id]
            ),
            db.queryOne<{
                strength: number; agility: number; intelligence: number;
                vitality: number; perception: number;
            }>(
                "SELECT strength, agility, intelligence, vitality, perception FROM hunter_stats WHERE user_id = $1",
                [user.id]
            )
        ]);

        if (!profile || !stats) throw new Error("Profile not found");

        // 2. Calculate how many AP were spent
        // Base value for each stat is 10 (starting value at character creation)
        const BASE_STAT = 10;
        const spentAp =
            Math.max(0, (stats.strength || BASE_STAT) - BASE_STAT) +
            Math.max(0, (stats.agility || BASE_STAT) - BASE_STAT) +
            Math.max(0, (stats.intelligence || BASE_STAT) - BASE_STAT) +
            Math.max(0, (stats.vitality || BASE_STAT) - BASE_STAT) +
            Math.max(0, (stats.perception || BASE_STAT) - BASE_STAT);

        if (spentAp === 0) {
            return { refunded: 0, message: "No attribute points have been spent." };
        }

        // 3. Reset all stats to base
        await db.query(
            `UPDATE hunter_stats SET
                strength = $1, agility = $1, intelligence = $1, vitality = $1, perception = $1
             WHERE user_id = $2`,
            [BASE_STAT, user.id]
        );

        // 4. Refund AP
        const newAp = (profile.available_ap || 0) + spentAp;
        await db.query(
            "UPDATE profiles SET available_ap = $1 WHERE id = $2",
            [newAp, user.id]
        );

        // 5. Recalculate derived stats (HP/Mana clamp)
        await recalculateAndClampPlayerStats(user.id);

        revalidatePath("/dashboard", "layout");
        revalidatePath("/dashboard/profile");

        return { refunded: spentAp, newAp };
    });
}

export async function getXPLogsAction(days: number) {
    const response = await safeAction(z.number().int().min(1).max(3650), days, async days => {
        const user = await getAuthenticatedUser();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const logs = await db.query<{ xp_reward: number, completed_at: string }>(
            "SELECT xp_reward, completed_at FROM quest_logs WHERE user_id = $1 AND completed_at >= $2 ORDER BY completed_at DESC",
            [user.id, startDate.toISOString()]
        );

        return logs.rows;
    });
    if (!response.success) throw new Error(response.error);
    return response.data!;
}

