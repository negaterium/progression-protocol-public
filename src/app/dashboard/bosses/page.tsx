import db from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { BossesClient } from "@/components/bosses/BossesClient";

export default async function BossesPage() {
    const user = await getAuthenticatedUser();

    // Parallel Fetching
    const [profile, bossesRows, historyRows, inventoryRows, keyItemsRow, statsRow] = await Promise.all([
        db.queryOne<{ level: number, gold_credits: number }>("SELECT level, gold_credits FROM profiles WHERE id = $1", [user.id]),
        db.query("SELECT * FROM bosses ORDER BY phase ASC, COALESCE(required_level, 0) ASC, name ASC, id ASC"),
        db.query("SELECT * FROM active_encounters WHERE user_id = $1 AND status = 'DEFEATED' ORDER BY created_at DESC", [user.id]),
        db.query(`
            SELECT i.id, i.quantity, i.equipped, it.name, it.effect
            FROM inventory i
            JOIN items it ON i.item_id = it.id
            WHERE i.user_id = $1
        `, [user.id]),
        db.query("SELECT id, name, price, rarity FROM items WHERE name LIKE 'Instant Dungeon Key%'"),
        db.queryOne<{ charisma: number }>("SELECT charisma FROM hunter_stats WHERE user_id = $1", [user.id])
    ]);

    const userLevel = profile?.level || 1;
    const userGold = profile?.gold_credits || 0;
    const bosses = bossesRows.rows || [];
    const history = historyRows.rows || [];
    const inventory = inventoryRows.rows || [];
    const keyItems = keyItemsRow.rows || [];

    // Calculate Charisma Discount
    const baseCharisma = Number(statsRow?.charisma || 10);
    const itemCharisma = inventory
        .filter((inv: any) => inv.equipped)
        .reduce((sum: number, inv: any) => sum + (Number(inv.effect?.charisma) || 0), 0);
    const totalCharisma = baseCharisma + itemCharisma;
    const storeDiscount = Math.min(0.50, (totalCharisma * 0.005));

    // Map history to bosses
    const enrichedBosses = bosses.map(b => {
        const lastRun = history.find((h) => h.boss_id === b.id);
        return {
            ...b,
            last_defeated_at: lastRun?.created_at
        };
    });

    // Transform Inventory - SQL returns flat 'name', we need nested 'item.name'
    const mappedInventory = inventory.map((i: any) => ({
        id: i.id,
        quantity: i.quantity,
        item: { name: i.name }
    }));

    return (
        <BossesClient
            initialBosses={enrichedBosses}
            initialHistory={history}
            initialUserLevel={userLevel}
            initialUserGold={userGold}
            initialInventory={mappedInventory}
            initialKeys={keyItems}
            storeDiscount={storeDiscount}
        />
    );
}
