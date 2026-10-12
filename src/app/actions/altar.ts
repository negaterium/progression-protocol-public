"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { logTransaction } from "@/lib/server/audit";
import db from "@/lib/db";
import { recalculateAndClampPlayerStats } from "@/lib/server/user-stats";
import { z } from "zod";
import { safeAction } from "@/lib/action-utils";

const ALTAR_UPGRADES = {
    strength: { name: "Void Strength Infusion", cost: 5, type: "STAT", stat: "strength", amount: 5 },
    agility: { name: "Void Agility Infusion", cost: 5, type: "STAT", stat: "agility", amount: 5 },
    intelligence: { name: "Void Intelligence Infusion", cost: 5, type: "STAT", stat: "intelligence", amount: 5 },
    vitality: { name: "Void Vitality Infusion", cost: 5, type: "STAT", stat: "vitality", amount: 5 },
    perception: { name: "Void Perception Infusion", cost: 5, type: "STAT", stat: "perception", amount: 5 },
    luck: { name: "Eldritch Luck Blessing", cost: 8, type: "STAT", stat: "luck", amount: 10 },
    cosmic_power: { name: "Acausal Resilience Infusion", cost: 10, type: "COSMIC_POWER", amount: 250 },
    key_cosmic: { name: "Synthesize Cosmic Key", cost: 10, type: "ITEM", itemName: "Instant Dungeon Key (Cosmic)" },
    holy_water: { name: "Synthesize Holy Water", cost: 15, type: "ITEM", itemName: "Holy Water of Life" }
} as const;

export async function purchaseAltarUpgradeAction(upgradeId: string) {
    return safeAction(z.string(), upgradeId, async (id) => {
        const user = await getAuthenticatedUser();
        const upgrade = (ALTAR_UPGRADES as any)[id];

        if (!upgrade) {
            throw new Error("Invalid upgrade selection.");
        }

        // 1. Fetch player profile to check Cosmic Essence
        const profile = await db.queryOne<{ cosmic_essence: number }>(
            "SELECT cosmic_essence FROM profiles WHERE id = $1",
            [user.id]
        );

        if (!profile) {
            throw new Error("Profile not found.");
        }

        const currentEssence = Number(profile.cosmic_essence || 0);

        if (currentEssence < upgrade.cost) {
            throw new Error(`Insufficient Cosmic Essence. Required: ${upgrade.cost}, Current: ${currentEssence}`);
        }

        // 2. Process transaction based on upgrade type
        await db.transaction(async (client) => {
            // Deduct Cosmic Essence
            await client.query(
                "UPDATE profiles SET cosmic_essence = cosmic_essence - $1 WHERE id = $2",
                [upgrade.cost, user.id]
            );

            if (upgrade.type === "STAT") {
                // Add to base stats in hunter_stats
                await client.query(
                    `UPDATE hunter_stats SET ${upgrade.stat} = ${upgrade.stat} + $1 WHERE user_id = $2`,
                    [upgrade.amount, user.id]
                );
            } else if (upgrade.type === "COSMIC_POWER") {
                // Add to cosmic power in hunter_stats
                await client.query(
                    "UPDATE hunter_stats SET cosmic_power = cosmic_power + $1 WHERE user_id = $2",
                    [upgrade.amount, user.id]
                );
            } else if (upgrade.type === "ITEM") {
                // Fetch the item ID from DB
                const item = await client.query(
                    "SELECT id FROM items WHERE name = $1 LIMIT 1",
                    [upgrade.itemName]
                );

                if (item.rows.length === 0) {
                    throw new Error(`Item template for '${upgrade.itemName}' not found in database.`);
                }

                const itemId = item.rows[0].id;

                // Add to inventory (stackable type)
                const existing = await client.query(
                    "SELECT id, quantity FROM inventory WHERE user_id = $1 AND item_id = $2 LIMIT 1",
                    [user.id, itemId]
                );

                if (existing.rows.length > 0) {
                    await client.query(
                        "UPDATE inventory SET quantity = quantity + 1 WHERE id = $1",
                        [existing.rows[0].id]
                    );
                } else {
                    await client.query(
                        "INSERT INTO inventory (user_id, item_id, quantity, equipped, quality_roll, roll_tier, bonus_affixes) VALUES ($1, $2, 1, false, 100.0, 'COMMON', '[]')",
                        [user.id, itemId]
                    );
                }
            }
        });

        // 3. Recalculate stats and clamp health/mana (stat changes affect max health/mana)
        await recalculateAndClampPlayerStats(user.id);

        // 4. Log the transaction in audit logs
        await logTransaction(
            user.id,
            "ALTAR_UPGRADE",
            {},
            { upgradeId: id, upgradeName: upgrade.name, cosmic_essence: -upgrade.cost }
        );

        revalidatePath("/dashboard/inventory");
        revalidatePath("/dashboard");

        return {
            success: true,
            message: `Altar upgrade successful: ${upgrade.name}`
        };
    });
}
