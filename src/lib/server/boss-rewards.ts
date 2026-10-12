import type { AuthenticatedUser } from "@/lib/auth-utils";
import { gameDb as db, withGameTransaction } from "./game-db";
import { awardXp } from "./xp-rewards";
import { calculateGlobalRewardMultiplier, rankValue, isPostCap } from "@/lib/system/formula";
import { getBossKeyDropChance, getBossKeySuffix } from "@/lib/system/rank-constants";
import { rollItemQuality, applyQualityToEffect } from "@/lib/game-logic/item-roller";
import { BOSS_LOOT_TABLE } from "@/lib/game-logic/boss-loot";
import { logTransaction } from "./audit";
import { AchievementManager } from "@/lib/achievement-manager";

export const RANK_REWARDS: Record<string, { xp: number, gold: number }> = {
    "E": { xp: 100, gold: 200 },
    "D": { xp: 250, gold: 500 },
    "C": { xp: 500, gold: 1000 },
    "B": { xp: 1000, gold: 5000 },
    "A": { xp: 2500, gold: 20000 },
    "S": { xp: 5000, gold: 100000 },
    "S+": { xp: 10000, gold: 500000 },   // Monarchs
    "XX": { xp: 20000, gold: 1000000 }, // Gods
    "COSMIC": { xp: 100000, gold: 5000000 }, // Cosmic Entities — Post-999 Only
};

export async function awardBossRewards(user: AuthenticatedUser, bossId: string, encounterId?: string) {
    const userId = user.id;
    return withGameTransaction(userId, async () => {
        const encounter = await db.queryOne<{ id: string }>(
            `SELECT id FROM active_encounters WHERE user_id = $1 AND boss_id = $2
             AND status = 'ACTIVE' AND current_hp <= 0 AND ($3::text IS NULL OR id::text = $3) FOR UPDATE`,
            [userId, bossId, encounterId || null]
        );
        if (!encounter) throw new Error("No defeated active encounter available for rewards.");
        // 1. Fetch Boss
        const boss = await db.queryOne<any>("SELECT * FROM bosses WHERE id = $1", [bossId]);
        if (!boss) throw new Error("Boss not found during reward grant");

        // 2. Fetch Profile for Scaling
        const profile = await db.queryOne<{ level: number, gold_credits: number, hunter_rank: string, auto_sell_junk: boolean }>(
            "SELECT level, gold_credits, hunter_rank, auto_sell_junk FROM profiles WHERE id = $1", [userId]
        );
        const level = profile?.level || 1;
        const userRank = profile?.hunter_rank || 'E';
        const autoSellJunk = profile?.auto_sell_junk || false;
        const playerIsPostCap = isPostCap(level);
        const isCosmicBoss = (boss.rank as string) === 'COSMIC';

        // 3. Determine Dynamic Rewards
        const baseRewards = RANK_REWARDS[boss.rank as string] || RANK_REWARDS['C'];

        // Scaling Logic: Base * (1 + Level/20)
        const multiplier = calculateGlobalRewardMultiplier(level);

        // POST-999 MECHANIC: Quest XP doubles when player is at/above level cap
        const postCapXpMult = playerIsPostCap ? 2.0 : 1.0;
        const finalXp = Math.floor(baseRewards.xp * multiplier * postCapXpMult);

        if (playerIsPostCap) {
            console.log(`[Boss Rewards] POST-CAP: 2x XP applied. Final XP: ${finalXp}`);
        }

        // Equipment Gold Bonus
        const eqRes = await db.query<{ effect: any }>(`
            SELECT i.effect FROM inventory inv
            JOIN items i ON inv.item_id = i.id
            WHERE inv.user_id = $1 AND inv.equipped = true
        `, [userId]);
        const goldBonusMult = eqRes.rows.reduce((mult, e) => mult * (1 + (e.effect?.gold_bonus || 0)), 1);
        let finalGold = Math.floor(baseRewards.gold * multiplier * goldBonusMult);

        console.log(`[Boss Rewards] User Level ${level} -> Multiplier ${multiplier.toFixed(2)}x. XP: ${baseRewards.xp} -> ${finalXp}`);

        // 4. Loot Generation
        const lootTable = BOSS_LOOT_TABLE[boss.name] || [];
        const droppedItems: Record<string, unknown>[] = [];

        for (const entry of lootTable) {
            if (Math.random() <= entry.chance) {
                let item = await db.queryOne<any>("SELECT * FROM items WHERE name = $1", [entry.itemName]);

                if (item) {
                    // [SELF-HEALING] Fix 0-price items on the fly
                    if (!item.price || item.price <= 0) {
                        const rarity = (item.rarity || 'E').split('-')[0].trim().toUpperCase();
                        const PRICE_DEFAULTS: Record<string, number> = {
                            'E': 100, 'D': 500, 'C': 2500, 'B': 10000,
                            'A': 50000, 'S': 250000, 'SS': 500000
                        };
                        const newPrice = PRICE_DEFAULTS[rarity] || 1000;

                        console.warn(`[Boss Loot] Auto-fixing 0-price item: ${item.name} -> ${newPrice} G`);
                        await db.query("UPDATE items SET price = $1 WHERE id = $2", [newPrice, item.id]);
                        item.price = newPrice;
                    }

                    // --- Consumable Rank Floor for Bosses ---
                    if (item.type === 'CONSUMABLE') {
                        const userRankVal = rankValue(userRank);
                        const itemRankVal = rankValue(item.rarity);
                        const floorRankVal = Math.max(itemRankVal, userRankVal - 2);
                        const floorRanks = ['E', 'D', 'C', 'B', 'A', 'S'];
                        const targetRarity = floorRanks[floorRankVal - 1] || 'E';

                        if (targetRarity !== item.rarity) {
                            // Try to find a better version of the same type (Health/Mana)
                            const isMana = item.name.toLowerCase().includes('mana') || (item.effect?.heal_mana || item.effect?.heal_mana_percent);
                            const potionType = isMana ? 'MP Potion' : 'HP Potion';
                            const betterItem = await db.queryOne<any>(
                                "SELECT * FROM items WHERE type = 'CONSUMABLE' AND name LIKE $1 AND rarity = $2 LIMIT 1",
                                [`%${potionType}%`, targetRarity]
                            );
                            if (betterItem) {
                                console.log(`[Boss Loot] Rank-Shift: ${item.name} (${item.rarity}) -> ${betterItem.name} (${betterItem.rarity})`);
                                item = betterItem;
                            }
                        }
                    }

                    // Apply Level Restrictions
                    if (item.rarity === 'S' && level < 40) {
                        console.log(`[Boss Loot] SKIPPED ${item.name} - Level ${level} too low for S-Rank`);
                        continue;
                    }

                    if (item.name === 'Ring of the Monarch' && level < 100) {
                        console.log(`[Boss Loot] SKIPPED ${item.name} - Level ${level} too low for Ring of the Monarch`);
                        continue;
                    }

                    // === BOSS QUALITY ROLL SYSTEM ===
                    // Boss drops get enhanced quality (+10% floor, better affix chances)
                    let qualityPercent = 100.0;
                    let rollTier = 'COMMON';
                    let bonusAffixes: string[] = [];

                    // Fetch player's Luck stat for quality bonus
                    const userStats = await db.queryOne<{ luck: number, perception: number }>(
                        "SELECT luck, perception FROM hunter_stats WHERE user_id = $1",
                        [userId]
                    );
                    const totalLuck = (userStats?.luck || 0) + (userStats?.perception || 0);

                    if (item.type !== 'CONSUMABLE' && item.type !== 'KEY') {
                        const roll = rollItemQuality(
                            item.rarity,
                            totalLuck,
                            true,          // Boss drop = better quality floor
                            isCosmicBoss   // Cosmic boss = COSMIC tier quality range
                        );
                        qualityPercent = roll.qualityPercent;
                        rollTier = roll.rollTier;
                        bonusAffixes = roll.bonusAffixes;
                    }

                    // 5. Add to Inventory with Quality Data
                    const isStackable = item.type === 'CONSUMABLE' || item.type === 'KEY';

                    const existing = isStackable
                        ? await db.queryOne<{ id: number, quantity: number }>(`
                            SELECT id, quantity FROM inventory
                            WHERE user_id = $1 AND item_id = $2
                        `, [userId, item.id])
                        : null;

                    let shouldAutoSell = false;
                    if (autoSellJunk && !isStackable) {
                        const rarityChar = item.rarity.charAt(0).toUpperCase();
                        if (['E', 'D', 'C'].includes(rarityChar) && ['ARMOR', 'WEAPON', 'ACCESSORY', 'EQUIPMENT'].includes(item.type)) {
                            shouldAutoSell = true;
                        }
                    }

                    try {
                        let resultingInventoryId: number = -1;

                        if (shouldAutoSell) {
                            const sellValue = Math.floor((item.price || 100) * 0.15) * entry.quantity;
                            finalGold += sellValue; // Award gold safely since boss updates gold below

                            const scaledEffect = applyQualityToEffect(
                                item.effect || {},
                                { qualityPercent, rollTier: rollTier as any, bonusAffixes },
                                item.type,
                                item.slot
                            );

                            droppedItems.push({
                                ...item,
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
                            `, [Number(existing.quantity) + entry.quantity, existing.id]);
                            resultingInventoryId = existing.id;
                        } else {
                            // Equipment (with variance) OR new stackable stack
                            const insertRes = await db.query<{ id: number }>(`
                                INSERT INTO inventory (user_id, item_id, quantity, equipped, quality_roll, roll_tier, bonus_affixes)
                                VALUES ($1, $2, $3, false, $4, $5, $6)
                                RETURNING id
                            `, [userId, item.id, entry.quantity, qualityPercent, rollTier, JSON.stringify(bonusAffixes)]);
                            resultingInventoryId = insertRes.rows[0].id;
                        }

                        // Apply quality scaling to boss drop for client notifications
                        const scaledEffect = applyQualityToEffect(
                            item.effect || {},
                            { qualityPercent, rollTier: rollTier as any, bonusAffixes },
                            item.type,
                            item.slot
                        );

                        // Return item with quality-scaled effect
                        droppedItems.push({
                            ...item,
                            inventory_id: resultingInventoryId,
                            effect: scaledEffect,
                            quality_roll: qualityPercent,
                            roll_tier: rollTier,
                            bonus_affixes: bonusAffixes
                        });
                    } catch (dbErr: any) {
                        console.error("[Boss Loot] DB Error adding item:", dbErr.message);
                    }
                }
            }
        }

        // === BOSS KEY DROP MECHANIC (Same-Level Key: 100% for S/S+/XX/COSMIC, ≥70% for lower) ===
        const keyDropChance = getBossKeyDropChance(boss.rank);
        if (Math.random() <= keyDropChance) {
            // Always drop a key corresponding to the defeated boss's own rank tier (same level)
            const keySuffix = getBossKeySuffix(boss.rank);
            const keyName = `Instant Dungeon Key (${keySuffix})`;

            const keyItem = await db.queryOne<any>("SELECT * FROM items WHERE name = $1 AND type = 'KEY'", [keyName]);
            if (keyItem) {
                const existingKey = await db.queryOne<{ id: number, quantity: number }>(`
                    SELECT id, quantity FROM inventory WHERE user_id = $1 AND item_id = $2
                `, [userId, keyItem.id]);

                let keyInvId: number = -1;
                if (existingKey) {
                    await db.query(`
                        UPDATE inventory
                        SET quantity = quantity + 1, quality_roll = 100.0, roll_tier = 'COMMON', bonus_affixes = '[]'
                        WHERE id = $1
                    `, [existingKey.id]);
                    keyInvId = existingKey.id;
                } else {
                    const insertKey = await db.query<{ id: number }>(`
                        INSERT INTO inventory (user_id, item_id, quantity, equipped, quality_roll, roll_tier, bonus_affixes)
                        VALUES ($1, $2, 1, false, 100.0, 'COMMON', '[]')
                        RETURNING id
                    `, [userId, keyItem.id]);
                    keyInvId = insertKey.rows[0].id;
                }

                console.log(`[Boss Loot] Key Drop! Granted: ${keyName} to user ${userId} (Boss Rank: ${boss.rank}, Drop Chance: ${(keyDropChance * 100).toFixed(0)}%)`);
                droppedItems.push({
                    ...keyItem,
                    inventory_id: keyInvId,
                    quality_roll: 100.0,
                    roll_tier: 'COMMON',
                    bonus_affixes: []
                });
            }
        }

        // 5. Update Boss Status (Legacy/Lore)
        // Defeat belongs to this encounter; shared boss definitions stay unchanged.

        // 6. Award Gold
        if (profile) {
            await db.query("UPDATE profiles SET gold_credits = gold_credits + $1 WHERE id = $2", [finalGold, userId]);
        }

        // 7. Award XP
        await awardXp(userId, finalXp);
        await db.query("UPDATE active_encounters SET status = 'DEFEATED' WHERE id = $1", [encounter.id]);

        // Trigger Achievement Check (Boss Kill)
        try {
            const achievementManager = new AchievementManager();
            await achievementManager.checkAchievements(userId, 'BOSS_KILL', { bossName: boss.name });
        } catch (err) {
            console.error("Boss Defeat Achievement Check Failed:", err);
        }

        // 8. SHADOW EXTRACTION CHECK (Auto-trigger)
        let shadowParams: any = { extracted: false, message: "" };
        try {
            // Dynamic import to avoid circular dependency
            const { extractShadow } = await import("./shadow-extraction");
            const shadowRes = await extractShadow(user, { bossId, source: 'BOSS' });

            console.log(`[Shadow Extraction] Result for Boss ${boss.name}:`, shadowRes);

            if (shadowRes?.success) {
                shadowParams = { extracted: true, message: "SHADOW EXTRACTED" };
                console.log(`[Shadow Extraction] SUCCESS: ${boss.name} extracted.`);
            } else {
                console.log(`[Shadow Extraction] SKIP: ${shadowRes?.reason || 'Unknown reason'}`);
            }
        } catch (err) {
            console.error("[Shadow Extraction] Failed auto-extract:", err);
        }

        // AUDIT LOG
        await logTransaction(userId, "BOSS_DEFEAT", { xp: finalXp, gold: finalGold }, { bossId, bossName: boss.name, base_xp: baseRewards.xp, multiplier });

        return {
            xp: finalXp,
            gold: finalGold,
            drops: droppedItems.filter((i: any) => !i.auto_sold),
            bossName: boss.name,
            bossImage: boss.image_url,
            bossRank: boss.rank,
            bossDescription: boss.description,
            bossIntel: boss.intel,
            bossDamageType: boss.damage_type,
            shadowExtracted: shadowParams.extracted
        };
    });
}
