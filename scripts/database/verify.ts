import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { installDatabasePackage } from './install-package';
import { provisionPlayer } from '../../src/lib/server/player-provisioning';

const run = promisify(execFile);
let stage = 'container startup';

async function main() {
    const name = `sls-package-test-${randomBytes(6).toString('hex')}`;
    const password = randomBytes(24).toString('base64url');
    let started = false;
    let pool: Pool | undefined;
    try {
        await run('docker', ['run', '--detach', '--rm', '--name', name,
            '--publish', '127.0.0.1::5432', '--env', 'POSTGRES_PASSWORD',
            '--env', 'POSTGRES_USER=sls_package_test', '--env', 'POSTGRES_DB=sls_package_test', 'postgres:17'],
            { env: { ...process.env, POSTGRES_PASSWORD: password }, timeout: 120000 });
        started = true;
        const mapping = (await run('docker', ['port', name, '5432/tcp'])).stdout.trim();
        const port = Number(mapping.split(':').at(-1));
        assert(Number.isInteger(port) && port > 0);
        pool = new Pool({ host: '127.0.0.1', port, user: 'sls_package_test', password, database: 'sls_package_test', connectionTimeoutMillis: 1000 });
        const deadline = Date.now() + 30000;
        while (true) {
            try { await pool.query('SELECT 1'); break; }
            catch { if (Date.now() > deadline) throw new Error('Disposable PostgreSQL did not start.'); await new Promise(resolve => setTimeout(resolve, 300)); }
        }
        const bundle = {
            version: '001_baseline', schema: await readFile('database/migrations/001_baseline.sql', 'utf8'),
            catalogs: JSON.parse(await readFile('database/seeds/catalogs.json', 'utf8')),
        };
        stage = 'existing database protection';
        await pool.query('CREATE DATABASE sls_existing_test');
        const existingPool = new Pool({ host: '127.0.0.1', port, user: 'sls_package_test', password, database: 'sls_existing_test' });
        try {
            await existingPool.query('CREATE TABLE public.existing_marker (id integer PRIMARY KEY)');
            await assert.rejects(installDatabasePackage(existingPool, bundle));
            assert.equal((await existingPool.query("SELECT to_regclass('public.existing_marker') AS marker")).rows[0].marker, 'existing_marker');
        } finally { await existingPool.end(); }
        stage = 'installation rollback';
        const brokenCatalogs = structuredClone(bundle.catalogs);
        brokenCatalogs.quests[0].zone_id = '00000000-0000-4000-8000-000000000001';
        await assert.rejects(installDatabasePackage(pool, { ...bundle, catalogs: brokenCatalogs }));
        assert.equal((await pool.query("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname = 'public'")).rows[0].count, 0);
        stage = 'fresh installation';
        assert.equal(await installDatabasePackage(pool, bundle), 'installed');
        stage = 'idempotency';
        assert.equal(await installDatabasePackage(pool, bundle), 'already-installed');
        stage = 'numbered migration fixture';
        const missingImageItems = [
            ['32b889d9-ca5e-461b-9071-8140ff54faa7', '/items/neck-fire.webp'],
            ['3edcd33e-1455-4c53-a086-b8f930ca7a52', '/images/items/chitin_armor.webp'],
            ['8aeca4a7-4991-461b-a33d-40a3469a2273', '/images/items/fang.webp'],
            ['ab1bc155-4182-4fe1-82a7-a78ccb5a58a7', '/items/chest-magma.webp'],
            ['d17593a5-493e-4098-9497-7a3e1bd20d29', '/items/ring-antidote.webp'],
            ['d72516e3-cabb-4983-acf9-10bad48c947e', '/items/head-plague.webp'],
        ] as const;
        for (const [id, imageUrl] of missingImageItems) {
            await pool.query('UPDATE public.items SET image_url = $1 WHERE id = $2', [imageUrl, id]);
        }
        const migrationEnvironment = {
            ...process.env,
            POSTGRES_HOST: '127.0.0.1', POSTGRES_PORT: String(port),
            POSTGRES_DATABASE: 'sls_package_test', POSTGRES_USER: 'sls_package_test', POSTGRES_PASSWORD: password,
        };
        stage = 'numbered migration apply';
        await run(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/database/migrate.ts',
            '--target-database', 'sls_package_test', '--confirm'], { env: migrationEnvironment, timeout: 120000 });
        const cleared = await pool.query<{ image_url: string | null }>(
            'SELECT image_url FROM public.items WHERE id = ANY($1::uuid[])', [missingImageItems.map(([id]) => id)]
        );
        assert.equal(cleared.rowCount, missingImageItems.length);
        assert(cleared.rows.every((row) => row.image_url === null));
        const appliedMigrations = await pool.query<{ version: string }>(
            'SELECT version FROM public.sls_schema_migrations WHERE version = ANY($1::text[]) ORDER BY version',
            [['002_skill_catalog_truth', '003_clear_missing_item_images', '004_boss_bounty_balance']]
        );
        assert.deepEqual(appliedMigrations.rows.map((row) => row.version), [
            '002_skill_catalog_truth', '003_clear_missing_item_images', '004_boss_bounty_balance',
        ]);
        stage = 'numbered migration check';
        await run(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/database/migrate.ts',
            '--target-database', 'sls_package_test', '--check'], { env: migrationEnvironment, timeout: 120000 });
        await assert.rejects(installDatabasePackage(pool, { ...bundle, schema: bundle.schema + '\n-- modified' }));
        stage = 'player provisioning';
        const loginPassword = randomBytes(24).toString('base64url');
        const id = await provisionPlayer(pool, 'community_hunter', loginPassword);
        const account = (await pool.query('SELECT password_hash FROM public.users WHERE id = $1', [id])).rows[0];
        assert(await bcrypt.compare(loginPassword, account.password_hash));
        assert.equal((await pool.query('SELECT level FROM public.profiles WHERE id = $1', [id])).rows[0].level, 1);
        assert.equal((await pool.query('SELECT strength FROM public.hunter_stats WHERE user_id = $1', [id])).rows[0].strength, 10);
        await assert.rejects(provisionPlayer(pool, 'community_hunter', loginPassword));
        assert.equal((await pool.query('SELECT count(*)::int AS count FROM public.users')).rows[0].count, 1);
        // Test the real restore implementation with this synthetic database only.
        Object.assign(process.env, { POSTGRES_HOST: '127.0.0.1', POSTGRES_PORT: String(port),
            POSTGRES_USER: 'sls_package_test', POSTGRES_PASSWORD: password, POSTGRES_DATABASE: 'sls_package_test' });
        stage = 'restore module loading';
        const { restoreSave } = await import('../../src/lib/server/save-restoration');
        const { default: db } = await import('../../src/lib/db');
        try {
            const profile = (await pool.query('SELECT * FROM profiles WHERE id = $1', [id])).rows[0];
            const stats = (await pool.query('SELECT * FROM hunter_stats WHERE user_id = $1', [id])).rows[0];
            const questState = (await pool.query('SELECT * FROM user_quests WHERE user_id = $1', [id])).rows;
            const item = (await pool.query('SELECT id FROM items LIMIT 1')).rows[0].id;
            await pool.query('INSERT INTO inventory (user_id, item_id, quantity) VALUES ($1, $2, 2)', [id, item]);
            const inventory = (await pool.query('SELECT * FROM inventory WHERE user_id = $1', [id])).rows;
            const save = { profiles: [profile], hunter_stats: [stats], inventory, user_quests: questState, quests: [] };
            stage = 'restore round trip';
            await restoreSave(id, save);
            assert.equal((await pool.query('SELECT quantity FROM inventory WHERE user_id = $1', [id])).rows[0].quantity, 2);
            const backups = (await pool.query('SELECT count(*)::int AS count FROM user_backups WHERE user_id = $1', [id])).rows[0].count;
            stage = 'restore rollback';
            await assert.rejects(restoreSave(id, { ...save, inventory: [{ ...inventory[0], item_id: '00000000-0000-4000-8000-000000000001' }] }));
            assert.equal((await pool.query('SELECT count(*)::int AS count FROM user_backups WHERE user_id = $1', [id])).rows[0].count, backups);
            assert.equal((await pool.query('SELECT quantity FROM inventory WHERE user_id = $1', [id])).rows[0].quantity, 2);
            await restoreSave(id, { ...save, quests: undefined }); // Legacy save format.
        } finally { await db.end(); }
        stage = 'boss balance transactions';
        await run(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'src/lib/server/boss-balance.integration.test.ts'],
            { env: { ...migrationEnvironment, BOSS_BALANCE_TEST_DATABASE: 'sls_package_test' }, timeout: 120000 });
        stage = 'legacy boss-only upgrade';
        await pool.query('CREATE DATABASE sls_legacy_boss_test');
        const legacyPool = new Pool({ host: '127.0.0.1', port, user: 'sls_package_test', password, database: 'sls_legacy_boss_test' });
        try {
            await installDatabasePackage(legacyPool, bundle);
            await legacyPool.query('ALTER TABLE public.sls_schema_migrations RENAME TO legacy_package_marker');
            const legacyId = randomBytes(16).toString('hex').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
            await legacyPool.query('INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)', [legacyId, 'legacy_probe', 'disabled-fixture']);
            await legacyPool.query('INSERT INTO profiles (id, current_xp) VALUES ($1, 12345)', [legacyId]);
            await legacyPool.query(`INSERT INTO active_encounters (user_id, boss_id, current_hp, max_hp, status)
                SELECT $1, id, 4321, 12345, 'ACTIVE' FROM bosses ORDER BY required_level LIMIT 1`, [legacyId]);
            const legacyEnvironment = { ...migrationEnvironment, POSTGRES_DATABASE: 'sls_legacy_boss_test' };
            const legacyArgs = ['node_modules/tsx/dist/cli.mjs', 'scripts/database/migrate.ts', '--target-database', 'sls_legacy_boss_test', '--legacy-boss-balance'];
            await run(process.execPath, [...legacyArgs, '--check'], { env: legacyEnvironment, timeout: 120000 });
            assert.equal((await legacyPool.query("SELECT to_regclass('public.sls_feature_migrations') AS marker")).rows[0].marker, null);
            await run(process.execPath, [...legacyArgs, '--confirm'], { env: legacyEnvironment, timeout: 120000 });
            await run(process.execPath, [...legacyArgs, '--confirm'], { env: legacyEnvironment, timeout: 120000 });
            assert.equal((await legacyPool.query('SELECT current_xp FROM profiles WHERE id=$1', [legacyId])).rows[0].current_xp, 12345);
            const legacyEncounter = (await legacyPool.query("SELECT current_hp, balance_version FROM active_encounters WHERE user_id=$1 AND status='ACTIVE'", [legacyId])).rows[0];
            assert.equal(legacyEncounter.current_hp, 4321); assert.equal(legacyEncounter.balance_version, 1);
            assert.equal((await legacyPool.query("SELECT to_regclass('public.sls_schema_migrations') AS marker")).rows[0].marker, null);
            const feature = (await legacyPool.query('SELECT version, checksum FROM sls_feature_migrations')).rows[0];
            assert.equal(feature.version, '004_boss_bounty_balance');
            await legacyPool.query('UPDATE sls_feature_migrations SET checksum=$1 WHERE version=$2', ['0'.repeat(64), feature.version]);
            await assert.rejects(run(process.execPath, [...legacyArgs, '--check'], { env: legacyEnvironment, timeout: 120000 }));
            await legacyPool.query('UPDATE sls_feature_migrations SET checksum=$1 WHERE version=$2', [feature.checksum, feature.version]);
            await legacyPool.query('ALTER TABLE public.sls_feature_migrations RENAME TO legacy_feature_marker');
            await assert.rejects(run(process.execPath, [...legacyArgs, '--confirm'], { env: legacyEnvironment, timeout: 120000 }));
            await legacyPool.query('ALTER TABLE public.legacy_feature_marker RENAME TO sls_feature_migrations');
        } finally { await legacyPool.end(); }
        await mkdir('scratch/database-verification', { recursive: true });
        await writeFile('scratch/database-verification/result.json', JSON.stringify({ passed: true,
            checks: ['existing database rejection', 'failed installation rollback', 'fresh install', 'idempotent rerun',
                'numbered migration apply/check', 'modified baseline rejection', 'playable account',
                'bcrypt login verification', 'duplicate account rejection', 'restore round trip', 'restore rollback', 'legacy save',
                'boss reward concurrency, rollback, first clear, HP and bounty save compatibility',
                'legacy feature preflight, idempotency, preservation, checksum and untracked-schema protection'],
        }, null, 2));
        console.log('Database installation, migrations, saves and boss balance transaction checks passed. Only isolated disposable databases were changed.');
    } finally {
        await pool?.end();
        if (started) await run('docker', ['stop', name], { timeout: 30000 });
    }
}

main().catch((error: unknown) => {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    console.error(`Database package verification failed at ${stage}${/^[A-Z0-9_]{1,30}$/.test(code) ? ` (${code})` : ''}. Raw database/tool errors are suppressed.`);
    process.exitCode = 1;
});
