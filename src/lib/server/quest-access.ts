import { gameDb as db } from "./game-db";

export async function getAccessibleQuest<T extends { id: string; user_id?: string | null }>(userId: string, questId: string) {
    const quest = await db.queryOne<T & { id: string }>(
        "SELECT * FROM quests WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)",
        [questId, userId]
    );
    if (!quest) throw new Error("Quest not found or not available to you.");
    return quest;
}

export async function assertQuestOpen(userId: string, questId: string) {
    const state = await db.queryOne<{ status: string }>(
        "SELECT status FROM user_quests WHERE user_id = $1 AND quest_id = $2",
        [userId, questId]
    );
    if (state && !["Available", "Active"].includes(state.status)) {
        throw new Error("Quest is already completed or closed. Recurring quests reopen at their next reset.");
    }
}
