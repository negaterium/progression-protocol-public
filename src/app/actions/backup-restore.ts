"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { safeAction } from "@/lib/action-utils";
import { z } from "zod";
import { recalculateAndClampPlayerStats } from "@/lib/server/user-stats";
import db from "@/lib/db";
import { restoreSave } from "@/lib/server/save-restoration";

const BACKUP_VERSION = "1.0";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface BackupData {
    version: string;
    exported_at: string;
    user_id: string;
    username: string;
    data: {
        profile: Record<string, unknown>;
        stats: Record<string, unknown>;
        inventory: Record<string, unknown>[];
        quests: Record<string, unknown>[];
        user_quests: Record<string, unknown>[];
        quest_logs: Record<string, unknown>[];
        user_skills: Record<string, unknown>[];
        user_achievements: Record<string, unknown>[];
        user_titles: Record<string, unknown>[];
        active_encounters: Record<string, unknown>[];
    };
}

export async function exportUserDataAction() {
    return safeAction(z.void(), undefined, async () => {
        const user = await getAuthenticatedUser();
        const userId = user.id;

        // Fetch all user data in parallel
        const [
            profile,
            stats,
            inventoryRows,
            questsRows,
            questLogsRows,
            userSkillsRows,
            userAchievementsRows,
            userTitlesRows,
            encountersRows,
            userQuestsRows
        ] = await Promise.all([
            db.queryOne<any>("SELECT * FROM profiles WHERE id = $1", [userId]),
            db.queryOne<any>("SELECT * FROM hunter_stats WHERE user_id = $1", [userId]),
            db.query("SELECT * FROM inventory WHERE user_id = $1", [userId]),
            db.query("SELECT * FROM quests WHERE user_id = $1", [userId]),
            db.query("SELECT * FROM quest_logs WHERE user_id = $1", [userId]),
            db.query("SELECT * FROM user_skills WHERE user_id = $1", [userId]),
            db.query("SELECT * FROM user_achievements WHERE user_id = $1", [userId]),
            db.query("SELECT * FROM user_titles WHERE user_id = $1", [userId]),
            db.query("SELECT * FROM active_encounters WHERE user_id = $1", [userId]),
            db.query("SELECT * FROM user_quests WHERE user_id = $1", [userId])
        ]);

        if (!profile) throw new Error("Failed to fetch profile");
        if (!stats) throw new Error("Failed to fetch stats");

        const backupData: BackupData = {
            version: BACKUP_VERSION,
            exported_at: new Date().toISOString(),
            user_id: userId,
            username: profile.username || 'UNKNOWN',
            data: {
                profile,
                stats,
                inventory: inventoryRows.rows || [],
                quests: questsRows.rows || [],
                user_quests: userQuestsRows.rows || [],
                quest_logs: questLogsRows.rows || [],
                user_skills: userSkillsRows.rows || [],
                user_achievements: userAchievementsRows.rows || [],
                user_titles: userTitlesRows.rows || [],
                active_encounters: encountersRows.rows || []
            }
        };

        return {
            jsonData: JSON.stringify(backupData, null, 2),
            filename: `progression_protocol_backup_${profile.username}_${new Date().toISOString().split('T')[0]}.json`
        };
    });
}

export async function importUserDataAction(input: { jsonData: string }) {
    return safeAction(
        z.object({ jsonData: z.string().max(MAX_FILE_SIZE, "File too large (max 5MB)") }),
        input,
        async ({ jsonData }) => {
            const user = await getAuthenticatedUser();
            const userId = user.id;

            // 1. Parse and validate JSON
            let backupData: BackupData;
            try {
                backupData = JSON.parse(jsonData);
            } catch {
                throw new Error("Invalid JSON format");
            }

            // 2. Validate version
            if (backupData.version !== BACKUP_VERSION) {
                throw new Error(`Incompatible version (expected ${BACKUP_VERSION}, got ${backupData.version})`);
            }

            // 3. Validate user_id match
            if (backupData.user_id !== userId) {
                throw new Error("This save file belongs to a different user");
            }

            // 4. Validate required fields
            if (!backupData.data?.profile) throw new Error("Corrupted save file: missing profile");
            if (!backupData.data?.stats) throw new Error("Corrupted save file: missing stats");

            const { profile, stats, inventory, quests, user_quests, quest_logs, user_skills, user_achievements, user_titles, active_encounters } = backupData.data;
            await restoreSave(userId, {
                profiles: [profile], hunter_stats: [stats], inventory, quests,
                user_quests, quest_logs, user_skills, user_achievements, user_titles,
                active_encounters,
            });

            // Recalculate after the atomic restore.
            await recalculateAndClampPlayerStats(userId);

            // 9. Revalidate
            revalidatePath('/dashboard', 'layout');
            revalidatePath('/dashboard/profile');
            revalidatePath('/dashboard/inventory');
            revalidatePath('/dashboard/quests');
            revalidatePath('/dashboard/skills');

            return {
                message: "Save data restored successfully",
                summary: {
                    profile: true,
                    stats: true,
                    inventory: inventory?.length || 0,
                    quests: quests?.length || 0,
                    user_quests: user_quests?.length || 0,
                    quest_logs: quest_logs?.length || 0,
                    user_skills: user_skills?.length || 0,
                    achievements: user_achievements?.length || 0,
                    titles: user_titles?.length || 0,
                    encounters: active_encounters?.length || 0
                },
                autoBackup: 'Stored in your backup history'
            };
        }
    );
}
