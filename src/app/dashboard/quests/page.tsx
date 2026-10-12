import db from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { QuestsClient } from "@/components/quests/QuestsClient";
import { StatsManager } from "@/lib/stats-manager";

export const dynamic = 'force-dynamic';

export default async function QuestsPage() {
    try {
        const user = await getAuthenticatedUser();

        // Parallel Fetching
        const [
            profile,
            statsRow,
            questsRows,
            voidStrikeState,
            titlesRes,
            equippedRes,
            learnedSkillsRes,
            questLogsRes,
            zonesRes,
            assignmentsRes
        ] = await Promise.all([
            db.queryOne<{ current_mana: number, level: number, title: string | null, hunter_class: string | null, shadow_infantry_count: number }>(
                "SELECT current_mana, level, title, hunter_class, shadow_infantry_count FROM profiles WHERE id = $1",
                [user.id]
            ),
            db.queryOne<{ strength: number, agility: number, intelligence: number, vitality: number, perception: number }>("SELECT * FROM hunter_stats WHERE user_id = $1", [user.id]),
            db.query(`
                SELECT q.*, 
                       COALESCE(uq.status, 'Available') as status,
                       uq.completed_at,
                       z.name as zone_name
                FROM quests q
                LEFT JOIN user_quests uq ON q.id = uq.quest_id AND uq.user_id = $1
                LEFT JOIN zones z ON q.zone_id = z.id
                WHERE q.user_id IS NULL OR q.user_id = $1
            `, [user.id]),
            (async () => {
                const eqRes = await db.query<{ effect: any }>(`
                    SELECT i.effect FROM inventory inv
                    JOIN items i ON inv.item_id = i.id
                    WHERE inv.user_id = $1 AND inv.equipped = true
                `, [user.id]);
                const hasVoidStrike = eqRes.rows.some(r => r.effect?.void_strike);

                if (!hasVoidStrike) return { available: false, equipped: false };

                const now = new Date();
                const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
                const usageLog = await db.queryOne<{ count: string }>(`
                    SELECT COUNT(*) as count FROM habit_logs 
                    WHERE user_id = $1 AND habit_name = 'VOID_STRIKE_USAGE' 
                    AND completed_at >= $2
                `, [user.id, startOfToday.toISOString()]);

                return {
                    equipped: true,
                    available: parseInt(usageLog?.count || '0') === 0
                };
            })(),
            db.query("SELECT * FROM titles"),
            db.query(`
                SELECT i.*, it.effect 
                FROM inventory i
                JOIN items it ON i.item_id = it.id
                WHERE i.user_id = $1 AND i.equipped = true
            `, [user.id]),
            db.query(`
                SELECT us.current_level, s.max_level, s.name, s.category, s.stat_bonus
                FROM user_skills us
                JOIN skills s ON us.skill_id = s.id
                WHERE us.user_id = $1 AND us.current_level > 0
            `, [user.id]),
            db.query(`
                SELECT id, quest_title, quest_type, difficulty, xp_reward, completed_at
                FROM quest_logs
                WHERE user_id = $1
                ORDER BY completed_at DESC, id DESC
                LIMIT 100
            `, [user.id]),
            db.query("SELECT * FROM zones ORDER BY name"),
            db.queryOne<{ total_assigned: string }>(`
                SELECT SUM(shadow_count) as total_assigned
                FROM shadow_assignments
                WHERE user_id = $1 AND expires_at > NOW()
            `, [user.id])
        ]);

        // Calculate Modifiers
        const currentLevel = profile?.level ?? 1;
        const modifierSources: Record<string, number>[] = [];
        if (profile?.title) {
            const titleData = titlesRes.rows.find((t: any) => t.name === profile.title);
            if (titleData?.modifiers) modifierSources.push(titleData.modifiers);
        }
        equippedRes.rows.forEach((entry: any) => {
            if (entry.effect) modifierSources.push(entry.effect);
        });
        modifierSources.push(...StatsManager.calculateScaledSkillModifiers(learnedSkillsRes.rows, currentLevel));
        const modifiers = StatsManager.aggregateModifiers(modifierSources);

        const currentMana = profile?.current_mana ?? 0;
        const currentStats = statsRow || { strength: 10, agility: 10, intelligence: 10, vitality: 10, perception: 10 };
        const quests = questsRows.rows || [];

        const totalShadows = profile?.shadow_infantry_count ?? 0;
        const assignedShadows = parseInt(assignmentsRes?.total_assigned || '0');
        const availableShadows = Math.max(0, totalShadows - assignedShadows);
        const hunterClass = profile?.hunter_class ?? 'NONE';

        return (
            <QuestsClient
                initialZones={zonesRes.rows}
                initialQuests={quests}
                initialMana={currentMana}
                initialLevel={currentLevel}
                initialStats={currentStats}
                voidStrikeState={voidStrikeState}
                modifiers={modifiers}
                initialQuestLogs={questLogsRes.rows}
                availableShadows={availableShadows}
                hunterClass={hunterClass}
            />
        );
    } catch (error: any) {
        console.error("[QuestsPage] Server Render Error:", error);
        return (
            <div className="p-8 text-red-500 font-mono">
                <h1 className="text-2xl font-bold mb-4">SYSTEM ERROR [500]</h1>
                <p>Failed to load Mission Control data.</p>
                <div className="mt-4 p-4 bg-red-950/30 border border-red-900 rounded text-xs overflow-auto">
                    {error.message || "Unknown error"}
                    {error.stack && <pre className="mt-2 text-[10px] opacity-50">{error.stack}</pre>}
                </div>
            </div>
        );
    }
}
