import { z } from 'zod';
import db from '@/lib/db';

const rowSchema = z.record(z.unknown()).refine(
    row => Object.keys(row).every(key => /^[a-z][a-z0-9_]*$/.test(key)),
    'Invalid save field name',
);
const rows = z.array(rowSchema).max(10_000);
export const saveDataSchema = z.object({
    profiles: rows.length(1), hunter_stats: rows.length(1),
    inventory: rows.default([]), user_quests: rows.default([]),
    quest_logs: rows.default([]), user_skills: rows.default([]),
    user_achievements: rows.default([]), user_titles: rows.default([]),
    active_encounters: rows.default([]), quests: rows.optional(),
}).strict();

type SaveData = z.infer<typeof saveDataSchema>;

/** Values are JSON parameters; uploaded keys never become SQL identifiers. */
const insertStatements = {
    hunter_stats: 'INSERT INTO hunter_stats SELECT * FROM jsonb_populate_recordset(NULL::hunter_stats, $1::jsonb)',
    inventory: 'INSERT INTO inventory SELECT * FROM jsonb_populate_recordset(NULL::inventory, $1::jsonb)',
    quests: 'INSERT INTO quests SELECT * FROM jsonb_populate_recordset(NULL::quests, $1::jsonb)',
    user_quests: 'INSERT INTO user_quests SELECT * FROM jsonb_populate_recordset(NULL::user_quests, $1::jsonb)',
    quest_logs: 'INSERT INTO quest_logs SELECT * FROM jsonb_populate_recordset(NULL::quest_logs, $1::jsonb)',
    user_skills: 'INSERT INTO user_skills SELECT * FROM jsonb_populate_recordset(NULL::user_skills, $1::jsonb)',
    user_achievements: 'INSERT INTO user_achievements SELECT * FROM jsonb_populate_recordset(NULL::user_achievements, $1::jsonb)',
    user_titles: 'INSERT INTO user_titles SELECT * FROM jsonb_populate_recordset(NULL::user_titles, $1::jsonb)',
    active_encounters: 'INSERT INTO active_encounters SELECT * FROM jsonb_populate_recordset(NULL::active_encounters, $1::jsonb)',
} as const;

export async function restoreSave(userId: string, input: unknown): Promise<void> {
    const data = saveDataSchema.parse(input);
    if (Buffer.byteLength(JSON.stringify(data), 'utf8') > 5 * 1024 * 1024) throw new Error('Save exceeds 5 MiB.');
    if (data.profiles[0].id !== userId) throw new Error('This save belongs to a different user.');
    for (const [table, records] of Object.entries(data)) {
        if (table === 'profiles' || !records) continue;
        if (records.some(row => row.user_id !== userId)) throw new Error('Save contains rows belonging to another user.');
    }
    const questIds = [...new Set([...data.user_quests, ...data.quest_logs]
        .map(row => row.quest_id).filter(id => id != null))];
    z.array(z.string().uuid()).parse(questIds);

    await db.transaction(async client => {
        const profile = await client.query('SELECT id FROM profiles WHERE id = $1 FOR UPDATE', [userId]);
        if (profile.rows.length === 0) throw new Error('Profile not found.');
        // Validate references before deleting anything, including rows whose owner
        // was forged in an uploaded save. Imported private quests cannot replace
        // another player's definition or an existing shared template.
        const importedIds = data.quests?.map(row => z.string().uuid().parse(row.id)) || [];
        const definitions = await client.query<{ id: string; user_id: string | null }>(
            'SELECT id, user_id FROM quests WHERE id = ANY($1::uuid[])',
            [[...new Set([...questIds, ...importedIds])]],
        );
        const owners = new Map(definitions.rows.map(row => [row.id, row.user_id]));
        if (importedIds.some(id => owners.has(id) && owners.get(id) !== userId)) {
            throw new Error('Cannot replace another user’s quest or a shared template.');
        }
        for (const id of questIds as string[]) {
            if (owners.has(id) && owners.get(id) !== userId && owners.get(id) !== null) {
                throw new Error('Save references another user’s quest.');
            }
            if (!owners.has(id) && !importedIds.includes(id)) throw new Error('Save references a missing quest.');
            if (data.quests && owners.get(id) === userId && !importedIds.includes(id)) {
                throw new Error('Save omits a referenced private quest.');
            }
        }

        // The safety snapshot and restore commit together; a failure rolls back
        // both. Only the current player's rows can enter this private backup.
        await client.query(`INSERT INTO user_backups (user_id, backup_data, type, created_at)
            SELECT $1, jsonb_build_object(
                'profiles', (SELECT jsonb_agg(p) FROM profiles p WHERE id = $1),
                'hunter_stats', (SELECT jsonb_agg(s) FROM hunter_stats s WHERE user_id = $1),
                'inventory', (SELECT COALESCE(jsonb_agg(i), '[]') FROM inventory i WHERE user_id = $1),
                'quests', (SELECT COALESCE(jsonb_agg(q), '[]') FROM quests q WHERE user_id = $1),
                'user_quests', (SELECT COALESCE(jsonb_agg(q), '[]') FROM user_quests q WHERE user_id = $1),
                'quest_logs', (SELECT COALESCE(jsonb_agg(q), '[]') FROM quest_logs q WHERE user_id = $1),
                'user_skills', (SELECT COALESCE(jsonb_agg(s), '[]') FROM user_skills s WHERE user_id = $1),
                'user_achievements', (SELECT COALESCE(jsonb_agg(a), '[]') FROM user_achievements a WHERE user_id = $1),
                'user_titles', (SELECT COALESCE(jsonb_agg(t), '[]') FROM user_titles t WHERE user_id = $1),
                'active_encounters', (SELECT COALESCE(jsonb_agg(e), '[]') FROM active_encounters e WHERE user_id = $1)
            ), 'MANUAL', NOW()`, [userId]);
        await client.query(`DELETE FROM user_backups WHERE user_id = $1 AND id NOT IN (
            SELECT id FROM user_backups WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 7
        )`, [userId]);

        await client.query('DELETE FROM active_encounters WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM user_titles WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM user_achievements WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM user_skills WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM quest_logs WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM user_quests WHERE user_id = $1', [userId]);
        if (data.quests) await client.query('DELETE FROM quests WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM inventory WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM hunter_stats WHERE user_id = $1', [userId]);

        // Restore supported gameplay fields only. Identity, credentials, and
        // unrelated deployment/profile fields are never changed by an import.
        await client.query(`UPDATE profiles SET
            (level, current_xp, next_level_xp, hunter_rank, hunter_class, title,
             current_hp, current_mana, gold_credits, available_ap, available_sp,
             status_effects, last_regen_at, shadow_infantry_count, prestige_level,
             gender, auto_sell_junk) = (
                SELECT restored.level, restored.current_xp, restored.next_level_xp,
                    restored.hunter_rank, restored.hunter_class, restored.title,
                    restored.current_hp, restored.current_mana, restored.gold_credits,
                    restored.available_ap, restored.available_sp, restored.status_effects,
                    restored.last_regen_at, restored.shadow_infantry_count,
                    restored.prestige_level, restored.gender, restored.auto_sell_junk
                FROM jsonb_populate_record(profiles, $2::jsonb) AS restored
             ) WHERE id = $1`, [userId, JSON.stringify(data.profiles[0])]);

        for (const table of Object.keys(insertStatements) as (keyof typeof insertStatements)[]) {
            const records = data[table as keyof SaveData];
            if (records?.length) await client.query(insertStatements[table], [JSON.stringify(records)]);
        }
    });
}
