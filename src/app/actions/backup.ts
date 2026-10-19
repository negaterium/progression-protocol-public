"use server";

import { z } from "zod";
import { safeAction } from "@/lib/action-utils";
import { revalidatePath } from "next/cache";
import { gameDb as db, withGameTransaction } from '@/lib/server/game-db';
import { restoreSave, saveDataSchema } from "@/lib/server/save-restoration";

const backupQueries = {
    profiles: 'SELECT * FROM profiles WHERE id = $1',
    hunter_stats: 'SELECT * FROM hunter_stats WHERE user_id = $1',
    inventory: 'SELECT * FROM inventory WHERE user_id = $1',
    quests: 'SELECT * FROM quests WHERE user_id = $1',
    user_quests: 'SELECT * FROM user_quests WHERE user_id = $1',
    quest_logs: 'SELECT * FROM quest_logs WHERE user_id = $1',
    user_skills: 'SELECT * FROM user_skills WHERE user_id = $1',
    user_achievements: 'SELECT * FROM user_achievements WHERE user_id = $1',
    user_titles: 'SELECT * FROM user_titles WHERE user_id = $1',
    active_encounters: 'SELECT * FROM active_encounters WHERE user_id = $1',
    boss_bounty_ledgers: 'SELECT * FROM boss_bounty_ledgers WHERE user_id = $1',
    boss_bounty_events: 'SELECT * FROM boss_bounty_events WHERE user_id = $1',
};

export async function createDailyBackupAction(type: 'DAILY' | 'MANUAL' = 'DAILY') {
    return safeAction(z.enum(['DAILY', 'MANUAL']), type, async (backupType) => {
        const { getAuthenticatedUser } = await import("@/lib/auth-utils");
        const user = await getAuthenticatedUser();
        return withGameTransaction(user.id, async () => {
            console.log(`Creating ${type} Backup for User: ${user.id}`);

            const backupData: Record<string, any[]> = {};

            // Fetch data from all tables
            for (const [table, query] of Object.entries(backupQueries)) {
                const { rows } = await db.query(query, [user.id]);
                backupData[table] = rows;
            }

            // Store in user_backups
            await db.query(`
                INSERT INTO user_backups (user_id, backup_data, type, created_at)
                VALUES ($1, $2, $3, NOW())
            `, [user.id, JSON.stringify(backupData), backupType]);

            // Pruning: Keep last 7 backups total (Daily or Manual)
            await db.query(`
                DELETE FROM user_backups
                WHERE user_id = $1
                AND id NOT IN (
                    SELECT id FROM user_backups
                    WHERE user_id = $1
                    ORDER BY created_at DESC
                    LIMIT 7
                )
            `, [user.id]);

            revalidatePath("/dashboard/profile");
            return { success: true };
        });
    });
}

export async function restoreUserBackupAction(backupId: string) {
    return safeAction(z.string().uuid(), backupId, async (id) => {
        const { getAuthenticatedUser } = await import("@/lib/auth-utils");
        const user = await getAuthenticatedUser();

        console.log(`Restoring Backup ${id} for User ${user.id}`);

        // 1. Fetch Backup
        const backup = await db.queryOne<{ backup_data: any }>(
            "SELECT backup_data FROM user_backups WHERE id = $1 AND user_id = $2",
            [id, user.id]
        );

        if (!backup) throw new Error("Backup not found or unauthorized.");

        // 2. Perform Restore
        await restoreSave(user.id, backup.backup_data);

        revalidatePath("/dashboard");
        revalidatePath("/dashboard/profile");
        return { success: true };
    });
}

export async function importUserDataAction(jsonData: unknown) {
    return safeAction(saveDataSchema, jsonData as z.infer<typeof saveDataSchema>, async data => {
        const { getAuthenticatedUser } = await import("@/lib/auth-utils");
        const user = await getAuthenticatedUser();
        await restoreSave(user.id, data);
        revalidatePath("/dashboard", "layout");
        return { success: true };
    });
}

export async function getUserBackupsAction() {
    return safeAction(z.void(), undefined, async () => {
        const { getAuthenticatedUser } = await import("@/lib/auth-utils");
        const user = await getAuthenticatedUser();

        const { rows } = await db.query(`
            SELECT id, type, created_at, 
                   jsonb_array_length(backup_data->'user_quests') as quest_count, 
                   jsonb_array_length(backup_data->'inventory') as item_count 
            FROM user_backups 
            WHERE user_id = $1 
            ORDER BY created_at DESC
        `, [user.id]);

        return { backups: rows };
    });
}

export async function exportUserDataAction() {
    return safeAction(z.void(), undefined, async () => {
        const { getAuthenticatedUser } = await import("@/lib/auth-utils");
        const user = await getAuthenticatedUser();
        return withGameTransaction(user.id, async () => {

            console.log(`Exporting Data for User: ${user.id}`);

            const backupData: Record<string, any[]> = {};

            // Fetch data from all tables
            for (const [table, query] of Object.entries(backupQueries)) {
                const { rows } = await db.query(query, [user.id]);
                backupData[table] = rows;
            }

            return { data: backupData };
        });
    });
}
