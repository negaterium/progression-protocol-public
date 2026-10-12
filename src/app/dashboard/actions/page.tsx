
import db from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { ActionTabs } from "@/components/dashboard/ActionTabs";
import { StatsManager } from "@/lib/stats-manager";

export const dynamic = 'force-dynamic';

export default async function ActionsPage() {
    try {
        const user = await getAuthenticatedUser();

        // Parallel Fetching for Quests & Bosses
        const [
            profile,
            statsRow,
            keyItemsRow,
            zonesRows,
            questsRows,
            titlesRes,
            equippedRes,
            bossesRows,
            historyRows,
            inventoryRows,
            usageLog,
            assignmentsRow,
            questLogsRes
        ] = await Promise.all([
            // 1. Profile & Stats
            db.queryOne<{ current_mana: number, level: number, title: string | null, shadow_infantry_count: number, hunter_class: string, gold_credits: number }>("SELECT current_mana, level, title, shadow_infantry_count, hunter_class, gold_credits FROM profiles WHERE id = $1", [user.id]),
            db.queryOne<{ strength: number, agility: number, intelligence: number, vitality: number, perception: number, charisma: number }>("SELECT * FROM hunter_stats WHERE user_id = $1", [user.id]),
            db.query("SELECT id, name, price, rarity FROM items WHERE name LIKE 'Instant Dungeon Key%'"),

            // 2. Quests
            db.query("SELECT * FROM zones"),
            db.query(`
                SELECT q.*, 
                       COALESCE(uq.status, 'Available') as status,
                       uq.completed_at
                FROM quests q
                LEFT JOIN user_quests uq ON q.id = uq.quest_id AND uq.user_id = $1
                WHERE q.user_id IS NULL OR q.user_id = $1
            `, [user.id]),
            db.query("SELECT * FROM titles"),
            db.query(`
                SELECT i.*, it.effect 
                FROM inventory i
                JOIN items it ON i.item_id = it.id
                WHERE i.user_id = $1 AND i.equipped = true
            `, [user.id]),

            // 3. Bosses
            db.query("SELECT * FROM bosses ORDER BY phase ASC, COALESCE(required_level, 0) ASC, name ASC, id ASC"),
            db.query("SELECT * FROM active_encounters WHERE user_id = $1 AND status = 'DEFEATED' ORDER BY created_at DESC", [user.id]),
            db.query(`
                SELECT i.id, i.quantity, it.name
                FROM inventory i
                JOIN items it ON i.item_id = it.id
                WHERE i.user_id = $1
            `, [user.id]),

            // 4. Void Strike (Pre-fetch optimization)
            // Rather than complex IIFE in Promise.all, we fetch needed data and compute later
            db.queryOne<{ count: string }>(`
                SELECT COUNT(*) as count FROM habit_logs 
                WHERE user_id = $1 AND habit_name = 'VOID_STRIKE_USAGE' 
                AND completed_at >= CURRENT_DATE
            `, [user.id]),
            // 5. Active Shadow Assignments
            db.queryOne<{ total_assigned: string }>(`
                SELECT SUM(shadow_count) as total_assigned
                FROM shadow_assignments
                WHERE user_id = $1 AND expires_at > NOW()
            `, [user.id]),
            // 6. Quest Logs (History)
            db.query(`
                SELECT id, quest_title, quest_type, difficulty, xp_reward, completed_at
                FROM quest_logs
                WHERE user_id = $1
                ORDER BY completed_at DESC, id DESC
                LIMIT 100
            `, [user.id])
        ]);

        // -- QUESTS DATA PREP --
        const modifierSources: Record<string, number>[] = [];
        if (profile?.title) {
            const titleData = titlesRes.rows.find((t: any) => t.name === profile.title);
            if (titleData?.modifiers) modifierSources.push(titleData.modifiers);
        }
        equippedRes.rows.forEach((entry: any) => {
            if (entry.effect) modifierSources.push(entry.effect);
        });
        const modifiers = StatsManager.aggregateModifiers(modifierSources);

        const hasVoidStrike = equippedRes.rows.some((r: any) => r.effect?.void_strike);
        const voidStrikeAvailable = hasVoidStrike && parseInt(usageLog?.count || '0') === 0;

        const totalShadows = profile?.shadow_infantry_count || 0;
        const assignedShadows = parseInt(assignmentsRow?.total_assigned || '0');
        const availableShadows = Math.max(0, totalShadows - assignedShadows);

        // Charisma Discount
        const baseCharisma = Number(statsRow?.charisma || 10);
        const itemCharisma = equippedRes.rows.reduce((sum, e) => sum + (Number(e.effect?.charisma) || 0), 0);
        const totalCharisma = baseCharisma + itemCharisma;
        const storeDiscount = Math.min(0.50, (totalCharisma * 0.005));

        const questsData = {
            initialZones: zonesRows.rows || [],
            initialQuests: questsRows.rows || [],
            initialMana: profile?.current_mana ?? 0,
            initialLevel: profile?.level ?? 1,
            initialStats: statsRow || { strength: 10, agility: 10, intelligence: 10, vitality: 10, perception: 10 },
            voidStrikeState: { equipped: hasVoidStrike, available: voidStrikeAvailable },
            availableShadows: availableShadows, // Renamed from shadowInfantryCount
            hunterClass: profile?.hunter_class || 'NONE',
            modifiers: modifiers,
            initialQuestLogs: questLogsRes.rows || []
        };


        // -- BOSSES DATA PREP --
        const bosses = bossesRows.rows || [];
        const history = historyRows.rows || [];

        const enrichedBosses = bosses.map((b: any) => {
            const lastRun = history.find((h: any) => h.boss_id === b.id);
            return {
                ...b,
                last_defeated_at: lastRun?.created_at
            };
        });

        const mappedInventory = inventoryRows.rows.map((i: any) => ({
            id: i.id,
            quantity: i.quantity,
            item: { name: i.name }
        }));

        const bossesData = {
            initialBosses: enrichedBosses,
            initialHistory: history,
            initialUserLevel: profile?.level || 1,
            initialUserGold: profile?.gold_credits || 0,
            initialInventory: mappedInventory,
            initialKeys: keyItemsRow.rows || [],
            storeDiscount: storeDiscount
        };

        return (
            <ActionTabs
                questsData={questsData}
                bossesData={bossesData}
            />
        );

    } catch (error: any) {
        console.error("[ActionsPage] Server Render Error:", error);
        return (
            <div className="p-8 text-red-500 font-mono">
                <h1 className="text-2xl font-bold mb-4">SYSTEM ERROR [500]</h1>
                <p>Failed to load Action Hub.</p>
                <div className="mt-4 p-4 bg-red-950/30 border border-red-900 rounded text-xs overflow-auto">
                    {error.message || "Unknown error"}
                </div>
            </div>
        );
    }
}
