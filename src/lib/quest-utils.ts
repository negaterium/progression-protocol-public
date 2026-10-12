
import { getRankValue } from "./system/rank-constants";

/** Daily bounty progress counts daily-frequency quests, excluding other history events. */
export function countDailyCompletions(
    quests: Array<{ frequency?: string | null; status?: string | null; completed_at?: string | Date | null }>,
    reportDay?: string
): number {
    return quests.filter(quest => {
        if (quest.frequency !== 'Daily' || quest.status !== 'Complete') return false;
        if (!reportDay) return true;
        if (!quest.completed_at) return false;
        const completedAt = new Date(quest.completed_at);
        return Number.isFinite(completedAt.getTime()) && completedAt.toISOString().slice(0, 10) === reportDay;
    }).length;
}

/**
 * Sorts quests by rank from lowest (E) to highest (S/XX)
 */
export function sortQuestsByRank<T extends { difficulty?: string | null }>(quests: T[]): T[] {
    return [...quests].sort((a, b) => {
        const rankA = getRankValue(a.difficulty);
        const rankB = getRankValue(b.difficulty);
        return rankA - rankB;
    });
}
