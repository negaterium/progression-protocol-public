"use server";

import { z } from "zod";
import { safeAction } from "@/lib/action-utils";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { completeQuest } from "@/lib/server/quest-completion";

export async function completeQuestAction(input: { questId: string; xpReward: number }) {
    return safeAction(
        z.object({ questId: z.string().min(1), xpReward: z.number().finite() }).strict(),
        input,
        async ({ questId }) => completeQuest(await getAuthenticatedUser(), questId)
    );
}
