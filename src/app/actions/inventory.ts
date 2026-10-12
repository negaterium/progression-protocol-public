"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { startBossBattle } from "@/lib/server/boss-battle";
import { awardXp } from "@/lib/server/xp-rewards";
import { StatsManager } from "@/lib/stats-manager";
import { gameDb as db, withGameTransaction } from "@/lib/server/game-db";
import { STATUS_EFFECT_DEFINITIONS } from "@/lib/system/status-effects";
import { applyHealingReceivedBonus } from "@/lib/system/skill-effects";
import { RANK_LEVELS } from "@/lib/system/rank-constants";

import { ItemEffectSchema } from "@/lib/types/zod-schemas";
import { safeAction } from "@/lib/action-utils";
import { z } from "zod";
import { recalculateAndClampPlayerStats } from "@/lib/server/user-stats";
import { logTransaction } from "@/lib/server/audit";
import { getServerPlayerContext } from "@/lib/server/stats-loader";

export async function equipItemAction(inventoryId: number | string) {
    return safeAction(z.union([z.number(), z.string()]).transform(val => typeof val === 'string' ? parseInt(val, 10) : val), inventoryId, async (id) => {
        const user = await getAuthenticatedUser();

        // 1. Fetch Item + Profile for Validation
        const [invItem, profile] = await Promise.all([
            db.queryOne<any>(`
                SELECT i.id, i.equipped, i.user_id,
                       it.id as item_id, it.name as item_name, it.slot as item_slot, it.type as item_type,
                       it.rarity as item_rarity, it.effect as item_effect
                FROM inventory i
                JOIN items it ON i.item_id = it.id
                WHERE i.id = $1 AND i.user_id = $2
            `, [id, user.id]),
            db.queryOne<{ level: number }>("SELECT level FROM profiles WHERE id = $1", [user.id])
        ]);

        if (!invItem) throw new Error("Item not found");

        // 2. Level Requirement Check (only explicit level_required)
        const userLevel = profile?.level || 1;
        const effect = invItem.item_effect || {};
        const requiredLevel = effect.level_required || 0;

        if (requiredLevel > userLevel) {
            throw new Error(`LEVEL ${requiredLevel} REQUIRED TO EQUIP THIS ITEM.`);
        }

        const itemSlot = invItem.item_slot;
        const isEquipping = !invItem.equipped;

        // 3. Logic: If equipping, unequip others in same slot (if not NONE)
        if (isEquipping && itemSlot !== 'NONE') {
            const currentEquipped = await db.query<any>(`
                SELECT i.id
                FROM inventory i
                JOIN items it ON i.item_id = it.id
                WHERE i.user_id = $1 AND i.equipped = true AND it.slot = $2
            `, [user.id, itemSlot]);

            if (currentEquipped.rows.length > 0) {
                const idsToUnequip = currentEquipped.rows.map(r => r.id);
                await db.query(
                    "UPDATE inventory SET equipped = false WHERE id = ANY($1)",
                    [idsToUnequip]
                );
            }
        }

        // 4. Toggle the State
        await db.query(
            "UPDATE inventory SET equipped = $1 WHERE id = $2",
            [isEquipping, id]
        );

        // 5. Recalculate Stats & Clamp HP/Mana
        await recalculateAndClampPlayerStats(user.id);

        revalidatePath("/dashboard", "layout");
        revalidatePath("/dashboard/inventory");
        return { isEquipped: isEquipping };
    });
}

export async function consumeItemAction(inventoryId: number | string) {
    return safeAction(z.union([z.number(), z.string()]).transform(val => typeof val === 'string' ? parseInt(val, 10) : val), inventoryId, async (id) => {
        const user = await getAuthenticatedUser();
        return withGameTransaction(user.id, async () => {

            // 1. Fetch Unified Context (Shadows, Titles, Gear, Skills) + Item to consume
            const [{ profile, stats: currentStats, modifiers, statusEffects }, invItem] = await Promise.all([
                getServerPlayerContext(user.id),
                db.queryOne<any>(`
                SELECT i.id, i.quantity, i.user_id, i.item_id,
                       it.name as item_name, it.type as item_type,
                       it.rarity as item_rarity, it.effect as item_effect
                FROM inventory i
                JOIN items it ON i.item_id = it.id
                WHERE i.id = $1 AND i.user_id = $2
            `, [id, user.id])
            ]);

            if (!invItem || invItem.quantity < 1) throw new Error("Item unavailable");
            if (!profile) throw new Error("Profile not found");
            if (!currentStats) throw new Error("Stats not found");

            const itemData = {
                type: invItem.item_type,
                name: invItem.item_name,
                rarity: invItem.item_rarity,
                effect: invItem.item_effect || {}
            };

            if (itemData.type !== 'CONSUMABLE' && itemData.type !== 'KEY') throw new Error("Cannot use this item");

            const effectParse = ItemEffectSchema.safeParse(itemData.effect);
            if (!effectParse.success) throw new Error("Invalid item effect");
            const effects = effectParse.data;

            // --- CONSOLIDATED LEVEL REQUIREMENT CHECK ---
            const userLevel = profile.level || 1;

            // Normalize rarity (remove -Rank etc and uppercase)
            const rawRarity = (itemData.rarity as string || "").split('-')[0].trim().toUpperCase();

            let requiredLevel = effects.level_required || 0;

            // Apply rank-based level requirements ONLY to KEYS
            if (!requiredLevel && itemData.type === 'KEY' && rawRarity) {
                requiredLevel = RANK_LEVELS[rawRarity] || 1;
            }

            // Special Case: Dungeon Specific Requirements (Overwrites Rank)
            if (itemData.type === 'KEY' && effects.unlocks_dungeon) {
                const DUNGEON_LEVEL_REQS: Record<string, number> = {
                    'hapjeong_subway': 10,
                    'demon_castle': 40,
                    'jeju_island': 80
                };
                const dungeonLevelReq = DUNGEON_LEVEL_REQS[effects.unlocks_dungeon] || 0;
                if (dungeonLevelReq > requiredLevel) requiredLevel = dungeonLevelReq;
            }

            if (requiredLevel > userLevel) {
                throw new Error(`LEVEL ${requiredLevel} REQUIRED TO USE THIS ITEM.`);
            }

            let message = "";

            // Key Logic: Check if Dungeon is already cleared
            if (itemData.type === 'KEY' && effects.unlocks_dungeon) {
                const dungeonIdentifier = effects.unlocks_dungeon;
                const searchTerm = dungeonIdentifier.replace(/_/g, ' '); // 'hapjeong_subway' -> 'hapjeong subway'

                // Check History (quest_logs)
                const logsRes = await db.queryOne<{ count: string }>(
                    "SELECT COUNT(*) as count FROM quest_logs WHERE user_id = $1 AND quest_title ILIKE $2",
                    [user.id, `%${searchTerm}%`]
                );
                const completedCount = parseInt(logsRes?.count || '0');

                if (completedCount > 0) {
                    throw new Error(`Dungeon '${searchTerm}' already cleared.`);
                }

                // Check Active Quests (Completed state)
                const questsRes = await db.queryOne<{ count: string }>(
                    `SELECT COUNT(*) as count
                 FROM user_quests uq
                 JOIN quests q ON uq.quest_id = q.id
                 WHERE uq.user_id = $1 AND uq.status = 'Complete' AND q.title ILIKE $2`,
                    [user.id, `%${searchTerm}%`]
                );
                const activeCompletedCount = parseInt(questsRes?.count || '0');

                if (activeCompletedCount > 0) {
                    throw new Error(`Dungeon '${searchTerm}' already cleared.`);
                }
            }

            // 1.5 BOSS BATTLE TRIGGER (If Key)
            if (itemData.type === 'KEY') {
                const dungeonId = effects?.unlocks_dungeon || '';
                const itemName = itemData.name;

                let bossSearch = '';
                // Map Keys to Bosses
                if (itemName.includes('S+-Rank')) bossSearch = 'Baran';
                else if (itemName.includes('XX-Rank')) bossSearch = 'Ashborn';
                else if (dungeonId === 'hapjeong_subway' || itemName.includes('C-Rank')) bossSearch = 'Kasaka';
                else if (itemName.includes('D-Rank')) bossSearch = 'Golem';
                else if (itemName.includes('E-Rank')) bossSearch = 'Wolf';
                else if (dungeonId === 'demon_castle' || itemName.includes('B-Rank')) bossSearch = 'Cerberus';
                else if (dungeonId === 'jeju_island' || itemName.includes('S-Rank')) bossSearch = 'Beru';
                else if (itemName.includes('A-Rank')) bossSearch = 'Igris';

                if (bossSearch) {
                    const boss = await db.queryOne<{ id: string }>(
                        "SELECT id FROM bosses WHERE name ILIKE $1 LIMIT 1",
                        [`%${bossSearch}%`]
                    );

                    if (boss) {
                        // Start Battle (Skip Key Check because we are consuming it right here)
                        const result = await startBossBattle(user, boss.id, true);

                        // Consume the key manually here since we skipped automatic check
                        if (invItem.quantity > 1) {
                            await db.query("UPDATE inventory SET quantity = quantity - 1 WHERE id = $1", [id]);
                        } else {
                            await db.query("DELETE FROM inventory WHERE id = $1", [id]);
                        }

                        revalidatePath("/dashboard", "layout");
                        return { message: result.message || "GATE OPENED" };
                    }
                }
            }

            // 3. Apply Effects (Remaining Logic)
            const profileUpdates: Record<string, any> = {};

            const baseStats = {
                strength: Number(currentStats.strength) || 0,
                agility: Number(currentStats.agility) || 0,
                intelligence: Number(currentStats.intelligence) || 0,
                vitality: Number(currentStats.vitality) || 0,
                perception: Number(currentStats.perception) || 0
            };
            const hClass = profile.hunter_class || 'NONE';
            const crystallizedStats = currentStats.crystallized_stats || {};
            const prestigeLevel = profile.prestige_level || 0;

            const effectiveStats = StatsManager.calculateEffectiveStats(baseStats, modifiers, statusEffects, hClass, crystallizedStats);

            // Helper: Calculate Rank-Based Scaling %
            // E: 10%, D: 15%, C: 20%, B: 30%, A: 50%, S: 100%
            const getRarityScaling = (rarity: string) => {
                const scale: Record<string, number> = { 'E': 10, 'D': 15, 'C': 20, 'B': 30, 'A': 50, 'S': 100 };
                return scale[rarity] || 5; // Default 5%
            };

            const rarityBonusPercent = getRarityScaling(itemData.rarity as string);

            if (effects.heal_hp || effects.heal_hp_percent) {
                const maxHp = StatsManager.calculateMaxHP(effectiveStats.vitality, effectiveStats.strength, profile.level, modifiers, hClass, prestigeLevel);
                const currentHp = profile.current_hp || 0;

                const flatHeal = effects.heal_hp || 0;
                // Native percent OR Rarity Scale if flat exists
                const basePercent = effects.heal_hp_percent || (flatHeal > 0 ? rarityBonusPercent : 0);

                const percentHeal = Math.floor(maxHp * (basePercent / 100));
                const totalHeal = applyHealingReceivedBonus(flatHeal + percentHeal, modifiers);

                const newHp = Math.min(maxHp, currentHp + totalHeal);
                const recoveredProxy = newHp - currentHp;

                profileUpdates.current_hp = newHp;
                if (recoveredProxy > 0) message += `Recovered ${recoveredProxy} HP. `;
                else message += `Already at Max HP. `;
            }
            if (effects.heal_mana || effects.heal_mana_percent) {
                const maxMana = StatsManager.calculateMaxMana(effectiveStats.intelligence, profile.level, modifiers, hClass, prestigeLevel);
                const currentMana = profile.current_mana || 0;

                const flatHeal = effects.heal_mana || 0;
                // Native percent OR Rarity Scale if flat exists
                const basePercent = effects.heal_mana_percent || (flatHeal > 0 ? rarityBonusPercent : 0);

                const percentHeal = Math.floor(maxMana * (basePercent / 100));
                const totalHeal = flatHeal + percentHeal;

                const newMana = Math.min(maxMana, currentMana + totalHeal);
                const recoveredProxy = newMana - currentMana;

                profileUpdates.current_mana = newMana;
                if (recoveredProxy > 0) message += `Recovered ${recoveredProxy} Mana. `;
                else message += `Already at Max Mana. `;
            }

            if (effects.respec) {
                const level = profile.level || 1;
                const totalApRefund = (level - 1) * 5;
                const totalSpRefund = (level - 1) * 1;

                // 1. Reset Stats (Primary stats only)
                await db.query(
                    "UPDATE hunter_stats SET strength = 10, agility = 10, intelligence = 10, vitality = 10, perception = 10 WHERE user_id = $1",
                    [user.id]
                );

                // 2. Wipe Skills
                await db.query("DELETE FROM user_skills WHERE user_id = $1", [user.id]);

                // 3. Prep Profile Updates (Class, AP & SP)
                profileUpdates.hunter_class = null;
                profileUpdates.available_ap = totalApRefund;
                profileUpdates.available_sp = totalSpRefund;

                // 4. Sync derived stats (Max HP/Mana) after base stat reset
                await recalculateAndClampPlayerStats(user.id);

                message += "Reincarnation Complete: Your Class, Stats, and Skills have been reset. ";
            }

            // --- CURE EFFECTS ---
            let currentEffects = profile.status_effects || [];
            const originalCount = currentEffects.length;

            if (effects.cure_status || effects.cure_disease) {
                if (effects.cure_disease) {
                    // Holy Water/Greater items clear EVERYTHING
                    currentEffects = [];
                    if (originalCount > 0) message += "Cleanse: All ailments cured. ";
                } else if (effects.cure_status) {
                    // Antidotes clear all negative statuses specifically (preserving buffs like FOCUS)
                    const negativeTypes = ['MIASMA', 'POISON', 'EXHAUSTION', 'CURSE', 'LETHARGY'];
                    currentEffects = currentEffects.filter((e: any) => !negativeTypes.includes(e.type));
                    if (currentEffects.length < originalCount) message += "Treatment: Negative effects cleared. ";
                }
            }

            // --- XP REWARDS ---
            if (effects.xp) {
                await awardXp(user.id, effects.xp);
                message += `Consumed experience: +${effects.xp} XP. `;
            }

            // --- COSMIC ESSENCE REWARDS ---
            if (effects.cosmic_essence) {
                profileUpdates.cosmic_essence = (Number(profile.cosmic_essence) || 0) + effects.cosmic_essence;
                message += `Obtained Cosmic Essence: +${effects.cosmic_essence}. `;
            }


            // --- STREAK RESTORATION ---
            if (effects.streak_restore) {
                const syncTime = new Date().toISOString();
                // 1. Recovery: satisfy the daily habit target (3 logs)
                await db.query(`
                INSERT INTO habit_logs (user_id, habit_name, completed_at)
                VALUES ($1, 'ESSENCE_OF_ARISE_SYNC_1', $2),
                       ($1, 'ESSENCE_OF_ARISE_SYNC_2', $2),
                       ($1, 'ESSENCE_OF_ARISE_SYNC_3', $2)
            `, [user.id, syncTime]);

                // 2. Cleanup: Remove any active status penalties or expired warning quests
                await db.query(`
                DELETE FROM quests
                WHERE user_id = $1 AND type = 'System' AND title ILIKE 'PENALTY%'
            `, [user.id]);

                // 3. Condition: Force clear Burnout/Neglect effects
                const cleanupTypes = ['MIASMA', 'EXHAUSTION'];
                currentEffects = currentEffects.filter((e: any) => !cleanupTypes.includes(e.type));

                message += "Arise: Condition stabilized and Daily Duty synced. ";
            }

            // --- APPLY STATUS EFFECTS ---
            if (effects.apply_status_effects && effects.apply_status_effects.length > 0) {
                effects.apply_status_effects.forEach((effType: string) => {
                    const def = (STATUS_EFFECT_DEFINITIONS as any)[effType];
                    if (def) {
                        // Check if already active
                        const existingIdx = currentEffects.findIndex((e: any) => e.type === effType);
                        const newEff = { ...def, applied_at: new Date().toISOString() };

                        if (existingIdx !== -1) {
                            currentEffects[existingIdx] = newEff; // Refresh
                        } else {
                            // MUTUAL EXCLUSIVITY: FOCUS vs LETHARGY
                            if (effType === 'FOCUS') {
                                currentEffects = currentEffects.filter((e: any) => e.type !== 'LETHARGY');
                            } else if (effType === 'LETHARGY') {
                                currentEffects = currentEffects.filter((e: any) => e.type !== 'FOCUS');
                            }
                            currentEffects.push(newEff);
                        }
                        message += `Applied effect: ${def.name}. `;
                    }
                });
            }

            // --- PERMANENT STAT INCREASES ---
            const statsToUpdate: Record<string, number> = {};
            const statKeys = ['strength', 'agility', 'intelligence', 'vitality', 'perception'] as const;

            statKeys.forEach(key => {
                if (typeof (effects as any)[key] === 'number' && (effects as any)[key]! > 0) {
                    statsToUpdate[key] = (Number(currentStats[key]) || 0) + (effects as any)[key]!;
                }
            });

            if (Object.keys(statsToUpdate).length > 0) {
                // LORE BALANCE: Per-Item Vessel Adaptation Check (30 Day Cooldown)
                // Tracking is now per specific item (e.g. Strength Elixir B)
                const integrationLog = (profile.last_permanent_stat_at || {}) as Record<string, any>;
                const itemKey = invItem.item_id; // Use item_id as unique key
                const now = new Date();

                const lastUsageEntry = integrationLog[itemKey];
                if (lastUsageEntry) {
                    const lastDate = new Date(typeof lastUsageEntry === 'string' ? lastUsageEntry : lastUsageEntry.applied_at);
                    const diffDays = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

                    if (diffDays < 30) {
                        const remaining = Math.ceil(30 - diffDays);
                        throw new Error(`[VESSEL ADAPTATION ERROR]: Your vessel is still integrating the properties of ${itemData.name}. Integration Remaining: ${remaining} Days.`);
                    }
                }

                const keys = Object.keys(statsToUpdate);
                const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
                const values = keys.map(k => statsToUpdate[k]);

                await db.query(
                    `UPDATE hunter_stats SET ${setClause} WHERE user_id = $1`,
                    [user.id, ...values]
                );

                // Update individual item entry in Integration Log (New format: {name, applied_at})
                const newLog = { ...integrationLog };
                newLog[itemKey] = {
                    name: itemData.name,
                    applied_at: now.toISOString()
                };

                keys.forEach(k => {
                    message += `Permanently increased ${k.toUpperCase()} by ${(effects as any)[k]}. `;
                });
                profileUpdates.last_permanent_stat_at = JSON.stringify(newLog) as any;
            }

            if (invItem.quantity > 1) {
                await db.query("UPDATE inventory SET quantity = quantity - 1 WHERE id = $1", [id]);
            } else {
                await db.query("DELETE FROM inventory WHERE id = $1", [id]);
            }

            // Apply Profile Updates (HP/Mana AND Status Effects)
            const updateEntries = Object.entries(profileUpdates);
            const updateParams = [user.id, ...updateEntries.map(e => e[1]), JSON.stringify(currentEffects)];
            const setClause = updateEntries.map((e, i) => `${e[0]} = $${i + 2}`).join(", ");

            await db.query(
                `UPDATE profiles SET ${setClause}${setClause ? ', ' : ''}status_effects = $${updateParams.length} WHERE id = $1`,
                updateParams
            );

            if (itemData.type === 'KEY') {
                if (!message) message = `Used ${itemData.name}. Instance Dungeon is now available.`;
            }

            revalidatePath("/dashboard", "layout");
            revalidatePath("/dashboard/inventory");
            return { message: message.trim() };
        });
    });
}

export async function quickUsePotionAction(type: 'HP' | 'MP') {
    return safeAction(z.enum(['HP', 'MP']), type, async (potionType) => {
        const user = await getAuthenticatedUser();

        // 1. Fetch user level and all consumables in inventory
        const [profile, inventoryRows] = await Promise.all([
            db.queryOne<any>("SELECT level FROM profiles WHERE id = $1", [user.id]),
            db.query<any>(`
                SELECT i.id as inventory_id, i.quantity, it.name, it.rarity, it.effect
                FROM inventory i
                JOIN items it ON i.item_id = it.id
                WHERE i.user_id = $1 AND it.type = 'CONSUMABLE' AND i.quantity > 0
            `, [user.id])
        ]);

        if (!profile) throw new Error("Profile not found");
        const userLevel = profile.level || 1;

        // 2. Filter for applicable potions
        // A potion is applicable if it heals the requested stat AND we meet the level req.
        const applicablePotions: any[] = [];

        for (const row of inventoryRows.rows) {
            const effectParse = ItemEffectSchema.safeParse(row.effect);
            if (!effectParse.success) continue;

            const effects = effectParse.data;
            const requiredLevel = effects.level_required || 0;

            if (requiredLevel > userLevel) continue; // Cannot use

            let healingValue = 0;
            if (potionType === 'HP' && (effects.heal_hp || effects.heal_hp_percent)) {
                healingValue = (effects.heal_hp || 0) + (effects.heal_hp_percent || 0) * 10; // Rough heuristic for sorting
            } else if (potionType === 'MP' && (effects.heal_mana || effects.heal_mana_percent)) {
                healingValue = (effects.heal_mana || 0) + (effects.heal_mana_percent || 0) * 10;
            }

            if (healingValue > 0) {
                applicablePotions.push({
                    inventoryId: row.inventory_id,
                    name: row.name,
                    healingValue: healingValue,
                    rarity: row.rarity
                });
            }
        }

        if (applicablePotions.length === 0) {
            throw new Error(`No usable ${potionType} potions found in your inventory.`);
        }

        // 3. Sort to find the "cheapest" (lowest healing value)
        applicablePotions.sort((a, b) => a.healingValue - b.healingValue);

        const chosenPotion = applicablePotions[0];

        // 4. Consume the chosen potion using the existing action
        const consumeResult = await consumeItemAction(chosenPotion.inventoryId);

        if (consumeResult.error) {
            throw new Error(consumeResult.error);
        }

        return { message: consumeResult.data?.message || `Used ${chosenPotion.name}` };
    });
}

export async function sellItemAction(inventoryId: number | string) {
    return safeAction(z.union([z.number(), z.string()]).transform(val => typeof val === 'string' ? parseInt(val, 10) : val), inventoryId, async (id) => {
        const user = await getAuthenticatedUser();

        // 1. Fetch Item Details
        const invItem = await db.queryOne<any>(`
            SELECT i.id, i.quantity, i.equipped, i.purchased_price,
                   it.id as item_id, it.name as item_name, it.price as item_price
            FROM inventory i
            JOIN items it ON i.item_id = it.id
            WHERE i.id = $1 AND i.user_id = $2
        `, [id, user.id]);

        if (!invItem || invItem.quantity < 1) throw new Error("Item unavailable");

        if (invItem.equipped) {
            throw new Error("Cannot sell equipped item. Unequip it first.");
        }

        // 2. Fetch User Profile
        const profile = await db.queryOne<any>("SELECT gold_credits FROM profiles WHERE id = $1", [user.id]);
        if (!profile) throw new Error("Profile not found");

        const basePrice = invItem.item_price || 0;
        const purchasedPrice: number | null = invItem.purchased_price ?? null;

        // Logic: 15% Base Sell Value, with minimum sell of 1 Gold for items with price > 0.
        let sellValue = Math.floor(basePrice * 0.15);
        if (basePrice > 0 && sellValue < 1) sellValue = 1;

        // Exploit Guard: Never allow selling back for more than the purchase price.
        // purchased_price is set when buying from the store (reflects any discounts applied).
        // Items obtained via loot have purchased_price = NULL and are not affected.
        if (purchasedPrice !== null && sellValue > purchasedPrice) {
            sellValue = purchasedPrice;
        }

        // 3. Add Gold
        await db.query("UPDATE profiles SET gold_credits = $1 WHERE id = $2", [Number(profile.gold_credits || 0) + sellValue, user.id]);

        // 4. Remove Item (Decrement)
        if (invItem.quantity > 1) {
            await db.query("UPDATE inventory SET quantity = quantity - 1 WHERE id = $1", [id]);
        } else {
            await db.query("DELETE FROM inventory WHERE id = $1", [id]);
        }

        revalidatePath("/dashboard", "layout");
        revalidatePath("/dashboard/inventory");

        // AUDIT LOG
        await logTransaction(user.id, "SELL_ITEM", { gold: sellValue }, { itemId: invItem.item_id, itemName: invItem.item_name });

        return { message: `Sold ${invItem.item_name} for ${sellValue} Gold`, goldEarned: sellValue };
    });
}
