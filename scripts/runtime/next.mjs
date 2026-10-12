import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { ConfigurationError, parseApplicationEnvironment } from '../../src/lib/server/environment.mjs';

const require = createRequire(import.meta.url);
// @next/env is the existing environment loader supplied by the pinned Next.js.
const { loadEnvConfig } = require('@next/env');
const command = process.argv[2];
try {
    if (!['dev', 'start'].includes(command)) throw new Error('Unsupported launch command.');
    process.env.NODE_ENV = command === 'dev' ? 'development' : 'production';
    const childEnv = { ...process.env };
    delete childEnv.__NEXT_PROCESSED_ENV;
    delete process.env.__NEXT_PROCESSED_ENV;
    loadEnvConfig(process.cwd(), command === 'dev', { info() {}, error() { throw new ConfigurationError(['ENV_FILES']); } });
    parseApplicationEnvironment(process.env);
    // Leave file loading to Next itself; inherited parsed file values would lock
    // development reloads to the parent's original configuration snapshot.
    const child = spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), command, '-p', '9999', ...process.argv.slice(3)], { stdio: 'inherit', env: childEnv });
    child.once('error', () => { console.error('Unable to start Next.js. Check the locked dependency installation.'); process.exitCode = 1; });
    child.once('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
} catch (error) {
    console.error(error instanceof ConfigurationError ? error.message : 'Startup failed. Run npm ci and the configuration checker from the repository root.');
    process.exitCode = 1;
}
