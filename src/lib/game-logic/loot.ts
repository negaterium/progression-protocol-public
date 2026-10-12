import { BOSS_LOOT_TABLE } from "@/lib/game-logic/boss-loot";
import { gameDb as db } from "@/lib/server/game-db";
import { rankValue } from "@/lib/system/formula";
import { rollItemQuality, applyQualityToEffect } from "@/lib/game-logic/item-roller";
// NOTE: applyQualityToEffect will be used in Phase 4 (Equipped Stats Calculation)

interface LootResult {
    dropped: boolean;
    items?: any[];
    error?: string;
}


function getBaseDropChance(rank: string): number {
    // Increased drop rates for better player experience
    // Old: E=20%, D=30%, C=45%, B=60%, A=80%, S=100%
    // New: More generous across all ranks
    switch (rank) {
        case 'E': return 0.50;  // 50% (was 20%)
        case 'D': return 0.60;  // 60% (was 30%)
        case 'C': return 0.75;  // 75% (was 45%)
        case 'B': return 0.85;  // 85% (was 60%)
        case 'A': return 0.95;  // 95% (was 80%)
        case 'S': return 1.00;  // 100% (unchanged)
        default: return 0.0;
    }
}

function getItemWeight(itemType: string, questRank: string): number {
    const isConsumable = itemType === 'CONSUMABLE' || itemType === 'KEY'; // Grouping keys with consumables for weighting

    switch (questRank) {
        case 'E': return isConsumable ? 4.0 : 1.0;
        case 'D': return isConsumable ? 3.0 : 1.0;
        case 'C': return isConsumable ? 2.0 : 1.0;
        case 'B': return isConsumable ? 1.5 : 1.0;
        case 'A': return isConsumable ? 1.0 : 1.0;
        case 'S': return isConsumable ? 0.5 : 1.0;
        default: return 1.0;
    }
}

/**
 * Higher perception = Higher luck.
 * Base rates are inverted: S-Rank is guaranteed, E-Rank is rarer.
 */
export async function generateQuestLoot(
    questRank: string,
    userId: string
): Promise<LootResult> {
    // 1. Get User Stats for Perception bonus
    const stats = await db.queryOne<{ perception: number, luck: number }>(
        "SELECT perception, luck FROM hunter_stats WHERE user_id = $1",
        [userId]
    );
    const profile = await db.queryOne<{ level: number, hunter_rank: string, auto_sell_junk: boolean }>(
        "SELECT level, hunter_rank, auto_sell_junk FROM profiles WHERE id = $1",
        [userId]
    );

    const perception = stats?.perception || 10;
    const userRank = profile?.hunter_rank || 'E';
    const userLevel = profile?.level || 1;
    const autoSellJunk = profile?.auto_sell_junk || false;

    // Fetch Equipment for Luck and True Sight
    const eqRes = await db.query<{ effect: any }>(`
        SELECT i.effect FROM inventory inv
        JOIN items i ON inv.item_id = i.id
        WHERE inv.user_id = $1 AND inv.equipped = true
    `, [userId]);
    const equipment = eqRes.rows.map(r => r.effect || {});

    const luckStat = stats?.luck || 0;
    const itemLuck = equipment.reduce((sum, e) => sum + (e.luck || 0), 0);
    const totalLuck = luckStat + itemLuck;
    const hasTrueSight = equipment.some(e => e.true_sight);

    // 2. Calculate Final Drop Chance
    const baseChance = getBaseDropChance(questRank);
    const luckBonus = (perception / 100) + (totalLuck / 100);
    const finalChance = baseChance * (1 + luckBonus);

    console.log(`[Loot] Quest Rank: ${questRank}, Base: ${baseChance}, Perception: ${perception}, Luck: ${totalLuck}, Final Chance: ${finalChance.toFixed(2)}`);

    // 3. Determine Number of Drops
    let dropsToGenerate = Math.floor(finalChance);
    const remainingChance = finalChance - dropsToGenerate;
    if (Math.random() < remainingChance) {
        dropsToGenerate++;
    }

    console.log(`[Loot] Drops to generate: ${dropsToGenerate}`);

    if (dropsToGenerate === 0) {
        console.log('[Loot] No drops this time (RNG)');
        return { dropped: false };
    }

    const droppedItems = [];
    const bossItemNames = new Set<string>();
    Object.values(BOSS_LOOT_TABLE).forEach(drops => {
        drops.forEach(drop => bossItemNames.add(drop.itemName));
    });

    // 4. Generate each drop
    for (let i = 0; i < dropsToGenerate; i++) {
        // 5% chance to upgrade rank (25% with True Sight)
        let targetRank = questRank;
        const upgradeChance = hasTrueSight ? 0.25 : 0.05;
        if (Math.random() < upgradeChance) {
            const ranks = ['E', 'D', 'C', 'B', 'A', 'S'];
            const idx = ranks.indexOf(questRank);
            if (idx !== -1 && idx < ranks.length - 1) {
                targetRank = ranks[idx + 1];
            }
        }

        // --- Rank Floor Logic for Consumables ---
        const userRankVal = rankValue(userRank);
        const questRankVal = rankValue(targetRank);
        const floorRankVal = Math.max(questRankVal, userRankVal - 2);

        const floorRanks = ['E', 'D', 'C', 'B', 'A', 'S'];
        const potionRank = floorRanks[floorRankVal - 1] || 'E';

        // Select a pool containing standard rank equipment AND floor rank consumables
        const { rows: items } = await db.query(
            `SELECT id, name, rarity, type, description, effect, slot, price FROM items
             WHERE (rarity = $1 AND type != 'CONSUMABLE')
                OR (rarity = $2 AND type = 'CONSUMABLE')
             ORDER BY id`,
            [targetRank, potionRank]
        );

        if (!items || items.length === 0) {
            continue;
        }

        const pool = items.filter((item: any) => {
            // Rule 1: S-Rank items require Lv 40
            if (item.rarity === 'S' && userLevel < 40) return false;

            // Rule 2: Ring of the Monarch requires Lv 100
            if (item.name === 'Ring of the Monarch' && userLevel < 100) return false;

            return !bossItemNames.has(item.name);
        });

        if (pool.length === 0) continue;

        // --- Weighted Random Selection ---
        const weights = pool.map(item => getItemWeight(item.type, targetRank));
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);

        let random = Math.random() * totalWeight;
        let selectedItem = pool[0];

        for (let j = 0; j < pool.length; j++) {
            random -= weights[j];
            if (random <= 0) {
                selectedItem = pool[j];
                break;
            }
        }

        const droppedItem = selectedItem;

        // === QUALITY ROLL SYSTEM ===
        // Generate dynamic stats for equipment (not consumables/keys)
        let qualityPercent = 100.0;
        let rollTier = 'COMMON';
        let bonusAffixes: string[] = [];

        if (droppedItem.type !== 'CONSUMABLE' && droppedItem.type !== 'KEY') {
            const roll = rollItemQuality(
                droppedItem.rarity,
                totalLuck,
                false // Not a boss drop (quest drop)
            );
            qualityPercent = roll.qualityPercent;
            rollTier = roll.rollTier;
            bonusAffixes = roll.bonusAffixes;
        }

        // 5. Add to Inventory with Quality Data
        const isStackable = droppedItem.type === 'CONSUMABLE' || droppedItem.type === 'KEY';

        let shouldAutoSell = false;
        if (autoSellJunk && !isStackable) {
            const rarityChar = droppedItem.rarity.charAt(0).toUpperCase();
            if (['E', 'D', 'C'].includes(rarityChar) && ['ARMOR', 'WEAPON', 'ACCESSORY', 'EQUIPMENT'].includes(droppedItem.type)) {
                shouldAutoSell = true;
            }
        }

        const existing = isStackable
            ? await db.queryOne<{ id: number, quantity: number }>(`
                SELECT id, quantity FROM inventory
                WHERE user_id = $1 AND item_id = $2
            `, [userId, droppedItem.id])
            : null;

        try {
            let resultingInventoryId: number = -1;

            if (shouldAutoSell) {
                const sellValue = Math.floor((droppedItem.price || 100) * 0.5);
                await db.query("UPDATE profiles SET gold_credits = gold_credits + $1 WHERE id = $2", [sellValue, userId]);
                
                const scaledEffect = applyQualityToEffect(
                    droppedItem.effect || {},
                    { qualityPercent, rollTier: rollTier as any, bonusAffixes },
                    droppedItem.type,
                    droppedItem.slot
                );

                droppedItems.push({
                    ...droppedItem,
                    inventory_id: -1,
                    auto_sold: true,
                    sold_for: sellValue,
                    effect: scaledEffect,
                    quality_roll: qualityPercent,
                    roll_tier: rollTier,
                    bonus_affixes: bonusAffixes
                });
                continue;
            }

            if (existing) {
                // Stackable items (pots/keys) - quality is always 100/Common
                await db.query(`
                UPDATE inventory 
                SET quantity = $1,
                    quality_roll = 100.0,
                    roll_tier = 'COMMON',
                    bonus_affixes = '[]'
                WHERE id = $2
            `, [Number(existing.quantity) + 1, existing.id]);
                resultingInventoryId = existing.id;
            } else {
                // Equipment (with variance) OR new stackable stack
                const insertRes = await db.query<{ id: number }>(`
                    INSERT INTO inventory (user_id, item_id, quantity, equipped, quality_roll, roll_tier, bonus_affixes)
                    VALUES ($1, $2, 1, false, $3, $4, $5)
                    RETURNING id
                `, [userId, droppedItem.id, qualityPercent, rollTier, JSON.stringify(bonusAffixes)]);
                resultingInventoryId = insertRes.rows[0].id;
            }

            // Apply quality scaling to the item effect for client notifications
            const scaledEffect = applyQualityToEffect(
                droppedItem.effect || {},
                { qualityPercent, rollTier: rollTier as any, bonusAffixes },
                droppedItem.type,
                droppedItem.slot
            );

            // Return item with scaled effect so notifications show correct stats
            droppedItems.push({
                ...droppedItem,
                inventory_id: resultingInventoryId,
                effect: scaledEffect,
                quality_roll: qualityPercent,
                roll_tier: rollTier,
                bonus_affixes: bonusAffixes
            });
        } catch (dbErr: any) {
            console.error("Loot DB error:", dbErr);
        }
    }

    if (droppedItems.length === 0) {
        return { dropped: false };
    }

    return { dropped: true, items: droppedItems };
}
