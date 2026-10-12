import db from "@/lib/db";

export interface SkillProgress {
    total: number;
    learned: number;
    maxed: number;
    unmaxed: number;
    allMaxed: boolean;
}

interface SkillProgressRow {
    current_level: number | null;
    max_level: number;
}

/**
 * Summarizes a player's progress against the complete shared skill catalog.
 * Missing user_skills rows represent unlearned skills and therefore remain
 * unmaxed until the player learns and completes them.
 */
export function summarizeSkillProgress(rows: ReadonlyArray<SkillProgressRow>): SkillProgress {
    const total = rows.length;
    const learned = rows.filter(row => Number(row.current_level || 0) > 0).length;
    const maxed = rows.filter(row => Number(row.current_level || 0) >= Number(row.max_level || 0)).length;
    const unmaxed = Math.max(0, total - maxed);

    return {
        total,
        learned,
        maxed,
        unmaxed,
        allMaxed: total > 0 && unmaxed === 0,
    };
}

export async function getPlayerSkillProgress(userId: string): Promise<SkillProgress> {
    const result = await db.query<SkillProgressRow>(`
        SELECT COALESCE(us.current_level, 0) AS current_level, s.max_level
        FROM skills s
        LEFT JOIN user_skills us
          ON us.skill_id = s.id
         AND us.user_id = $1
    `, [userId]);

    return summarizeSkillProgress(result.rows);
}
