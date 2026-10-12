import { parseArgs } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { Pool } from 'pg';
import { databaseConfig } from './config';
import { catalogQueries, validateCatalogSeed, type CatalogName } from './catalogs';
import { ConfigurationError } from '../../src/lib/server/environment';

const run = promisify(execFile);
async function main() {
    const { values } = parseArgs({ options: {
        'env-file': { type: 'string' }, output: { type: 'string' },
        'pg-dump': { type: 'string' }, 'docker-image': { type: 'string' },
    } });
    const output = resolve(values.output || 'scratch/database-export');
    const insideScratch = relative(resolve('scratch'), output);
    if (!insideScratch || insideScratch.startsWith('..') || resolve('scratch', insideScratch) !== output) {
        throw new Error('Export to a new directory under scratch, then review before publication.');
    }
    const config = databaseConfig(values['env-file']);
    const bin = values['docker-image'] ? 'docker' : (values['pg-dump'] || 'pg_dump');
    const versionArgs = values['docker-image'] ? ['run', '--rm', values['docker-image'], 'pg_dump', '--version'] : ['--version'];
    // Preflight before querying any catalog rows. Tool diagnostics are never printed.
    const toolVersion = (await run(bin, versionArgs, { timeout: 120000 })).stdout.trim();
    await mkdir(output, { recursive: false });
    const pool = new Pool(config);
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
            const serverVersion = (await client.query('SHOW server_version')).rows[0].server_version;
            const snapshot = (await client.query('SELECT pg_export_snapshot() AS snapshot')).rows[0].snapshot;
            const dumpEnv = {
                ...process.env, PGHOST: String(config.host), PGPORT: String(config.port),
                PGDATABASE: String(config.database), PGUSER: String(config.user), PGPASSWORD: String(config.password),
                PGOPTIONS: '-c default_transaction_read_only=on',
            };
            const args = ['--schema-only', '--schema=public', '--no-owner', '--no-privileges', '--no-comments', '--no-password', `--snapshot=${snapshot}`];
            const invocation = values['docker-image']
                ? ['run', '--rm', ...['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD', 'PGOPTIONS'].flatMap(key => ['--env', key]), values['docker-image'], 'pg_dump', ...args]
                : args;
            const schema = (await run(bin, invocation, { env: dumpEnv, maxBuffer: 32 * 1024 * 1024, timeout: 120000 })).stdout;
            const catalogs: Record<string, unknown> = {};
            for (const name of Object.keys(catalogQueries) as CatalogName[]) {
                catalogs[name] = (await client.query(catalogQueries[name])).rows;
            }
            validateCatalogSeed(catalogs);
            const seed = JSON.stringify(catalogs, null, 2) + '\n';
            const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
            await writeFile(resolve(output, 'schema.sql'), schema, { flag: 'wx' });
            await writeFile(resolve(output, 'catalogs.json'), seed, { flag: 'wx' });
            await writeFile(resolve(output, 'manifest.json'), JSON.stringify({
                format: 1, serverVersion, toolVersion,
                schemaSha256: sha256(schema), catalogsSha256: sha256(seed),
                counts: Object.fromEntries(Object.entries(catalogs).map(([name, rows]) => [name, (rows as unknown[]).length])),
                reviewRequired: true,
            }, null, 2) + '\n', { flag: 'wx' });
            await client.query('ROLLBACK');
            console.log('Read-only export complete. Review schema, catalog text and asset paths before promoting these files.');
        } finally { client.release(); }
    } finally { await pool.end(); }
}

main().catch((error: unknown) => {
    console.error(error instanceof ConfigurationError ? error.message : 'Export failed. Check PostgreSQL client availability/version, database configuration and a new scratch output directory. No raw connection/tool error is printed.');
    process.exitCode = 1;
});
