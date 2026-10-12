"use server";

import db from "@/lib/db";
import { getAuthenticatedUser } from '@/lib/auth-utils';

export interface RankingEntry {
    id: string;
    username: string;
    level: number;
    is_current_user: boolean;
    current_xp: number | null;
    gold_credits: number | null;
    hunter_class: string;
    hunter_rank: string;
    atk: number | null;
    def: number | null;
    completed_quests: number;
    current_streak: number | null;
}

export async function fetchLeaderboardAction(): Promise<RankingEntry[]> {
    const user = await getAuthenticatedUser();
    try {
        const query = `
            SELECT 
                p.id, 
                p.username, 
                p.level, 
                p.id = $1 as is_current_user,
                CASE WHEN p.id = $1 THEN p.current_xp ELSE NULL END as current_xp,
                CASE WHEN p.id = $1 THEN p.gold_credits ELSE NULL END as gold_credits,
                p.hunter_class, 
                p.hunter_rank, 
                CASE WHEN p.id = $1 THEN COALESCE(s.total_attack, 0) ELSE NULL END as atk,
                CASE WHEN p.id = $1 THEN COALESCE(s.total_defense, 0) ELSE NULL END as def,
                (SELECT COUNT(*) FROM quest_logs ql WHERE ql.user_id = p.id) as completed_quests,
                CASE WHEN p.id = $1 THEN COALESCE((SELECT streak_bonus FROM active_encounters ae WHERE ae.user_id = p.id AND ae.status = 'ACTIVE' LIMIT 1), 0) ELSE NULL END as current_streak
            FROM profiles p
            LEFT JOIN hunter_stats s ON p.id = s.user_id
            ORDER BY p.level DESC, p.current_xp DESC
            LIMIT 50
        `;

        const result = await db.query(query, [user.id]);

        return result.rows.map(row => ({
            ...row,
            is_current_user: row.is_current_user === true,
            current_xp: row.current_xp === null ? null : Number(row.current_xp),
            gold_credits: row.gold_credits === null ? null : Number(row.gold_credits),
            atk: row.atk === null ? null : Number(row.atk),
            def: row.def === null ? null : Number(row.def),
            completed_quests: Number(row.completed_quests || 0),
            current_streak: row.current_streak === null ? null : Number(row.current_streak)
        }));
    } catch (error) {
        console.error("Failed to fetch leaderboard:", error);
        return [];
    }
}
