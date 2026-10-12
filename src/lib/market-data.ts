import db from "@/lib/db";
import { getDashboardData } from "@/lib/dashboard-data";
import { applyQualityToEffect } from "@/lib/game-logic/item-roller";
import { calculateItemStatScale, SCALABLE_ATTRIBUTES } from "@/lib/system/formula";

export interface MarketData {
    inventoryData: {
        bagItems: any[];
        equipped: Record<string, any>;
        profile: any;
        stats: any;
        derivedStats: any;
    };
    storeData: {
        items: any[];
        userGold: number;
        userLevel: number;
        storeDiscount: number;
    };
}

/**
 * Load the shared data needed by the Inventory and Store routes.
 * Keeping this in one server-side loader prevents the two destinations from
 * drifting apart while allowing each route to have its own URL and navigation state.
 */
export async function getMarketData(userId: string): Promise<MarketData> {
    const dashboardData = await getDashboardData(userId);

    const [storeItemsResult, inventoryResult] = await Promise.all([
        db.query("SELECT * FROM items WHERE price > 0 ORDER BY price ASC"),
        db.query(`
            SELECT i.*, 
                   i.quality_roll, i.roll_tier, i.bonus_affixes, i.purchased_price,
                   it.id as linked_item_id,
                   it.name as item_name, it.description as item_desc, it.type as item_type, 
                   it.rarity as item_rarity, it.slot as item_slot, it.price as item_price, 
                   it.effect as item_effect, it.image_url as item_image
            FROM inventory i
            JOIN items it ON i.item_id = it.id
            WHERE i.user_id = $1
            ORDER BY i.created_at DESC
        `, [userId])
    ]);

    const inventory = inventoryResult.rows.map((row: any) => {
        const baseEffect = row.item_effect || {};
        const qualityRoll = row.quality_roll || 100.0;
        const rollTier = row.roll_tier || 'COMMON';
        const bonusAffixes = Array.isArray(row.bonus_affixes) ? row.bonus_affixes : [];

        const scaledEffect = applyQualityToEffect(
            baseEffect,
            { qualityPercent: qualityRoll, rollTier: rollTier as any, bonusAffixes },
            row.item_type,
            row.item_slot
        );

        const levelScale = calculateItemStatScale(row.item_rarity, dashboardData.profile?.level || 1);
        let finalEffect = scaledEffect;
        if (levelScale > 1 && row.item_type === 'EQUIPMENT') {
            finalEffect = { ...scaledEffect };
            SCALABLE_ATTRIBUTES.forEach(stat => {
                const value = (finalEffect as any)[stat];
                if (typeof value === 'number' && value > 0) (finalEffect as any)[stat] = Math.round(value * levelScale);
            });
        }

        return {
            ...row,
            quality_roll: qualityRoll,
            roll_tier: rollTier,
            bonus_affixes: bonusAffixes,
            item: {
                id: row.linked_item_id,
                name: row.item_name,
                description: row.item_desc,
                type: row.item_type,
                rarity: row.item_rarity,
                slot: row.item_slot,
                price: row.item_price,
                purchased_price: row.purchased_price ?? null,
                effect: finalEffect,
                base_effect: baseEffect,
                quality_roll: qualityRoll,
                roll_tier: rollTier,
                bonus_affixes: bonusAffixes,
                image_url: row.item_image,
                scale_factor: levelScale > 1 ? levelScale : undefined
            }
        };
    });

    const equipped: Record<string, any> = {};
    inventory.forEach((entry: any) => {
        if (entry.equipped && entry.item.slot && entry.item.slot !== 'NONE') {
            equipped[entry.item.slot] = entry;
        }
    });

    const playerLevel = dashboardData.profile?.level || 1;
    const totalCharisma = dashboardData.effectiveStats?.charisma || dashboardData.stats?.charisma || 10;
    const storeDiscount = Math.min(0.50, totalCharisma * 0.005);

    const scaledStoreItems = storeItemsResult.rows.map((item: any) => {
        if (item.type !== 'EQUIPMENT') return item;

        const scaleFactor = calculateItemStatScale(item.rarity, playerLevel);
        if (scaleFactor <= 1) return item;

        let effect = item.effect;
        if (typeof effect === 'string') {
            try { effect = JSON.parse(effect); } catch { return item; }
        }
        if (!effect) return item;

        const scaledEffect = { ...effect };
        SCALABLE_ATTRIBUTES.forEach((stat: string) => {
            const value = scaledEffect[stat];
            if (typeof value === 'number' && value > 0) scaledEffect[stat] = Math.round(value * scaleFactor);
        });

        return { ...item, effect: scaledEffect, scale_factor: scaleFactor };
    });

    return {
        inventoryData: {
            bagItems: inventory,
            equipped,
            profile: dashboardData.profile,
            stats: dashboardData.effectiveStats || dashboardData.stats,
            derivedStats: dashboardData.derivedStats
        },
        storeData: {
            items: scaledStoreItems,
            userGold: dashboardData.profile?.gold_credits || 0,
            userLevel: playerLevel,
            storeDiscount
        }
    };
}
