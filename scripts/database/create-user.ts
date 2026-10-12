import { parseArgs } from 'node:util';
import { Pool } from 'pg';
import { databaseConfig } from './config';
import { promptPassword } from '../lib/prompt-password';
import { provisionPlayer } from '../../src/lib/server/player-provisioning';
import { ConfigurationError } from '../../src/lib/server/environment';

async function main() {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: {
        'env-file': { type: 'string' }, 'target-database': { type: 'string' },
    } });
    if (positionals.length !== 1) throw new Error('Supply one username; never put a password in arguments.');
    const config = databaseConfig(values['env-file']);
    if (values['target-database'] !== config.database) throw new Error('Supply --target-database matching the configured database.');
    const password = await promptPassword();
    const pool = new Pool(config);
    try {
        const userId = await provisionPlayer(pool, positionals[0], password);
        console.log(`Player created with profile and stats. User ID: ${userId}`);
        console.log('Developer privileges require separate SLS_DEVELOPER_USER_IDS configuration.');
    } finally { await pool.end(); }
}

main().catch((error: unknown) => {
    console.error(error instanceof ConfigurationError ? error.message : 'Player creation failed. Check configuration, target database, unique username and password requirements. Existing accounts are never reset.');
    process.exitCode = 1;
});
