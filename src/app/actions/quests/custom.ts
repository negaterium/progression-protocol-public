"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { safeAction } from "@/lib/action-utils";
import { z } from "zod";
import db from "@/lib/db";

const CUSTOM_QUEST_REWARDS: Record<string, { xp: number, mana: number }> = {
    'E': { xp: 100, mana: 50 },
    'D': { xp: 250, mana: 150 },
    'C': { xp: 600, mana: 400 },
    'B': { xp: 1200, mana: 800 },
    'A': { xp: 2000, mana: 1500 },
    'S': { xp: 3500, mana: 2500 },
};

const CustomQuestSchema = z.object({
    title: z.string().min(3).max(100),
    difficulty: z.enum(['E', 'D', 'C', 'B', 'A', 'S']),
    frequency: z.enum(['Daily', 'Once']),
    description: z.string().optional(),
    zoneId: z.string().optional(),
});

export async function createCustomQuestAction(input: {
    title: string;
    difficulty: string;
    frequency: string;
    description?: string;
    zoneId?: string;
}) {
    return safeAction(CustomQuestSchema, input, async ({ title, difficulty, frequency, description, zoneId }) => {
        const user = await getAuthenticatedUser();
        const reward = CUSTOM_QUEST_REWARDS[difficulty] || CUSTOM_QUEST_REWARDS['E'];

        await db.transaction(async (client) => {
            const questRes = await client.query<{ id: string }>(
                `INSERT INTO quests (title, description, type, difficulty, frequency, xp_reward, mana_cost, gold_reward, user_id, zone_id)
                 VALUES ($1, $2, 'CUSTOM', $3, $4, $5, $6, 0, $7, $8)
                 RETURNING id`,
                [title, description || "User defined personal goal.", difficulty, frequency, reward.xp, reward.mana, user.id, zoneId]
            );
            await client.query(
                `INSERT INTO user_quests (user_id, quest_id, status) VALUES ($1, $2, 'Active')`,
                [user.id, questRes.rows[0].id]
            );
        });

        revalidatePath("/dashboard/quests");
        revalidatePath("/dashboard/profile");
        return { success: true };
    });
}

export async function updateCustomQuestAction(input: {
    questId: string;
    title: string;
    difficulty: string;
    frequency: string;
    description?: string;
    zoneId?: string;
}) {
    return safeAction(
        CustomQuestSchema.extend({ questId: z.string() }),
        input,
        async ({ questId, title, difficulty, frequency, description, zoneId }) => {
            const user = await getAuthenticatedUser();

            const quest = await db.queryOne<{ id: string, user_id: string, type: string }>(
                "SELECT id, user_id, type FROM quests WHERE id = $1",
                [questId]
            );
            if (!quest) throw new Error("Quest not found");
            if (quest.user_id !== user.id) throw new Error("Unauthorized: You do not own this quest.");
            if (quest.type !== 'CUSTOM') throw new Error("Only Custom Quests can be edited.");

            const reward = CUSTOM_QUEST_REWARDS[difficulty] || CUSTOM_QUEST_REWARDS['E'];
            await db.query(
                `UPDATE quests SET title = $1, difficulty = $2, frequency = $3, xp_reward = $4, mana_cost = $5, description = $6, zone_id = $7 WHERE id = $8`,
                [title, difficulty, frequency, reward.xp, reward.mana, description, zoneId, questId]
            );

            revalidatePath("/dashboard/quests");
            revalidatePath("/dashboard/profile");
            return { success: true };
        }
    );
}
