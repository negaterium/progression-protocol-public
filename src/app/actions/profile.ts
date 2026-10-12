"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import db from "@/lib/db";
import { AchievementManager } from "@/lib/achievement-manager";
import { safeAction } from "@/lib/action-utils";
import { z } from "zod";
import { gameDb, withGameTransaction } from '@/lib/server/game-db';
import { getServerPlayerContext } from '@/lib/server/stats-loader';
import { StatsManager } from '@/lib/stats-manager';

const classSchema = z.enum(['Fighter', 'Mage', 'Tank', 'Assassin', 'Warlock', 'Healer', 'Ranger', 'Necromancer']);

export async function equipTitleAction(titleId: string) {
    return safeAction(z.string().uuid(), titleId, async (tId) => {
        const user = await getAuthenticatedUser();
        return withGameTransaction(user.id, async () => {
            const title = await gameDb.queryOne<{ name: string }>(
                'SELECT t.name FROM titles t JOIN user_titles ut ON ut.title_id = t.id WHERE ut.user_id = $1 AND t.id = $2',
                [user.id, tId],
            );
            if (!title) throw new Error('You have not earned this title.');

            // 1. Unequip all
            await gameDb.query("UPDATE user_titles SET is_equipped = false WHERE user_id = $1", [user.id]);

            // 2. Equip new
            await gameDb.query("UPDATE user_titles SET is_equipped = true WHERE user_id = $1 AND title_id = $2", [user.id, tId]);

            // 3. Update Profile Text
            await gameDb.query("UPDATE profiles SET title = $1 WHERE id = $2", [title.name, user.id]);

            revalidatePath("/dashboard/profile");
            revalidatePath("/dashboard");
            return { success: true };
        });
    });
}

export async function updateGenderAction(gender: string) {
    return safeAction(z.enum(['MALE', 'FEMALE']), gender as any, async (g) => {
        const user = await getAuthenticatedUser();

        await db.query("UPDATE profiles SET gender = $1 WHERE id = $2", [g, user.id]);

        revalidatePath("/dashboard/profile");
        return { success: true };
    });
}

export async function updatePlayerClassAction(jobId: string) {
    return safeAction(classSchema, jobId as z.infer<typeof classSchema>, async (job) => {
        const user = await getAuthenticatedUser();
        return withGameTransaction(user.id, async () => {
            const profile = await gameDb.queryOne<{ level: number; hunter_class: string | null }>(
                'SELECT level, hunter_class FROM profiles WHERE id = $1', [user.id],
            );
            if (!profile || profile.level < 40 || (profile.hunter_class && profile.hunter_class !== 'NONE')) {
                throw new Error('Class selection is not available.');
            }
            const victory = await gameDb.queryOne<{ id: string }>(
                "SELECT ae.id FROM active_encounters ae JOIN bosses b ON ae.boss_id = b.id WHERE ae.user_id = $1 AND ae.status = 'DEFEATED' AND b.name ILIKE '%Igris%' LIMIT 1",
                [user.id],
            );
            if (!victory) throw new Error('Defeat Igris before selecting a class.');
            if (job === 'Necromancer') {
                const context = await getServerPlayerContext(user.id);
                const effective = StatsManager.calculateEffectiveStats(context.stats, context.modifiers,
                    context.statusEffects, context.profile.hunter_class, context.stats.crystallized_stats || {});
                const completions = await gameDb.queryOne<{ count: string }>(
                    'SELECT COUNT(*) AS count FROM quest_logs WHERE user_id = $1', [user.id],
                );
                if (effective.intelligence < 100 || effective.perception < 100 || Number(completions?.count || 0) < 500) {
                    throw new Error('Necromancer requirements have not been met.');
                }
            }

            // Update profile class
            await gameDb.query("UPDATE profiles SET hunter_class = $1 WHERE id = $2", [job, user.id]);

            // Trigger Achievement Check
            try {
                const achievementManager = new AchievementManager();
                await achievementManager.checkAchievements(user.id, 'CLASS_CHANGE', { class: job });
            } catch (err) {
                console.error("Class Change Achievement Check Failed:", err);
            }

            revalidatePath("/dashboard");
            revalidatePath("/dashboard/profile");
            return { success: true };
        });
    });
}

export async function toggleAutoSellAction(status: boolean) {
    return safeAction(z.boolean(), status, async (val) => {
        const user = await getAuthenticatedUser();
        await db.query("UPDATE profiles SET auto_sell_junk = $1 WHERE id = $2", [val, user.id]);
        revalidatePath("/dashboard/profile");
        return { success: true };
    });
}
