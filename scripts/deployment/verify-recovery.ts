/** Synthetic recovery rehearsal helper; guarded against deployment targets. */
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { databaseConfig } from '../database/config';
const queries = [
    'SELECT * FROM public.achievements',
    'SELECT * FROM public.active_battles',
    'SELECT * FROM public.active_encounters',
    'SELECT * FROM public.audit_logs',
    'SELECT * FROM public.boss_objectives',
    'SELECT * FROM public.bosses',
    'SELECT * FROM public.debug_logs',
    'SELECT * FROM public.divine_authorities',
    'SELECT * FROM public.habit_logs',
    'SELECT * FROM public.hunter_stats',
    'SELECT * FROM public.inventory',
    'SELECT * FROM public.items',
    'SELECT * FROM public.profiles',
    'SELECT * FROM public.quest_logs',
    'SELECT * FROM public.quests',
    'SELECT * FROM public.sessions',
    'SELECT * FROM public.shadow_assignments',
    'SELECT * FROM public.shadows',
    'SELECT * FROM public.skills',
    'SELECT * FROM public.titles',
    'SELECT * FROM public.user_achievements',
    'SELECT * FROM public.user_backups',
    'SELECT * FROM public.user_quests',
    'SELECT * FROM public.user_skills',
    'SELECT * FROM public.user_titles',
    'SELECT * FROM public.users',
    'SELECT * FROM public.zones',
    'SELECT * FROM public.sls_schema_migrations',
];
async function snapshot(pool: Pool) {
    const result = [];
    for (const query of queries) {
        const rows = (await pool.query(query)).rows.map(row => JSON.stringify(row)).sort();
        result.push(rows);
    }
    result.push((await pool.query("SELECT sequencename, last_value FROM pg_sequences WHERE schemaname = 'public' ORDER BY sequencename")).rows);
    result.push((await pool.query("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname")).rows);
    return result;
}
async function main() {
    const config = databaseConfig('/config/setup.env');
    assert.equal(config.host, 'postgres');
    assert.match(String(config.database), /^sls_setup_[a-f0-9]{12}$/);
    const source = new Pool(config);
    let target: Pool | undefined;
    try {
        if (process.argv[2] === 'prepare') {
            const account = (await source.query('SELECT id FROM users WHERE username = $1', ['setup_hunter'])).rows[0];
            assert(account);
            await source.query('UPDATE profiles SET current_xp = $1, gold_credits = $2 WHERE id = $3', [101, 419, account.id]);
            const item = (await source.query('SELECT id FROM items WHERE name = $1', ['Mana Infused Coffee'])).rows[0];
            assert(item);
            await source.query('INSERT INTO inventory (user_id, item_id, quantity) VALUES ($1, $2, $3)', [account.id, item.id, 1]);
            // Fixed database name, created only on the verifier-owned server.
            await source.query('CREATE DATABASE sls_recovery');
        } else {
            assert.equal(process.argv[2], 'compare');
            target = new Pool({ ...config, database: 'sls_recovery' });
            assert.deepEqual(await snapshot(target), await snapshot(source));
            assert.equal((await target.query('SELECT current_xp FROM profiles')).rows[0].current_xp, 101);
        }
        console.log('Synthetic recovery data check passed.');
    } finally { await target?.end(); await source.end(); }
}
main().catch(() => { console.error('Synthetic recovery data check failed.'); process.exitCode = 1; });
