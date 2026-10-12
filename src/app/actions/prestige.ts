
"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { safeAction } from "@/lib/action-utils";
import { z } from "zod";
import { recalculateAndClampPlayerStats } from "@/lib/server/user-stats";
import { logTransaction } from "@/lib/server/audit";
import { calculateXpForLevel } from "@/lib/system/formula";
import db from "@/lib/db";
import { getPlayerSkillProgress } from "@/lib/server/skill-progress";

/**
 * Trigger Transcendence Action
 * Requirements: Level 999 + All Skills Maxed
 * Result: Reset to Level 1, Prestige Level++, Rank [Ω], Crystallized Stats
 */
export async function triggerTranscendenceAction() {
    return safeAction(z.null().optional(), null, async () => {
        const user = await getAuthenticatedUser();

        // 1. Fetch Profile & Stats
        const [profile, stats, skillProgress] = await Promise.all([
            db.queryOne<any>("SELECT * FROM profiles WHERE id = $1", [user.id]),
            db.queryOne<any>("SELECT * FROM hunter_stats WHERE user_id = $1", [user.id]),
            getPlayerSkillProgress(user.id),
        ]);

        if (!profile || !stats) throw new Error("Profile not found");

        // 2. Requirements Validation
        const level = profile.level || 1;
        if (level < 999) {
            throw new Error(`Transcendence requires Level 999. Current Level: ${level}`);
        }

        if (!skillProgress.allMaxed) {
            throw new Error(`Transcendence requires all skills to be at Max Level. ${skillProgress.unmaxed} skills remaining.`);
        }

        // 3. Snapshot Stats (Crystallization)
        // We include all primary stats current state
        const crystallized = {
            strength: stats.strength || 10,
            agility: stats.agility || 10,
            intelligence: stats.intelligence || 10,
            vitality: stats.vitality || 10,
            perception: stats.perception || 10,
            charisma: stats.charisma || 10,
            focus: stats.focus || 10,
            willpower: stats.willpower || 10,
            luck: stats.luck || 10,
            pre_prestige_level: level
        };

        const newPrestigeLevel = (profile.prestige_level || 0) + 1;

        // 4. Update Database
        await db.transaction(async (client) => {
            // Update Profile: Reset Level, Increment Prestige, Change Title/Entity
            await client.query(`
                UPDATE profiles 
                SET level = 1, 
                    current_xp = 0, 
                    next_level_xp = $2,
                    prestige_level = $3,
                    entity_type = 'Acausal Entity',
                    hunter_rank = '[Ω]',
                    title = 'The Transcendent',
                    current_hp = 100, -- Will be clamped/resized by recalculateAndClamp
                    current_mana = 100,
                    available_ap = 0,
                    available_sp = 0
                WHERE id = $1
            `, [user.id, calculateXpForLevel(2), newPrestigeLevel]);

            // Update Stats: Reset Base Stats, Save Crystallized, Increase Cosmic Power
            await client.query(`
                UPDATE hunter_stats
                SET strength = 10,
                    agility = 10,
                    intelligence = 10,
                    vitality = 10,
                    perception = 10,
                    charisma = 10,
                    focus = 10,
                    willpower = 10,
                    luck = 10,
                    crystallized_stats = $2,
                    cosmic_power = cosmic_power + 1000
                WHERE user_id = $1
            `, [user.id, crystallized]);

            // Optional: Grant a massive XP boost for the first few levels of prestige if needed, 
            // but the current formula already has a 10^prestige reward multiplier.
        });

        // 5. Audit Log
        await logTransaction(user.id, "TRANSCENDENCE", {}, { crystallized, newPrestigeLevel });

        // 6. Recalculate & Clamp (ensure HP/Mana reflect new prestige scales)
        await recalculateAndClampPlayerStats(user.id);

        revalidatePath("/dashboard", "layout");
        revalidatePath("/dashboard/profile");

        return {
            success: true,
            message: "You have transcended your mortal coil. You are now an Acausal Entity.",
            prestigeLevel: newPrestigeLevel
        };
    });
}
