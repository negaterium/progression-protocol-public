/** Build and probe a disposable copy. Never copies or loads real project environment files. */
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname, basename, sep } from 'node:path';

const root = resolve(execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim());
const scratch = join(root, 'scratch');
mkdirSync(scratch, { recursive: true });
const copy = mkdtempSync(join(scratch, 'security-build-'));
const paths = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root }).toString('utf8').split('\0');
for (const path of paths) {
    const template = path === '.env.example' || path === '.env.docker.example';
    if (!path || (/^\.env(?:\.|$)/i.test(basename(path)) && !template) || path.startsWith('scratch/') || path.startsWith('.git/')) continue;
    const source = resolve(root, path), target = resolve(copy, path);
    if (!source.startsWith(root + sep) || !target.startsWith(copy + sep)) throw new Error('Unexpected verification path.');
    if (!existsSync(source)) continue; // Deleted tracked files must not reappear.
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
}
const env = { ...process.env,
    NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
    POSTGRES_HOST: '127.0.0.1', POSTGRES_PORT: '1', POSTGRES_DATABASE: 'security_test',
    POSTGRES_USER: 'security_test', POSTGRES_PASSWORD: 'test-only-unusable',
    USE_SECURE_COOKIES: 'true', SLS_ENABLE_DEV_AUTH: 'false', SLS_DEVELOPER_USER_IDS: '',
};
const next = join(root, 'node_modules/next/dist/bin/next');
console.log(`Isolated verification directory: ${copy}`);
execFileSync(process.execPath, [next, 'build'], { cwd: copy, env, stdio: 'inherit' });

const port = 19999;
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [next, 'start', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: copy, env, stdio: ['ignore', 'pipe', 'pipe'] });
let ready = false;
server.stdout.on('data', chunk => { if (chunk.toString().includes('Ready in')) ready = true; });
let serverError = '';
server.stderr.on('data', chunk => { serverError += chunk.toString(); });
server.on('error', error => { serverError = error.message; });
try {
    const deadline = Date.now() + 15_000;
    while (!ready && Date.now() < deadline) {
        if (server.exitCode !== null || serverError.includes('EADDRINUSE')) throw new Error('Verification server failed to start; choose an unused test port.');
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!ready) throw new Error('Verification server did not become ready.');
    const checks = [
        { path: '/login', status: 200 },
        { path: '/login', status: 200, cookie: 'sls_session=malformed' },
        { path: '/dashboard', status: 307 },
        { path: '/dashboard', status: 307, cookie: 'sls_session=malformed' },
        { path: '/api/auth/me', status: 401 },
        { path: '/api/auth/me', status: 401, cookie: 'sls_session=malformed' },
        { path: '/debug-check', status: 404 },
        { path: '/fix-session.html', status: 404 },
        ...['debug-bosses', 'debug-items', 'debug-quests', 'debug-titles', 'debug/check-bosses-schema',
            'debug/check-inventory-schema', 'debug/check-quests-schema', 'debug/check-skills-schema',
            'debug/check-user-fk', 'debug/fix-session', 'debug/init-tables', 'debug/seed-quests',
            'admin/fix-keys', 'admin/setup-cosmic-bosses'].flatMap(path => [
                { path: `/api/${path}`, status: 404 }, { path: `/api/${path}`, status: 404, method: 'POST' },
            ]),
    ];
    for (const check of checks) {
        const response = await fetch(base + check.path, {
            method: check.method || 'GET', redirect: 'manual',
            headers: check.cookie ? { cookie: check.cookie } : {}, signal: AbortSignal.timeout(5000),
        });
        if (response.status !== check.status) throw new Error(`${check.method || 'GET'} ${check.path}: expected ${check.status}, received ${response.status}`);
        if (check.path === '/dashboard' && !response.headers.get('location')?.includes('/login')) throw new Error('Dashboard did not redirect to login.');
        await response.arrayBuffer();
    }
    console.log(`${checks.length} HTTP boundary checks passed. No database was contacted.`);
    // Refresh stale generated route declarations without loading root environment files.
    const typeTarget = join(root, '.next/types');
    mkdirSync(typeTarget, { recursive: true });
    for (const name of ['routes.d.ts', 'validator.ts']) {
        const generated = join(copy, '.next/types', name);
        if (existsSync(generated)) copyFileSync(generated, join(typeTarget, name));
    }
} finally {
    server.kill();
    await new Promise(resolve => { if (server.exitCode !== null) resolve(); else { server.once('exit', resolve); setTimeout(resolve, 5000).unref(); } });
}
