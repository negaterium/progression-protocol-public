/** Verify packaging metadata from tracked/new source paths without loading env files. */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' })
    .split('\0').filter(Boolean);
const publicGate = process.argv.includes('--public');
const templates = new Set(['.env.example', '.env.docker.example']);
assert(!files.some(path => /(^|\/)\.env(?:\.|$)/i.test(path) && !templates.has(path)), 'Real environment files must not enter the package.');
assert(!files.some(path => path.startsWith('scratch/') || /\.(dump|pgpass)$/i.test(path)), 'Private recovery/test files must not enter the package.');
if (publicGate) {
    const privatePrefixes = [
        '.agent/', 'task.md', 'docs/BRANCH_REVIEW.md', 'docs/DEPENDENCY_REVIEW.md',
        'docs/PUBLICATION_SECURITY.md', 'docs/archived_plans/', 'scripts/archived/',
        'scripts/debug/', 'scripts/migrations/', 'scripts/maintenance/', 'src/resources/',
    ];
    const privateFiles = files.filter((path) => privatePrefixes.some((prefix) => path === prefix || path.startsWith(prefix)));
    if (privateFiles.length > 0) {
        console.error('Public package gate failed; remove private preparation artifacts before publication:');
        console.error(privateFiles.join('\n'));
        process.exit(1);
    }
}
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
assert.equal(packageJson.private, true, 'npm publishing remains disabled.');
assert.equal(packageJson.license, 'MIT');
assert.equal(lock.packages[''].license, packageJson.license);
assert.equal(lock.packages[''].engines.node, packageJson.engines.node);
for (const section of ['dependencies', 'devDependencies']) assert.deepEqual(lock.packages[''][section], packageJson[section]);
const manifest = JSON.parse(readFileSync('database/manifest.json', 'utf8'));
for (const [path, field] of [['database/migrations/001_baseline.sql', 'schemaSha256'], ['database/seeds/catalogs.json', 'catalogsSha256']]) {
    const data = readFileSync(path);
    assert.equal(data.includes(Buffer.from('\r\n')), false, 'Checksummed database files must use LF.');
    assert.equal(createHash('sha256').update(data).digest('hex'), manifest[field], 'Database manifest mismatch.');
}
for (const path of ['LICENSE', 'CONTRIBUTING.md', 'SECURITY.md', 'docs/LICENSING.md', 'docs/ASSET_REVIEW.md', 'docs/ASSET_LICENSE.md',
    '.github/PULL_REQUEST_TEMPLATE.md', '.github/ISSUE_TEMPLATE/bug.yml', '.github/ISSUE_TEMPLATE/feature.yml',
    '.github/workflows/ci.yml', '.github/CODEOWNERS', '.github/dependabot.yml',
    'CODE_OF_CONDUCT.md', 'SUPPORT.md', 'THIRD_PARTY_NOTICES.md', 'docs/FAN_PROJECT_NOTICE.md',
    'docs/RELEASE_CHECKLIST.md', 'docs/SMOKE_TESTS.md', 'scripts/database/migrate.ts',
    'scripts/community/export-public-tree.mjs']) {
    assert(files.includes(path), `Missing community file: ${path}`);
}
assert(readFileSync('LICENSE', 'utf8').startsWith('MIT License\n'));
console.log('Community metadata, private-file exclusions and database checksums verified. Public release gates remain separate.');
