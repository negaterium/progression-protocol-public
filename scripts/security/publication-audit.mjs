/** Location-only audit. Reads only approved public templates, never real environment files or matches in output. */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const history = process.argv.includes('--history');
const ownerIndex = process.argv.indexOf('--owner');
const owner = ownerIndex >= 0 ? process.argv[ownerIndex + 1]?.toLowerCase() : undefined;
const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 64 * 1024 * 1024 });
const template = path => path === '.env.example' || path === '.env.docker.example';
const forbidden = path => /^\.env(?:\.|$)/i.test(basename(path)) && !template(path);
const textFile = path => /\.(?:[cm]?[jt]sx?|json|ya?ml|sql|md|html?|css|sh|ps1|toml|txt|log|conf|ini|xml|pem|key|example)$/i.test(path)
    || /(?:^|\/)(?:Dockerfile|\.gitignore|\.dockerignore)$/i.test(path) || template(path);
const placeholder = value => /^(?:|postgres|password|your[_-].*|example.*|replace[_-].*|change[_-]?me|test.*|dummy.*|MySecurePass123|\$.*)$/i.test(value);
const findings = [];
let checkedFiles = 0;
let checkedBlobs = 0;
const skipped = [];

function inspect(path, content, revision = 'working-tree') {
    const lines = content.split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
        const categories = new Set();
        const literal = line.match(/(?:password|passwd|api[_-]?key|client[_-]?secret)\s*[:=]\s*['"]([^'"]+)['"]/i)
            || line.match(/process\.env\.[A-Z_]*(?:PASSWORD|SECRET|TOKEN|KEY)\s*\|\|\s*['"]([^'"]+)['"]/)
            || line.match(/(?:PASSWORD|SECRET|TOKEN|API_KEY)[^\n]*?\$\{[^}]*:-([^}]+)\}/);
        if (literal && !placeholder(literal[1])) categories.add('credential-literal');
        if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(line)) categories.add('private-key');
        if (/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16}|sk-(?:proj-)?[A-Za-z0-9_-]{30,})/.test(line)) categories.add('access-token');
        if (/(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s/:]+:[^\s/@]+@/i.test(line)) categories.add('credential-url');
        if (/\b(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/.test(line)) categories.add('private-infrastructure');
        if (owner && line.toLowerCase().includes(owner)) categories.add('owner-reference');
        for (const category of categories) findings.push({ revision, path, line: index + 1, category });
    }
}

const tracked = git('ls-files', '--cached', '--others', '--exclude-standard', '-z').toString('utf8').split('\0').filter(Boolean);
for (const path of tracked) {
    if (forbidden(path)) {
        findings.push({ revision: 'working-tree', path, category: 'tracked-environment-file-not-read' });
    } else if (textFile(path) && existsSync(resolve(root, path))) {
        inspect(path, readFileSync(resolve(root, path), 'utf8'));
        checkedFiles++;
    }
}

if (history) {
    const objects = git('rev-list', '--objects', '--all').toString('utf8').trim().split('\n');
    const protectedObjects = new Set(objects.filter(line => forbidden(line.slice(41))).map(line => line.slice(0, 40)));
    // Inspect environment paths in every tree: rev-list may name a shared blob
    // using a different path. Protect these blob IDs before requesting contents.
    for (const commit of git('rev-list', '--all').toString('utf8').trim().split('\n')) {
        for (const entry of git('ls-tree', '-r', '-z', commit).toString('utf8').split('\0')) {
            const [metadata, path] = entry.split('\t');
            if (!path || !forbidden(path)) continue;
            const revision = metadata.split(' ')[2];
            protectedObjects.add(revision);
            if (!findings.some(item => item.revision === revision.slice(0, 12) && item.path === path)) {
                findings.push({ revision: revision.slice(0, 12), path, category: 'historical-environment-file-not-read' });
            }
        }
    }
    const candidates = objects.map(entry => ({ revision: entry.slice(0, 40), path: entry.slice(41) }))
        .filter(entry => entry.path && textFile(entry.path) && !protectedObjects.has(entry.revision));
    const input = candidates.map(entry => entry.revision).join('\n') + '\n';
    const metadata = execFileSync('git', ['cat-file', '--batch-check'], { cwd: root, input, maxBuffer: 64 * 1024 * 1024 })
        .toString('utf8').trim().split('\n');
    const blobs = candidates.filter((entry, index) => {
        const [, type, size] = metadata[index].split(' ');
        if (type !== 'blob') return false;
        if (Number(size) > 4 * 1024 * 1024) {
            skipped.push({ revision: entry.revision.slice(0, 12), path: entry.path, reason: 'text blob exceeds 4 MiB' });
            return false;
        }
        return true;
    });
    // Batch contents to avoid one process per historical file on Windows.
    for (let start = 0; start < blobs.length; start += 50) {
        const group = blobs.slice(start, start + 50);
        const buffer = execFileSync('git', ['cat-file', '--batch'], {
            cwd: root, input: group.map(entry => entry.revision).join('\n') + '\n', maxBuffer: 256 * 1024 * 1024,
        });
        let position = 0;
        for (const { revision, path } of group) {
            const end = buffer.indexOf(10, position);
            const size = Number(buffer.subarray(position, end).toString('utf8').split(' ')[2]);
            position = end + 1;
            inspect(path, buffer.subarray(position, position + size).toString('utf8'), revision.slice(0, 12));
            position += size + 1;
            checkedBlobs++;
        }
    }
}

const counts = findings.reduce((result, finding) => {
    const scope = finding.revision === 'working-tree' ? 'workingTree' : 'history';
    result[scope][finding.category] = (result[scope][finding.category] || 0) + 1;
    return result;
}, { workingTree: {}, history: {} });
console.log(JSON.stringify({
    coverage: { checkedFiles, checkedBlobs, history, skipped, limitations: [
        'Heuristic scan, not a substitute for a dedicated secret scanner or manual review.',
        'Real environment file contents and binary assets are never read; only the two approved public templates and locally reachable history are scanned.',
        'Placeholder credentials are excluded; matches contain locations only, never values.',
    ] }, counts, findings,
}, null, 2));
const secretCategories = new Set(['credential-literal', 'private-key', 'access-token', 'credential-url', 'tracked-environment-file-not-read', 'historical-environment-file-not-read']);
if (findings.some(finding => secretCategories.has(finding.category))) process.exitCode = 1;
