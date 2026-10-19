"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { gameDb as db, withGameTransaction } from "@/lib/server/game-db";
import { startBossBattle } from "@/lib/server/boss-battle";
import { awardBossRewards, RANK_REWARDS } from "@/lib/server/boss-rewards";
import { getDeveloperUser } from "@/lib/server/admin-auth";
import { safeAction } from "@/lib/action-utils";
import { z } from "zod";
import { calculateGlobalRewardMultiplier } from "@/lib/system/formula";
import { BOSS_BALANCE_VERSION, getBossRepeatRewardScale, isBossBountyEligible } from '@/lib/game-logic/boss-balance-policy';
import { getBossBountySummary } from '@/lib/server/boss-bounty';

export async function startBossBattleAction(input: { bossId: string }) {
    return safeAction(z.object({ bossId: z.string().min(1) }).strict(), input, async ({ bossId }) => {
        const user = await getAuthenticatedUser();
        return startBossBattle(user, bossId);
    });
}

export async function grantBossRewards(input: { bossId: string, userId: string }) {
    return safeAction(z.object({ bossId: z.string().min(1), userId: z.string().min(1) }).strict(), input, async ({ bossId, userId }) => {
        const user = await getAuthenticatedUser();
        if (userId !== user.id) throw new Error("Cannot claim another player's rewards.");
        return awardBossRewards(user, bossId);
    });
}

export async function fetchActiveEncounterAction() {
    const user = await getAuthenticatedUser();

    try {
        const { rows } = await db.query(`
            SELECT ae.id, ae.current_hp, ae.max_hp, ae.streak_bonus, ae.status, ae.created_at,
                   b.name as boss_name, b.rank as boss_rank, b.image_url as boss_image,
                   b.description, b.intel, b.damage_type, b.phase, ae.balance_version, ae.is_first_clear
            FROM active_encounters ae
            JOIN bosses b ON ae.boss_id = b.id
            WHERE ae.user_id = $1 AND ae.status = 'ACTIVE'
            LIMIT 1
        `, [user.id]);

        if (rows.length === 0) {
            return null;
        }

        // Fetch Level for estimated rewards
        const profile = await db.queryOne<{ level: number }>("SELECT level FROM profiles WHERE id = $1", [user.id]);
        const level = profile?.level || 1;
        const row = rows[0];
        const baseRewards = RANK_REWARDS[row.boss_rank as string] || RANK_REWARDS['C'];

        // Reward Scaling Calculation (Active View)
        const multiplier = calculateGlobalRewardMultiplier(level);
        const repeat = row.balance_version === BOSS_BALANCE_VERSION && row.is_first_clear === false;
        const rewardScale = repeat ? getBossRepeatRewardScale(row.boss_rank) : 1;
        const usesBounty = repeat && isBossBountyEligible({ rank: row.boss_rank, phase: row.phase });
        const bounty = usesBounty ? await getBossBountySummary(user.id, level) : null;
        const postCap = level >= 999 ? 2 : 1;
        const estXp = usesBounty ? bounty?.pendingXp || 0 : Math.floor(baseRewards.xp * multiplier * postCap * rewardScale);
        const estGold = Math.floor(baseRewards.gold * multiplier * rewardScale);

        const result = {
            ...row,
            boss: {
                name: row.boss_name,
                rank: row.boss_rank,
                image_url: row.boss_image,
                description: row.description,
                intel: row.intel,
                damage_type: row.damage_type
            },
            potentialRewards: {
                xp: estXp,
                gold: estGold
            },
            bounty
        };

        return result;
    } catch (e) {
        console.error("[fetchActiveEncounterAction] Error:", e);
        return null;
    }
}

export async function forfeitBossBattleAction() {
    return safeAction(z.void(), undefined, async () => {
        const user = await getAuthenticatedUser();
        return withGameTransaction(user.id, async () => {

            await db.query(
                "UPDATE active_encounters SET status = 'FAILED' WHERE user_id = $1 AND status = 'ACTIVE'",
                [user.id]
            );

            revalidatePath('/dashboard', 'layout');
            revalidatePath('/dashboard/bosses');
            return { success: true };
        });
    });
}

export async function unlockAllBossesAction() {
    const result = await safeAction(z.void(), undefined, async () => {
        await getDeveloperUser();

        // Set all to AVAILABLE
        await db.query("UPDATE bosses SET status = 'AVAILABLE' WHERE name != 'PLACEHOLDER'");

        revalidatePath('/dashboard', 'layout');
        return { success: true };
    });
    if (!result.success) throw new Error(result.error);
    return result.data!;
}

export async function lockAllBossesAction() {
    const result = await safeAction(z.void(), undefined, async () => {
        await getDeveloperUser();

        await db.query("UPDATE bosses SET status = 'LOCKED' WHERE name != 'PLACEHOLDER'");

        revalidatePath('/dashboard', 'layout');
        return { success: true };
    });
    if (!result.success) throw new Error(result.error);
    return result.data!;
}

export async function clearActiveEncountersAction() {
    return safeAction(z.void(), undefined, async () => {
        const user = await getDeveloperUser();
        return withGameTransaction(user.id, async () => {

            await db.query("DELETE FROM active_encounters WHERE user_id = $1", [user.id]);

            revalidatePath('/dashboard', 'layout');
            revalidatePath('/dashboard/bosses');
            return { success: true };
        });
    });
}
