"use server";

import { revalidatePath } from "next/cache";
import { awardXp } from "@/lib/server/xp-rewards";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { safeAction } from "@/lib/action-utils";
import { logTransaction } from "@/lib/server/audit";
import { z } from "zod";
import { gameDb as db, withGameTransaction } from "@/lib/server/game-db";
import { getAccessibleQuest, assertQuestOpen } from "@/lib/server/quest-access";
import { PENALTY_PERCENT } from "@/lib/system/rank-constants";

export async function failQuestAction(questId: string) {
    return safeAction(z.string(), questId, async (qId) => {
        const user = await getAuthenticatedUser();
        return withGameTransaction(user.id, async () => {

            const quest = await getAccessibleQuest<{ id: string, difficulty: string, title: string }>(user.id, qId);
            await assertQuestOpen(user.id, qId);
            if (!quest) throw new Error("Quest not found");

            await db.query(
                `INSERT INTO user_quests (user_id, quest_id, status) VALUES ($1, $2, 'Failed')
             ON CONFLICT (user_id, quest_id) DO UPDATE SET status = 'Failed'`,
                [user.id, qId]
            );

            const PENALTY_XP = -50;
            try { await awardXp(user.id, PENALTY_XP); } catch (e) { console.error("Failed to deduct XP", e); }

            await logTransaction(user.id, "QUEST_FAIL", { xp: PENALTY_XP }, { questId: qId, title: quest.title });

            // HP Penalty (scaled by rank)
            const stats = await db.queryOne<{ vitality: number }>("SELECT vitality FROM hunter_stats WHERE user_id = $1", [user.id]);
            const maxHp = (stats?.vitality || 10) * 10;
            const hpPenalty = Math.floor(maxHp * (PENALTY_PERCENT[quest.difficulty] || 0.10));
            const profile = await db.queryOne<{ current_hp: number }>("SELECT current_hp FROM profiles WHERE id = $1", [user.id]);

            if (profile) {
                const hpFloor = Math.floor(maxHp * 0.30);
                const newHp = Math.max(hpFloor, Math.min(profile.current_hp || maxHp, (profile.current_hp || maxHp) - hpPenalty));
                await db.query("UPDATE profiles SET current_hp = $1 WHERE id = $2", [newHp, user.id]);
            }

            revalidatePath("/dashboard", "layout");
            revalidatePath("/dashboard/quests");
            return { success: true, penaltyXp: PENALTY_XP, penaltyHp: hpPenalty };
        });
    });
}

export async function acceptQuestAction(questId: string) {
    return safeAction(z.string(), questId, async (qId) => {
        const user = await getAuthenticatedUser();
        return withGameTransaction(user.id, async () => {

            const quest = await getAccessibleQuest<{ id: string, difficulty: string }>(user.id, qId);
            await assertQuestOpen(user.id, qId);
            if (!quest) throw new Error("Quest not found");

            await db.query(
                `INSERT INTO user_quests (user_id, quest_id, status)
             VALUES ($1, $2, 'Active')
             ON CONFLICT (user_id, quest_id) DO UPDATE SET status = 'Active'`,
                [user.id, qId]
            );
            revalidatePath("/dashboard/quests");
            return { success: true };
        });
    });
}

export async function checkAndResetRecurringQuests(timezoneOffset?: number) {
    return safeAction(z.number().finite().min(-840).max(840).optional(), timezoneOffset, async (offset) => {
        const user = await getAuthenticatedUser();
        return withGameTransaction(user.id, async () => {

            const { rows: recurringQuests } = await db.query<{ id: string, completed_at: Date, frequency: string, type: string }>(
                `SELECT q.id, uq.completed_at, q.frequency, q.type
             FROM user_quests uq
             JOIN quests q ON uq.quest_id = q.id
             WHERE uq.user_id = $1 AND uq.status = 'Complete' AND q.frequency != 'Once'`,
                [user.id]
            );

            if (!recurringQuests || recurringQuests.length === 0) return { success: true };

            const now = new Date();
            const clientDate = new Date(now.getTime() - (offset || 0) * 60 * 1000);

            // Automated daily backup
            try {
                const startOfLocalDay = new Date(Date.UTC(clientDate.getUTCFullYear(), clientDate.getUTCMonth(), clientDate.getUTCDate()));
                const backupExists = await db.queryOne(
                    "SELECT id FROM user_backups WHERE user_id = $1 AND type = 'DAILY' AND created_at >= $2",
                    [user.id, startOfLocalDay.toISOString()]
                );
                if (!backupExists) {
                    const { createDailyBackupAction } = await import("@/app/actions/backup");
                    await createDailyBackupAction('DAILY');
                }
            } catch (e) { console.error("Auto Backup Failed:", e); }

            // Timezone-adjusted boundaries
            const offsetMs = (offset || 0) * 60 * 1000;
            let startOfTodayUTC: Date;
            let startOfLocalDayPseudoUTC: Date;

            if (offset !== undefined) {
                const localDatePseudoUTC = new Date(now.getTime() - offsetMs);
                startOfLocalDayPseudoUTC = new Date(Date.UTC(
                    localDatePseudoUTC.getUTCFullYear(), localDatePseudoUTC.getUTCMonth(), localDatePseudoUTC.getUTCDate()
                ));
                startOfTodayUTC = new Date(startOfLocalDayPseudoUTC.getTime() + offsetMs);
            } else {
                startOfLocalDayPseudoUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
                startOfTodayUTC = startOfLocalDayPseudoUTC;
            }

            const toRealUTC = (pseudo: Date) => new Date(pseudo.getTime() + offsetMs);

            const resets: string[] = [];
            for (const quest of recurringQuests) {
                if (!quest.completed_at) { resets.push(quest.id); continue; }
                const lastCompleted = new Date(quest.completed_at);
                const frequency = quest.frequency || 'Daily';
                let shouldReset = false;

                if (frequency === 'Daily') {
                    shouldReset = lastCompleted < startOfTodayUTC;
                } else if (frequency === 'Weekly') {
                    const localDay = startOfLocalDayPseudoUTC.getUTCDay();
                    let daysSinceMonday = localDay - 1;
                    if (daysSinceMonday < 0) daysSinceMonday = 6;
                    const startOfWeekPseudo = new Date(startOfLocalDayPseudoUTC);
                    startOfWeekPseudo.setUTCDate(startOfLocalDayPseudoUTC.getUTCDate() - daysSinceMonday);
                    shouldReset = lastCompleted < toRealUTC(startOfWeekPseudo);
                } else if (frequency === 'Monthly') {
                    const startOfMonthPseudo = new Date(startOfLocalDayPseudoUTC);
                    startOfMonthPseudo.setUTCDate(1);
                    shouldReset = lastCompleted < toRealUTC(startOfMonthPseudo);
                } else if (frequency === 'Yearly') {
                    const startOfYearPseudo = new Date(startOfLocalDayPseudoUTC);
                    startOfYearPseudo.setUTCMonth(0, 1);
                    shouldReset = lastCompleted < toRealUTC(startOfYearPseudo);
                }

                if (shouldReset) resets.push(quest.id);
            }

            if (resets.length > 0) {
                await db.query(`DELETE FROM user_quests WHERE user_id = $1 AND quest_id = ANY($2)`, [user.id, resets]);
                revalidatePath("/dashboard/quests");
            }
            return { success: true };
        });
    });
}

export async function voidStrikeAction(questId: string) {
    return safeAction(z.string(), questId, async (qId) => {
        const user = await getAuthenticatedUser();
        return withGameTransaction(user.id, async () => {

            const eqRes = await db.query<{ effect: any }>(`
            SELECT i.effect FROM inventory inv
            JOIN items i ON inv.item_id = i.id
            WHERE inv.user_id = $1 AND inv.equipped = true
        `, [user.id]);
            if (!eqRes.rows.some(r => r.effect?.void_strike)) {
                throw new Error("Void Strike requirement not met: Equip Dagger of the Void.");
            }

            const startOfToday = new Date();
            startOfToday.setUTCHours(0, 0, 0, 0);
            const usageLog = await db.queryOne<{ count: string }>(
                "SELECT COUNT(*) as count FROM habit_logs WHERE user_id = $1 AND habit_name = 'VOID_STRIKE_USAGE' AND completed_at >= $2",
                [user.id, startOfToday.toISOString()]
            );
            if (parseInt(usageLog?.count || '0') > 0) {
                throw new Error("Void Strike on cooldown. Limit: Once per day.");
            }

            const quest = await getAccessibleQuest<{ id: string, difficulty: string, xp_reward: number }>(user.id, qId);
            await assertQuestOpen(user.id, qId);
            if (!quest) throw new Error("Quest not found");
            if (!['E', 'D'].includes(quest.difficulty || 'E')) {
                throw new Error("Void Strike only affects minor tasks (Rank E or D).");
            }

            await db.query(
                `INSERT INTO user_quests (user_id, quest_id, status, completed_at)
             VALUES ($1, $2, 'Complete', NOW())
             ON CONFLICT (user_id, quest_id) DO UPDATE SET status = 'Complete', completed_at = NOW()`,
                [user.id, qId]
            );
            await db.query(
                `INSERT INTO habit_logs (user_id, habit_name, completed_at) VALUES ($1, 'VOID_STRIKE_USAGE', NOW())`,
                [user.id]
            );
            await logTransaction(user.id, "VOID_STRIKE", { xp: quest.xp_reward }, { questId: qId });

            try {
                const { extractShadow } = await import("@/lib/server/shadow-extraction");
                await extractShadow(user, { source: 'DUNGEON' });
            } catch (err) { console.warn("[Shadow Extraction] Failed in void strike:", err); }

            revalidatePath("/dashboard", "layout");
            revalidatePath("/dashboard/quests");
            return { success: true };
        });
    });
}
