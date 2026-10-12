/** Export a reviewed source tree without private preparation artifacts or Git history. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, copyFile, lstat, readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { dirname, join, relative, resolve, sep } from 'node:path';

const root = resolve('.');
const scratch = resolve(root, 'scratch');
const { values } = parseArgs({ options: { output: { type: 'string' } } });
const output = resolve(root, values.output || 'scratch/public-export');
const privatePrefixes = [
    '.agent/', 'task.md', 'docs/BRANCH_REVIEW.md', 'docs/DEPENDENCY_REVIEW.md',
    'docs/PUBLICATION_SECURITY.md', 'docs/archived_plans/', 'scripts/archived/',
    'scripts/debug/', 'scripts/migrations/', 'scripts/maintenance/', 'src/resources/',
];

function isEnvironmentFile(path) {
    return /(^|\/)\.env(?:\.|$)/i.test(path) && !['.env.example', '.env.docker.example'].includes(path);
}

function runAssetGate() {
    execFileSync(process.execPath, ['scripts/community/verify-assets.mjs', '--release'], { cwd: root, stdio: 'inherit' });
}

async function main() {
    if (!output.startsWith(scratch + sep)) throw new Error('The export destination must be inside ignored scratch/.');
    try { await lstat(output); throw new Error(`Export destination already exists: ${relative(root, output)}`); }
    catch (error) { if (error?.code !== 'ENOENT') throw error; }

    runAssetGate();
    const assetManifest = JSON.parse(await readFile(join(root, 'docs/asset-manifest.json'), 'utf8'));
    const omittedAssets = new Set(assetManifest.assets.filter((asset) => asset.review === 'omitted').map((asset) => asset.path));
    const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' })
        .split('\0').filter(Boolean);
    const privateFiles = tracked.filter((path) => privatePrefixes.some((prefix) => path === prefix || path.startsWith(prefix)));
    const omittedFiles = tracked.filter((path) => omittedAssets.has(path));
    const excluded = [...new Set([...privateFiles, ...omittedFiles])].sort();
    const files = tracked.filter((path) => !excluded.includes(path) && !isEnvironmentFile(path) && !path.startsWith('scratch/'));
    await mkdir(output, { recursive: true });

    const exported = [];
    for (const path of files) {
        const source = resolve(root, path);
        const target = resolve(output, path);
        if (!source.startsWith(root + sep) || !target.startsWith(output + sep)) throw new Error(`Unsafe export path: ${path}`);
        const metadata = await lstat(source);
        if (!metadata.isFile()) throw new Error(`Only regular files can be exported: ${path}`);
        await mkdir(dirname(target), { recursive: true });
        await copyFile(source, target);
        const bytes = await readFile(target);
        exported.push({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    }

    if (omittedAssets.size > 0) {
        const publicManifest = {
            ...assetManifest,
            scope: 'public release assets',
            assets: assetManifest.assets.filter((asset) => !omittedAssets.has(asset.path)),
        };
        const manifestTarget = join(output, 'docs/asset-manifest.json');
        await writeFile(manifestTarget, JSON.stringify(publicManifest, null, 2) + '\n');
        const entry = exported.find((file) => file.path === 'docs/asset-manifest.json');
        if (entry) {
            const bytes = await readFile(manifestTarget);
            entry.bytes = bytes.length;
            entry.sha256 = createHash('sha256').update(bytes).digest('hex');
        }
    }

    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    await writeFile(join(output, 'PUBLIC_EXPORT_MANIFEST.json'), JSON.stringify({
        format: 1, sourceCommit: commit, files: exported, excluded,
    }, null, 2) + '\n');
    console.log(`Public source tree exported to ${relative(root, output)} from ${commit}.`);
    console.log(`Exported ${exported.length} files and excluded ${excluded.length} private preparation paths.`);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Public source export failed.');
    process.exitCode = 1;
});
