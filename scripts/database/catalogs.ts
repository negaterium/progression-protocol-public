/** Fixed catalog allowlist. Player tables are never queried by the exporter. */
export const catalogQueries = {
    zones: 'SELECT * FROM public.zones ORDER BY id',
    items: 'SELECT * FROM public.items ORDER BY id',
    bosses: 'SELECT * FROM public.bosses ORDER BY id',
    boss_objectives: 'SELECT * FROM public.boss_objectives ORDER BY id',
    skills: 'SELECT * FROM public.skills ORDER BY id',
    achievements: 'SELECT * FROM public.achievements ORDER BY id',
    titles: 'SELECT * FROM public.titles ORDER BY id',
    quests: 'SELECT * FROM public.quests WHERE user_id IS NULL ORDER BY id',
} as const;

export const catalogInserts = {
    zones: 'INSERT INTO public.zones SELECT * FROM jsonb_populate_recordset(NULL::public.zones, $1::jsonb)',
    items: 'INSERT INTO public.items SELECT * FROM jsonb_populate_recordset(NULL::public.items, $1::jsonb)',
    bosses: 'INSERT INTO public.bosses SELECT * FROM jsonb_populate_recordset(NULL::public.bosses, $1::jsonb)',
    boss_objectives: 'INSERT INTO public.boss_objectives SELECT * FROM jsonb_populate_recordset(NULL::public.boss_objectives, $1::jsonb)',
    skills: 'INSERT INTO public.skills SELECT * FROM jsonb_populate_recordset(NULL::public.skills, $1::jsonb)',
    achievements: 'INSERT INTO public.achievements SELECT * FROM jsonb_populate_recordset(NULL::public.achievements, $1::jsonb)',
    titles: 'INSERT INTO public.titles SELECT * FROM jsonb_populate_recordset(NULL::public.titles, $1::jsonb)',
    quests: 'INSERT INTO public.quests SELECT * FROM jsonb_populate_recordset(NULL::public.quests, $1::jsonb)',
} as const;

export type CatalogName = keyof typeof catalogQueries;
export type CatalogSeed = Record<CatalogName, Record<string, unknown>[]>;

export function validateCatalogSeed(value: unknown): asserts value is CatalogSeed {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid catalog seed.');
    const object = value as Record<string, unknown>;
    if (Object.keys(object).length !== Object.keys(catalogQueries).length) throw new Error('Unexpected catalog tables.');
    for (const name of Object.keys(catalogQueries) as CatalogName[]) {
        const rows = object[name];
        if (!Array.isArray(rows) || rows.length > 10000) throw new Error('Invalid catalog rows.');
        for (const row of rows) {
            if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Invalid catalog row.');
            for (const key of Object.keys(row)) {
                if (!/^[a-z][a-z0-9_]*$/.test(key)) throw new Error('Invalid catalog column.');
                if (['password', 'password_hash', 'email', 'username', 'session_id', 'backup_data'].includes(key)) {
                    throw new Error('Personal data is forbidden in catalog seeds.');
                }
            }
            if ('user_id' in row && (name !== 'quests' || row.user_id !== null)) {
                throw new Error('Player-owned content is forbidden in catalog seeds.');
            }
        }
    }
}
