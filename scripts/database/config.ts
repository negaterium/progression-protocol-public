import { readFileSync } from 'node:fs';
import { processEnv } from '@next/env';
import type { PoolConfig } from 'pg';
import { ConfigurationError, parseDatabaseEnvironment } from '../../src/lib/server/environment';

/** Environment files are loaded only when the operator supplies --env-file. */
export function databaseConfig(envFile?: string): PoolConfig {
    if (envFile) {
        try {
            processEnv([{ path: envFile, contents: readFileSync(envFile, 'utf8'), env: {} }], process.cwd(),
                { info() {}, error() { throw new ConfigurationError(['ENV_FILES']); } }, true);
        } catch { throw new ConfigurationError(['ENV_FILES']); }
    }
    const env = parseDatabaseEnvironment(process.env);
    return {
        host: env.POSTGRES_HOST, port: Number(env.POSTGRES_PORT), database: env.POSTGRES_DATABASE,
        user: env.POSTGRES_USER, password: env.POSTGRES_PASSWORD,
        max: 2, connectionTimeoutMillis: 10000,
    };
}
