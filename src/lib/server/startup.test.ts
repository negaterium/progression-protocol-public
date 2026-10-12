// @vitest-environment node
import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const directories: string[] = [];
function fixture(config = '') {
    const dir = mkdtempSync(join(tmpdir(), 'sls-launcher-'));
    directories.push(dir);
    if (config) writeFileSync(join(dir, '.env.local'), config);
    const binary = join(dir, 'node_modules', 'next', 'dist', 'bin');
    mkdirSync(binary, { recursive: true });
    writeFileSync(join(binary, 'next'), 'console.log(JSON.stringify({mode:process.env.NODE_ENV,args:process.argv.slice(2),fileSettingsInherited:!!process.env.POSTGRES_HOST}));');
    return dir;
}
const valid = 'POSTGRES_HOST=localhost\nPOSTGRES_DATABASE=sls_test\nPOSTGRES_USER=sls_test\nPOSTGRES_PASSWORD=test-only-private-sentinel\n';
function launch(dir: string, extra: Record<string, string> = {}) {
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(POSTGRES_|PG|SLS_|NEXT_|NODE_ENV$|USE_SECURE_COOKIES$|PORT$)/.test(key)));
    return spawnSync(process.execPath, [resolve('scripts/runtime/next.mjs'), 'dev', '--hostname', '127.0.0.1'], {
        cwd: dir, env: { ...env, ...extra, NODE_ENV: 'test' }, encoding: 'utf8', timeout: 10000,
    });
}
afterEach(() => {
    for (const dir of directories.splice(0)) {
        // Verify the absolute deletion target is the explicitly created temp folder.
        expect(resolve(dir).startsWith(resolve(tmpdir()) + sep)).toBe(true);
        expect(basename(dir).startsWith('sls-launcher-')).toBe(true);
        rmSync(dir, { recursive: true, force: true });
    }
});

it('rejects missing settings before the Next.js launcher executes', () => {
    const response = launch(fixture());
    expect(response.status).toBe(1);
    expect(response.stderr).toContain('POSTGRES_HOST');
    expect(response.stdout).toBe('');
});
it('loads a selected-mode local file and preserves the port and extra CLI options', () => {
    const response = launch(fixture(valid));
    expect(response.status).toBe(0);
    expect(JSON.parse(response.stdout)).toEqual({ mode: 'development', args: ['dev', '-p', '9999', '--hostname', '127.0.0.1'], fileSettingsInherited: false });
});
it('rejects malformed flags without printing supplied values or credentials', () => {
    const response = launch(fixture(valid + 'SLS_TRUST_PROXY_HEADERS=PRIVATE_SENTINEL\n'));
    expect(response.status).toBe(1);
    expect(response.stderr).toContain('SLS_TRUST_PROXY_HEADERS');
    expect(response.stderr).not.toMatch(/PRIVATE_SENTINEL|test-only-private-sentinel/);
});
it('keeps process settings ahead of the local file', () => {
    const response = launch(fixture(valid + 'POSTGRES_PORT=5432\n'), { POSTGRES_PORT: '5432x' });
    expect(response.status).toBe(1);
    expect(response.stderr).toContain('POSTGRES_PORT');
});
it('uses the same dollar escaping rules for explicit database files and Next.js', () => {
    const dir = fixture(valid.replace('test-only-private-sentinel', String.raw`test-only-\$literal`));
    const script = join(dir, 'check-file.ts');
    const moduleUrl = pathToFileURL(resolve('scripts/database/config.ts')).href;
    writeFileSync(script, `import { databaseConfig } from ${JSON.stringify(moduleUrl)}; console.log(databaseConfig(process.argv[2]).password === 'test-only-$literal');`);
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(POSTGRES_|PG|SLS_|NEXT_|__NEXT|NODE_ENV$|USE_SECURE_COOKIES$|PORT$)/.test(key)));
    const response = spawnSync(process.execPath, [resolve('node_modules/tsx/dist/cli.mjs'), script, join(dir, '.env.local')], {
        cwd: dir, env: { ...env, NODE_ENV: 'test' }, encoding: 'utf8', timeout: 10000,
    });
    expect(response.status).toBe(0);
    expect(response.stdout.trim()).toBe('true');
});
