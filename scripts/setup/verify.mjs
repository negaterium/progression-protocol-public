/** Verify source-only installation with fresh dependencies and separate PostgreSQL. */
import { execFile } from 'node:child_process';
import { promisify, parseArgs } from 'node:util';
import { mkdir, mkdtemp, readFile, writeFile, copyFile, lstat } from 'node:fs/promises';
import { resolve, join, dirname, basename, sep } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const run = promisify(execFile);
const { values } = parseArgs({ options: { 'use-build-cache': { type: 'boolean', default: false }, deployment: { type: 'boolean', default: false } } });
const root = resolve('.');
const suffix = randomBytes(6).toString('hex');
const prefix = `sls-setup-${suffix}`;
const network = `${prefix}-network`, postgres = `${prefix}-postgres`, app = `${prefix}-app`;
const runtimeImage = `${prefix}:runtime`, toolsImage = `${prefix}:tools`;
let stage = 'source copy';
let networkCreated = false;
const containers = [], images = [];
const checks = [];
let logsDir;
let composeArgs, composeEnv;

function docker(args, { input, ...options } = {}) {
    return new Promise((resolve, reject) => {
        const child = execFile('docker', args, { maxBuffer: 32 * 1024 * 1024, timeout: 120000, ...options }, (error, stdout, stderr) => {
            if (error) { error.stdout = stdout; error.stderr = stderr; reject(error); }
            else resolve({ stdout, stderr });
        });
        child.stdin?.end(input ?? '');
    });
}

async function main() {
    await mkdir(join(root, 'scratch'), { recursive: true });
    const copy = await mkdtemp(join(root, 'scratch', 'setup-clean-'));
    logsDir = join(copy, 'verification');
    const files = (await run('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { maxBuffer: 8 * 1024 * 1024 })).stdout.split('\0');
    for (const file of files) {
        const template = file === '.env.example' || file === '.env.docker.example';
        if (!file || (/^\.env(?:\.|$)/i.test(basename(file)) && !template) || file.startsWith('scratch/') || file.startsWith('.git/')) continue;
        const source = resolve(root, file), target = resolve(copy, file);
        assert(source.startsWith(root + sep) && target.startsWith(copy + sep));
        let metadata;
        try { metadata = await lstat(source); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
        assert(!metadata.isSymbolicLink(), 'Source snapshot must not follow external symlinks.');
        await mkdir(dirname(target), { recursive: true });
        await copyFile(source, target);
    }
    await mkdir(logsDir);
    // Generated logs/configuration must not enter either build context. Keeping
    // the context stable also lets the tools target reuse the runtime build layers.
    await writeFile(join(copy, '.dockerignore'), (await readFile(join(copy, '.dockerignore'), 'utf8'))
        + '\n/verification/\nsetup.env\ncompose-test.yml\nnginx-test.conf\n');
    const exists = async path => lstat(path).then(() => true, () => false);
    assert.equal(await exists(join(copy, 'node_modules')), false);
    assert.equal(await exists(join(copy, '.env.local')), false);
    assert.equal(await exists(join(copy, '.env')), false);
    checks.push('source snapshot excludes installed dependencies and real environment files');
    console.log('Building a clean source copy with npm ci and Node.js 22. Build logs remain under ignored scratch.');
    stage = 'clean runtime build';
    images.push(runtimeImage);
    try {
        const built = await docker(['build', ...(values['use-build-cache'] ? [] : ['--no-cache']), '--tag', runtimeImage, copy], { timeout: 600000 });
        await writeFile(join(logsDir, 'build.log'), built.stdout + built.stderr);
    } catch (error) {
        await writeFile(join(logsDir, 'build.log'), String(error.stdout || '') + String(error.stderr || ''));
        throw error;
    }
    images.push(toolsImage);
    await docker(['build', '--target', 'builder', '--tag', toolsImage, copy], { timeout: 600000 });
    checks.push('locked dependency installation and credential-free production build');
    stage = 'template rejection';
    const file = join(copy, 'setup.env');
    const template = await readFile(join(copy, '.env.example'), 'utf8');
    await writeFile(file, template);
    const mount = ['--mount', `type=bind,source=${file},target=/config/setup.env,readonly`];
    const tools = async (command, args = [], input) => {
        try {
            return await docker(['run', '--rm', ...(input === undefined ? [] : ['--interactive']), '--network', network, ...mount,
                '--env', 'NODE_ENV=production', toolsImage, 'npm', 'run', command, '--', ...args], input === undefined ? {} : { input });
        } catch (error) {
            await writeFile(join(logsDir, `${command.replace(/\W/g, '-')}.log`), String(error.stdout || '') + String(error.stderr || ''));
            throw error;
        }
    };
    await docker(['network', 'create', network]); networkCreated = true;
    await assert.rejects(tools('config:check', ['--env-file', '/config/setup.env']), error => {
        assert(String(error.stderr).includes('POSTGRES_PASSWORD'));
        assert(!String(error.stderr).includes('replace_me'));
        return true;
    });
    checks.push('unconfigured template fails with field-only guidance');
    const databasePassword = randomBytes(24).toString('base64url') + '$literal';
    const playerPassword = randomBytes(24).toString('base64url');
    const database = `sls_setup_${suffix}`;
    const configured = template.replace(/^POSTGRES_HOST=.*$/m, 'POSTGRES_HOST=postgres')
        .replace(/^POSTGRES_DATABASE=.*$/m, `POSTGRES_DATABASE=${database}`)
        .replace(/^POSTGRES_PASSWORD=.*$/m, () => `POSTGRES_PASSWORD=${databasePassword.replace(/\$/g, '\\$')}`);
    await writeFile(file, configured);
    stage = 'separate PostgreSQL startup';
    containers.push(postgres);
    await docker(['run', '--detach', '--rm', '--name', postgres, '--network', network, '--network-alias', 'postgres',
        '--env', 'POSTGRES_PASSWORD', '--env', 'POSTGRES_USER=sls_app', '--env', `POSTGRES_DB=${database}`, 'postgres:17'],
        { env: { ...process.env, POSTGRES_PASSWORD: databasePassword } });
    const deadline = Date.now() + 30000;
    while (true) {
        try { await docker(['exec', postgres, 'pg_isready', '-h', '127.0.0.1', '-U', 'sls_app']); break; }
        catch { if (Date.now() > deadline) throw new Error('PostgreSQL did not start.'); await new Promise(resolve => setTimeout(resolve, 300)); }
    }
    stage = 'documented configuration check';
    await tools('config:check', ['--env-file', '/config/setup.env', '--mode', 'production']);
    stage = 'documented initialization command';
    await tools('db:init', ['--env-file', '/config/setup.env', '--target-database', database, '--confirm']);
    stage = 'documented migration command';
    await tools('db:migrate', ['--env-file', '/config/setup.env', '--target-database', database, '--confirm']);
    stage = 'documented migration check';
    await tools('db:migrate', ['--env-file', '/config/setup.env', '--target-database', database, '--check']);
    stage = 'documented player creation command';
    await tools('db:create-user', ['setup_hunter', '--env-file', '/config/setup.env', '--target-database', database], playerPassword + '\n');
    stage = 'documented read-only doctor';
    await tools('config:doctor', ['--env-file', '/config/setup.env', '--mode', 'production']);
    checks.push('documented configuration, initialization, migration apply/check, account creation and read-only doctor commands');
    stage = 'player credentials/profile';
    // Invoke the internal helper with stdin to keep the test password out of argv.
    const verified = await docker(['run', '--rm', '--interactive', '--network', network, ...mount, toolsImage,
        'node', 'node_modules/tsx/dist/cli.mjs', 'scripts/setup/verify-player.ts'], { input: JSON.stringify({ password: playerPassword }) });
    const { sessionId } = JSON.parse(verified.stdout);
    assert.match(sessionId, /^[a-f0-9-]{36}$/);
    checks.push('bcrypt credentials and complete level-one player data');
    stage = 'startup rejection';
    const invalid = `${prefix}-invalid`;
    containers.push(invalid);
    let invalidError;
    try { await docker(['run', '--rm', '--name', invalid, runtimeImage], { timeout: 20000 }); }
    catch (error) {
        invalidError = error;
        await writeFile(join(logsDir, 'invalid-startup.log'), String(error.stdout || '') + String(error.stderr || ''));
    }
    assert(invalidError, 'Missing configuration must fail startup.');
    assert(Number.isInteger(invalidError.code) && invalidError.code !== 0 && !invalidError.killed, 'Invalid startup must exit, not just time out.');
    assert(String(invalidError.stderr).includes('POSTGRES_HOST'));
    checks.push('standalone startup rejects missing configuration');
    stage = 'standalone runtime';
    const env = { ...process.env, POSTGRES_HOST: 'postgres', POSTGRES_PORT: '5432', POSTGRES_DATABASE: database,
        POSTGRES_USER: 'sls_app', POSTGRES_PASSWORD: databasePassword, USE_SECURE_COOKIES: 'false',
        SLS_ENABLE_DEV_AUTH: 'false', SLS_DEV_USER_ID: '', SLS_DEVELOPER_USER_IDS: '', SLS_TRUST_PROXY_HEADERS: 'false' };
    const keys = ['POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_DATABASE', 'POSTGRES_USER', 'POSTGRES_PASSWORD',
        'USE_SECURE_COOKIES', 'SLS_ENABLE_DEV_AUTH', 'SLS_DEV_USER_ID', 'SLS_DEVELOPER_USER_IDS', 'SLS_TRUST_PROXY_HEADERS'];
    containers.push(app);
    await docker(['run', '--detach', '--name', app, '--network', network, '--publish', '127.0.0.1::9999',
        ...keys.flatMap(key => ['--env', key]), runtimeImage], { env });
    const port = (await docker(['port', app, '9999/tcp'])).stdout.trim().split(':').at(-1);
    const base = `http://127.0.0.1:${port}`;
    stage = 'standalone login page readiness';
    const readyDeadline = Date.now() + 20000;
    while (true) {
        try {
            const response = await fetch(base + '/login', { signal: AbortSignal.timeout(3000) });
            assert.equal(response.status, 200); await response.arrayBuffer(); break;
        } catch { if (Date.now() > readyDeadline) throw new Error('App did not become ready.'); await new Promise(resolve => setTimeout(resolve, 300)); }
    }
    stage = 'anonymous authentication boundary';
    assert.equal((await fetch(base + '/api/auth/me')).status, 401);
    const headers = { cookie: `sls_session=${sessionId}` };
    stage = 'authenticated session endpoint';
    const authenticated = await fetch(base + '/api/auth/me', { headers });
    assert.equal(authenticated.status, 200);
    assert.equal((await authenticated.json()).user.username, 'setup_hunter');
    for (const route of ['/dashboard', '/dashboard/profile', '/dashboard/quests', '/dashboard/store', '/dashboard/inventory', '/dashboard/skills']) {
        stage = `authenticated page ${route}`;
        const response = await fetch(base + route, { headers, redirect: 'manual', signal: AbortSignal.timeout(10000) });
        assert.equal(response.status, 200);
        await response.arrayBuffer();
    }
    for (const [legacyPath, expectedPath] of [
        ['/dashboard/inventory?s_tab=store', '/dashboard/store'],
        ['/dashboard/inventory?s_tab=altar', '/dashboard/store?s_tab=altar'],
    ]) {
        stage = `legacy market redirect ${legacyPath}`;
        const response = await fetch(base + legacyPath, { headers, redirect: 'manual', signal: AbortSignal.timeout(10000) });
        assert.equal(response.status, 307);
        const location = new URL(response.headers.get('location'), base);
        assert.equal(location.pathname + location.search, expectedPath);
        await response.arrayBuffer();
    }
    checks.push('standalone public login, six authenticated pages and legacy market redirects using separate PostgreSQL');
    if (values.deployment) {
        stage = 'recovery data preparation';
        const recoveryHelper = async operation => docker(['run', '--rm', '--network', network, ...mount, toolsImage,
            'node', 'node_modules/tsx/dist/cli.mjs', 'scripts/deployment/verify-recovery.ts', operation]);
        await recoveryHelper('prepare');
        stage = 'full custom-format backup';
        const pgEnv = { ...process.env, PGPASSWORD: databasePassword };
        await docker(['exec', '--env', 'PGPASSWORD', postgres, 'pg_dump', '-h', '127.0.0.1', '-U', 'sls_app', '-d', database,
            '--format=custom', '--no-owner', '--no-acl', '--no-password', '--file=/tmp/database.dump'], { env: pgEnv });
        await docker(['cp', `${postgres}:/tmp/database.dump`, join(logsDir, 'database.dump')]);
        const digest = createHash('sha256').update(await readFile(join(logsDir, 'database.dump'))).digest('hex');
        await writeFile(join(logsDir, 'database.dump.sha256'), digest + '\n');
        await docker(['exec', postgres, 'pg_restore', '--list', '/tmp/database.dump']);
        stage = 'restore into a different empty database';
        await docker(['exec', '--env', 'PGPASSWORD', postgres, 'pg_restore', '-h', '127.0.0.1', '-U', 'sls_app',
            '--dbname=sls_recovery', '--no-owner', '--no-acl', '--no-password', '--single-transaction', '--exit-on-error',
            '/tmp/database.dump'], { env: pgEnv });
        await recoveryHelper('compare');
        stage = 'restore conflict protection';
        await assert.rejects(docker(['exec', '--env', 'PGPASSWORD', postgres, 'pg_restore', '-h', '127.0.0.1', '-U', 'sls_app',
            '--dbname=sls_recovery', '--no-owner', '--no-acl', '--no-password', '--single-transaction', '--exit-on-error',
            '/tmp/database.dump'], { env: pgEnv }));
        await recoveryHelper('compare');
        checks.push('full backup/atomic recovery preserves all 28 public tables, sequences and indexes; conflicting rerun fails without changing data');
        stage = 'production Compose configuration';
        const override = join(copy, 'compose-test.yml');
        // Use a copy with only its network declaration changed. Merging an external
        // network override into the bridge definition retains incompatible fields.
        await writeFile(override, (await readFile(join(copy, 'compose.production.yml'), 'utf8'))
            .replace('driver: bridge', `external: true\n    name: ${network}`));
        // All settings are synthetic and explicitly injected; no ambient .env is read.
        composeEnv = { ...env, SLS_APP_IMAGE: runtimeImage, SLS_APP_PORT: '0', COMPOSE_ENV_FILES: '', COMPOSE_DISABLE_ENV_FILE: 'true' };
        composeArgs = ['compose', '--project-name', `${prefix}-production`, '--env-file', file, '-f', override];
        const compose = args => docker([...composeArgs, ...args], { env: composeEnv });
        await compose(['config', '--quiet']);
        // Inspect the synthetic model internally; never print its credential-bearing JSON.
        const model = JSON.parse((await compose(['config', '--format', 'json'])).stdout);
        assert.deepEqual(Object.keys(model.services), ['app']);
        assert.equal(model.services.app.ports[0].host_ip, '127.0.0.1');
        // Rendered config can escape dollar signs for round-tripping. Verify the
        // literal credential through the actual container's database access below.
        assert.equal(model.services.app.environment.SLS_ENABLE_DEV_AUTH, 'false');
        stage = 'recovery Compose startup and health';
        composeEnv.POSTGRES_DATABASE = 'sls_recovery';
        await compose(['up', '-d', '--wait', '--wait-timeout', '120']);
        const probe = async () => {
            const recoveredPort = (await compose(['port', 'app', '9999'])).stdout.trim().split(':').at(-1);
            const recoveredBase = `http://127.0.0.1:${recoveredPort}`;
            const response = await fetch(recoveredBase + '/api/auth/me', { headers });
            assert.equal(response.status, 200);
            assert.equal((await response.json()).user.username, 'setup_hunter');
            const dashboard = await fetch(recoveredBase + '/dashboard', { headers });
            assert.equal(dashboard.status, 200); await dashboard.arrayBuffer();
        };
        await probe();
        stage = 'return to source database with Compose';
        composeEnv.POSTGRES_DATABASE = database;
        await compose(['up', '-d', '--wait', '--wait-timeout', '120']);
        await probe();
        checks.push('production Compose loopback/health/recreation works on recovered database and after returning to source');
        stage = 'proxy configuration syntax';
        await docker(['run', '--rm', '--mount', `type=bind,source=${join(copy, 'deployment', 'Caddyfile.example')},target=/etc/caddy/Caddyfile,readonly`,
            'caddy:2-alpine', 'caddy', 'validate', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile']);
        // Check routing/header/streaming syntax without fabricating a real TLS certificate.
        const nginxFile = join(copy, 'nginx-test.conf');
        const nginx = (await readFile(join(copy, 'deployment', 'nginx.conf.example'), 'utf8'))
            .replace('listen 443 ssl;', 'listen 443;').replace(/^\s*ssl_certificate(?:_key)? .*;\s*$/gm, '');
        await writeFile(nginxFile, nginx);
        await docker(['run', '--rm', '--mount', `type=bind,source=${nginxFile},target=/etc/nginx/conf.d/default.conf,readonly`, 'nginx:stable-alpine', 'nginx', '-t']);
        checks.push('Caddy configuration and Nginx routing/header/streaming syntax validated (real TLS certificates excluded)');
        await mkdir(join(root, 'scratch', 'deployment-verification'), { recursive: true });
        await writeFile(join(root, 'scratch', 'deployment-verification', 'result.json'), JSON.stringify({ passed: true, checks,
            publicTlsTested: false, systemdTested: false, futureSchemaMigrationTested: false }, null, 2) + '\n');
        console.log('Deployment rehearsal verified: Compose health/recovery switch, full archive restoration and proxy configuration syntax.');
    }
    await mkdir(join(root, 'scratch', 'setup-verification'), { recursive: true });
    await writeFile(join(root, 'scratch', 'setup-verification', 'result.json'), JSON.stringify({ passed: true, checks, browserLoginFormTested: false, dependencyBuildCacheAllowed: values['use-build-cache'] }, null, 2) + '\n');
    console.log('Clean source setup verified: template checks, fresh database/player, read-only doctor, standalone startup and authenticated pages.');
}

try { await main(); }
catch {
    console.error(`Clean setup verification failed at ${stage}. Inspect the local verification code and redacted configuration errors; raw tool/connection errors are not printed.`);
    process.exitCode = 1;
} finally {
    if (composeArgs) await docker([...composeArgs, 'down'], { env: composeEnv }).catch(() => {});
    if (logsDir && containers.includes(app)) {
        const logs = await docker(['logs', app]).catch(() => null);
        if (logs) await writeFile(join(logsDir, 'runtime.log'), logs.stdout + logs.stderr);
    }
    for (const name of containers.reverse()) await docker(['rm', '--force', name]).catch(() => {});
    if (networkCreated) await docker(['network', 'rm', network]).catch(() => {});
    for (const name of images.reverse()) await docker(['image', 'rm', name]).catch(() => {});
}
