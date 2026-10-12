import { parseArgs } from 'node:util';
import { Pool } from 'pg';
import { databaseConfig } from '../database/config';
import { ConfigurationError, parseApplicationEnvironment, configurationNotes } from '../../src/lib/server/environment';

const requiredTables = ['users', 'sessions', 'profiles', 'hunter_stats', 'zones', 'quests', 'user_quests',
    'quest_logs', 'habit_logs', 'items', 'inventory', 'bosses', 'active_encounters', 'skills', 'user_skills',
    'achievements', 'user_achievements', 'titles', 'user_titles', 'shadows', 'shadow_assignments', 'user_backups',
    'audit_logs', 'debug_logs'];

class ReadinessError extends Error { }

async function main() {
    const { values } = parseArgs({ options: {
        'env-file': { type: 'string' }, mode: { type: 'string' }, database: { type: 'boolean' },
    } });
    const mode = values.mode || (process.env.NODE_ENV === 'production' ? 'production' : 'development');
    if (!['development', 'production'].includes(mode)) throw new ReadinessError('Use --mode development or --mode production.');
    const config = databaseConfig(values['env-file']);
    const env = { ...process.env, NODE_ENV: mode };
    parseApplicationEnvironment(env);
    console.log(`Configuration is valid for ${mode}. No setting values were printed.`);
    for (const note of configurationNotes(env)) console.log(note);
    if (!values.database) return;
    const pool = new Pool({ ...config, max: 1, connectionTimeoutMillis: 3000,
        options: '-c default_transaction_read_only=on -c statement_timeout=5000' });
    try {
        const version = Number((await pool.query('SHOW server_version_num')).rows[0].server_version_num);
        if (version < 170000) throw new ReadinessError('The packaged baseline requires PostgreSQL 17 or later.');
        const tables = await pool.query<{ relname: string; permitted: boolean }>(`SELECT c.relname,
            has_table_privilege(c.oid, 'SELECT') AND has_table_privilege(c.oid, 'INSERT')
            AND has_table_privilege(c.oid, 'UPDATE') AND has_table_privilege(c.oid, 'DELETE') AS permitted
            FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
            WHERE n.nspname = $1 AND c.relkind IN ('r', 'p') AND c.relname = ANY($2::text[])`, ['public', requiredTables]);
        const names = new Set(tables.rows.map(row => row.relname));
        const missing = requiredTables.filter(name => !names.has(name));
        if (missing.length) throw new ReadinessError(`Missing app tables: ${missing.join(', ')}. Initialize only a new empty database; existing deployments need an upgrade plan.`);
        const denied = tables.rows.filter(row => !row.permitted).map(row => row.relname);
        if (denied.length) throw new ReadinessError(`Missing app table permissions: ${denied.join(', ')}. Ask the database administrator to review this role.`);
        console.log('Database is reachable, PostgreSQL version and app tables/permissions are ready. No player data was queried or changed.');
    } finally { await pool.end(); }
}

main().catch((error: unknown) => {
    if (error instanceof ConfigurationError || error instanceof ReadinessError) console.error(error.message);
    else console.error('Configuration/database check failed. Check the selected file, network reachability, credentials and database permissions. Connection details are not printed.');
    process.exitCode = 1;
});
