import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { databaseConfig } from './config';
import { installDatabasePackage } from './install-package';
import { ConfigurationError } from '../../src/lib/server/environment';

async function main() {
    const { values } = parseArgs({ options: {
        'env-file': { type: 'string' }, 'target-database': { type: 'string' }, confirm: { type: 'boolean' },
    } });
    const config = databaseConfig(values['env-file']);
    if (!values.confirm || values['target-database'] !== config.database) {
        throw new Error('Supply --confirm and --target-database matching the configured empty database.');
    }
    const schema = await readFile('database/migrations/001_baseline.sql', 'utf8');
    const catalogs: unknown = JSON.parse(await readFile('database/seeds/catalogs.json', 'utf8'));
    const pool = new Pool(config);
    try {
        const result = await installDatabasePackage(pool, { version: '001_baseline', schema, catalogs });
        console.log(result === 'installed' ? 'Schema and shared catalogs installed atomically.' : 'This exact baseline is already installed; no data was changed.');
    } finally { await pool.end(); }
}

main().catch((error: unknown) => {
    console.error(error instanceof ConfigurationError ? error.message : 'Initialization failed. Check configuration, confirmation, PostgreSQL 17+, and an empty target database. Existing databases are never adopted or overwritten.');
    process.exitCode = 1;
});
