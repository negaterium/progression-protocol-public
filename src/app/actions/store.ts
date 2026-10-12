"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { logTransaction } from "@/lib/server/audit";
import { gameDb as db, withGameTransaction } from "@/lib/server/game-db";
import { safeAction } from "@/lib/action-utils";
import { z } from "zod";
import { getServerPlayerContext } from "@/lib/server/stats-loader";
import { StatsManager } from "@/lib/stats-manager";

export async function purchaseItemAction(itemId: number | string, quantity: number = 1) {
    const response = await safeAction(z.object({
        itemId: z.union([z.string().min(1).max(128), z.number().int().positive()]),
        quantity: z.number().int().min(1).max(1000),
    }).strict(), { itemId, quantity }, async ({ itemId, quantity }) => {
        const user = await getAuthenticatedUser();
        return withGameTransaction(user.id, async () => {

            if (quantity < 1) throw new Error("Invalid quantity");

            // 1. Fetch Item Details
            const item = await db.queryOne<{ id: number, price: number, name: string, rarity: string, type: string }>(
                "SELECT id, price, name, rarity, type FROM items WHERE id = $1",
                [itemId]
            );

            if (!item || !Number.isFinite(Number(item.price)) || Number(item.price) <= 0) {
                throw new Error("Item is not available in the store");
            }

            // 2. Fetch User Profile
            const profile = await db.queryOne<{ gold_credits: number, level: number }>(
                "SELECT gold_credits, level FROM profiles WHERE id = $1",
                [user.id]
            );

            if (!profile) throw new Error("Profile not found");

            const userLevel = profile.level || 1;

            // 3. Level Restrictions
            if (item.rarity === 'S' && userLevel < 40) {
                throw new Error(`SYSTEM RESTRICTION: S-Rank items require Level 40. Current: ${userLevel}`);
            }

            if (item.rarity === 'S+' && userLevel < 80) {
                throw new Error(`SYSTEM RESTRICTION: S+-Rank items require Level 80. Current: ${userLevel}`);
            }

            if (item.rarity === 'XX' && userLevel < 90) {
                throw new Error(`SYSTEM RESTRICTION: XX-Rank items require Level 90. Current: ${userLevel}`);
            }

            if (item.rarity === 'COSMIC' && userLevel < 100) {
                throw new Error(`SYSTEM RESTRICTION: COSMIC-Rank items require Level 100. Current: ${userLevel}`);
            }

            if (item.name === 'Ring of the Monarch' && userLevel < 100) {
                throw new Error(`SYSTEM RESTRICTION: Ring of the Monarch requires Level 100. Current: ${userLevel}`);
            }

            const currentGold = Number(profile.gold_credits || 0);

            // Charisma Discount: 0.5% per point (max 50%)
            const ctx = await getServerPlayerContext(user.id);
            const effectiveStats = StatsManager.calculateEffectiveStats(
                ctx.stats,
                ctx.modifiers,
                ctx.statusEffects,
                ctx.profile.hunter_class
            );
            const totalCharisma = effectiveStats.charisma || 10;

            const discount = Math.min(0.50, (totalCharisma * 0.005));
            const unitPrice = Math.floor(Number(item.price) * (1 - discount));
            const totalPrice = unitPrice * quantity;
            if (currentGold < totalPrice) {
                throw new Error(`Insufficient Funds. Required: ${totalPrice.toLocaleString()}G, Current: ${currentGold.toLocaleString()}G`);
            }

            // 3. Deduct Gold
            await db.query(
                "UPDATE profiles SET gold_credits = $1 WHERE id = $2",
                [Number(currentGold) - totalPrice, user.id]
            );

            // 4. Add to Inventory
            const isStackable = item.type === 'CONSUMABLE' || item.type === 'KEY';

            const existingItem = isStackable
                ? await db.queryOne<{ id: string | number, quantity: number }>(
                    "SELECT id, quantity FROM inventory WHERE user_id = $1 AND item_id = $2",
                    [user.id, itemId]
                )
                : null;

            if (existingItem) {
                // Stackable items (pots/keys) - quality is always 100/Common
                // Also update purchased_price to reflect the most recently paid discounted price
                await db.query(`
                    UPDATE inventory
                    SET quantity = $1,
                        quality_roll = 100.0,
                        roll_tier = 'COMMON',
                        bonus_affixes = '[]',
                        purchased_price = $3
                    WHERE id = $2
                `, [Number(existingItem.quantity) + quantity, existingItem.id, unitPrice]);
            } else {
                // Equipment (with variance) OR new stackable stack
                // Store the actual discounted unit price paid to guard against sell-price exploits
                await db.query(`
                    INSERT INTO inventory (user_id, item_id, quantity, equipped, quality_roll, roll_tier, bonus_affixes, purchased_price)
                    VALUES ($1, $2, $3, false, 100.0, 'COMMON', '[]', $4)
                `, [user.id, itemId, quantity, unitPrice]);
            }

            await logTransaction(user.id, "PURCHASE_ITEM", { gold: -totalPrice }, { itemId, itemName: item.name, quantity });

            revalidatePath("/dashboard/store");
            revalidatePath("/dashboard"); // Update sidebar gold
            return { success: true, newGold: Number(currentGold) - totalPrice };
        });
    });
    if (!response.success) throw new Error(response.error);
    return response.data!;
}
