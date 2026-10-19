/** Apply reviewed, numbered PostgreSQL upgrade migrations without touching the app pool. */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { join } from 'node:path';
import { Pool } from 'pg';
import { databaseConfig } from './config';
import { ConfigurationError } from '../../src/lib/server/environment';
import { upgradeLegacyBossBalance } from './legacy-boss-balance';

const MIGRATIONS_DIR = 'database/migrations';
const BASELINE_VERSION = '001_baseline';
const MIGRATION_NAME = /^(\d{3}_[a-z0-9_]+)\.sql$/;
const LOCK_ID = 731946201;

type Migration = { version: string; sql: string; checksum: string };

async function readMigrations(): Promise<Migration[]> {
    const files = (await readdir(MIGRATIONS_DIR))
        .filter((file) => MIGRATION_NAME.test(file))
        .sort();
    const migrations: Migration[] = [];
    const versions = new Set<string>();
    for (const file of files) {
        const version = file.slice(0, -4);
        if (version === BASELINE_VERSION) continue;
        if (versions.has(version)) throw new Error(`Duplicate migration version: ${version}.`);
        versions.add(version);
        const bytes = await readFile(join(MIGRATIONS_DIR, file));
        migrations.push({
            version,
            sql: bytes.toString('utf8'),
            checksum: createHash('sha256').update(bytes).digest('hex'),
        });
    }
    return migrations;
}

async function main() {
    const { values } = parseArgs({ options: {
        'env-file': { type: 'string' }, 'target-database': { type: 'string' },
        confirm: { type: 'boolean' }, check: { type: 'boolean' },
        'legacy-boss-balance': { type: 'boolean' },
    } });
    const config = databaseConfig(values['env-file']);
    const target = values['target-database'];
    const confirmed = values.confirm === true;
    const checkOnly = values.check === true;
    if (typeof target !== 'string' || target !== config.database) {
        throw new Error('Supply --target-database matching the configured database.');
    }
    if (confirmed && checkOnly) throw new Error('Choose either --check or --confirm, not both.');

    const migrations = await readMigrations();
    if (migrations.length === 0) {
        console.log('No numbered upgrade migrations are present after the baseline.');
        return;
    }

    const pool = new Pool(config);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_ID]);
        const serverVersion = Number((await client.query('SHOW server_version_num')).rows[0].server_version_num);
        if (serverVersion < 170000) throw new Error('Upgrade migrations require PostgreSQL 17 or later.');

        const marker = (await client.query("SELECT to_regclass('public.sls_schema_migrations') AS marker")).rows[0].marker;
        if (!marker) {
            if (!values['legacy-boss-balance']) throw new Error('The baseline marker is absent. Existing databases can preview the guarded boss-only upgrade with --legacy-boss-balance --check. Do not initialize an existing database.');
            const feature = migrations.find(migration => migration.version === '004_boss_bounty_balance');
            if (!feature) throw new Error('The reviewed boss-balance migration is missing.');
            const message = await upgradeLegacyBossBalance(client, feature, confirmed);
            await client.query('COMMIT');
            console.log(message);
            return;
        }
        if (values['legacy-boss-balance']) throw new Error('This database has the packaged baseline. Use the normal numbered migration path without --legacy-boss-balance.');

        const appliedRows = await client.query<{ version: string; checksum: string }>(
            'SELECT version, checksum FROM public.sls_schema_migrations ORDER BY version'
        );
        const applied = new Map(appliedRows.rows.map((row) => [row.version, row.checksum]));
        if (!applied.has(BASELINE_VERSION)) throw new Error('The baseline migration marker is missing; adoption is not supported.');
        const knownVersions = new Set(migrations.map((migration) => migration.version));
        for (const version of applied.keys()) {
            if (version !== BASELINE_VERSION && !knownVersions.has(version)) {
                throw new Error(`Applied migration is missing from this release: ${version}.`);
            }
        }

        const pending: Migration[] = [];
        let gap = false;
        for (const migration of migrations) {
            const priorChecksum = applied.get(migration.version);
            if (priorChecksum && priorChecksum !== migration.checksum) {
                throw new Error(`Applied migration checksum changed: ${migration.version}.`);
            }
            if (priorChecksum) {
                if (gap) throw new Error(`Migration history has a gap before applied version ${migration.version}.`);
            } else {
                gap = true;
                pending.push(migration);
            }
        }

        if (checkOnly || !confirmed) {
            await client.query('COMMIT');
            console.log(pending.length === 0
                ? 'Database is up to date; no migration writes were made.'
                : `${pending.length} migration(s) pending: ${pending.map((migration) => migration.version).join(', ')}.`);
            if (!checkOnly) console.log('Preview only. Re-run with --check to inspect the database or --confirm to apply the reviewed migrations.');
            return;
        }

        for (const migration of pending) {
            await client.query(migration.sql);
            await client.query(
                'INSERT INTO public.sls_schema_migrations (version, checksum) VALUES ($1, $2)',
                [migration.version, migration.checksum]
            );
        }
        await client.query('COMMIT');
        console.log(pending.length === 0
            ? 'Database is up to date; no migration writes were made.'
            : `Applied ${pending.length} reviewed migration(s): ${pending.map((migration) => migration.version).join(', ')}.`);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((error: unknown) => {
    console.error(error instanceof ConfigurationError ? error.message : error instanceof Error ? error.message : 'Database migration failed.');
    process.exitCode = 1;
});
