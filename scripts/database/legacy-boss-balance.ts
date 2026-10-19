import type { PoolClient } from 'pg';

/** Feature-scoped upgrade only. Never creates or claims the packaged baseline. */
export async function upgradeLegacyBossBalance(client: PoolClient, migration: { version: string; sql: string; checksum: string }, confirm: boolean) {
    if (migration.version !== '004_boss_bounty_balance') throw new Error('Only the reviewed boss-balance feature can use this legacy upgrade path.');
    const required: Record<string, Record<string, string[]>> = {
        profiles: { id: ['uuid'], level: ['int4'] },
        bosses: { id: ['uuid'], rank: ['text', 'varchar'], phase: ['int4'], required_level: ['int4'] },
        quests: { id: ['uuid'], user_id: ['uuid'] },
        user_quests: { user_id: ['uuid'], quest_id: ['uuid'], completed_at: ['timestamptz'] },
        active_encounters: { id: ['uuid'], user_id: ['uuid'], boss_id: ['uuid'], current_hp: ['int4'], max_hp: ['int4'],
            status: ['text', 'varchar'], created_at: ['timestamptz'], last_updated: ['timestamptz'] },
    };
    const schema = await client.query<{ table_name: string; column_name: string; udt_name: string }>(`
        SELECT table_name, column_name, udt_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ANY($1::text[])
    `, [[...Object.keys(required), 'boss_bounty_ledgers', 'boss_bounty_events']]);
    const columns = new Map(schema.rows.map(row => [`${row.table_name}.${row.column_name}`, row.udt_name]));
    for (const [table, fields] of Object.entries(required)) {
        for (const [field, types] of Object.entries(fields)) {
            if (!types.includes(columns.get(`${table}.${field}`) || '')) throw new Error(`Legacy boss upgrade preflight failed: incompatible ${table}.${field}.`);
        }
    }
    const uniqueIds = await client.query<{ relname: string }>(`
        SELECT DISTINCT c.relname FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_index i ON i.indrelid = c.oid
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
        WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])
          AND i.indisunique AND i.indnkeyatts = 1 AND a.attname = 'id'
    `, [['profiles', 'quests', 'active_encounters']]);
    if (uniqueIds.rows.length !== 3) throw new Error('Legacy boss upgrade requires unique profile, quest and encounter IDs.');

    const marker = (await client.query("SELECT to_regclass('public.sls_feature_migrations') AS marker")).rows[0].marker;
    const applied = marker ? (await client.query<{ checksum: string }>('SELECT checksum FROM public.sls_feature_migrations WHERE version = $1', [migration.version])).rows[0] : undefined;
    const added = ['active_encounters.balance_version', 'active_encounters.is_first_clear', 'active_encounters.completed_at', 'active_encounters.rewarded_at',
        'boss_bounty_ledgers.user_id', 'boss_bounty_events.source_key'];
    if (applied) {
        if (applied.checksum !== migration.checksum) throw new Error('The applied legacy boss-balance migration checksum changed.');
        if (!added.every(key => columns.has(key))) throw new Error('The recorded legacy boss-balance schema is incomplete.');
        return 'Legacy boss-balance feature is up to date; no writes were made.';
    }
    if (added.some(key => columns.has(key))) throw new Error('Untracked boss-balance schema already exists. Refusing to adopt or overwrite it.');
    if (!confirm) return 'Legacy preflight passed. Only 004_boss_bounty_balance is pending; no baseline or feature writes were made.';

    if (!marker) await client.query(`CREATE TABLE public.sls_feature_migrations (
        version text PRIMARY KEY, checksum text NOT NULL CHECK (length(checksum) = 64), applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    await client.query(migration.sql);
    await client.query('INSERT INTO public.sls_feature_migrations (version, checksum) VALUES ($1, $2)', [migration.version, migration.checksum]);
    return 'Applied only 004_boss_bounty_balance to the verified legacy schema; no packaged baseline was installed or claimed.';
}
