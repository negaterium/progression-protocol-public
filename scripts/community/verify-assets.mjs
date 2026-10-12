/** Read only inventoried repository assets; no environment or database access. */
import { readFileSync, existsSync, lstatSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, sep, basename } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve('.');
const manifest = JSON.parse(readFileSync('docs/asset-manifest.json', 'utf8'));
const releaseGate = process.argv.includes('--release');
const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const expected = tracked.filter(path => path.startsWith('public/') || /\.(png|webp|jpe?g|gif|pdf|zip|mp[34]|woff2?|ico|ttf)$/i.test(path));
assert.deepEqual(manifest.assets.map(asset => asset.path).sort(), expected.sort(), 'Asset inventory does not match tracked assets.');
for (const asset of manifest.assets) {
    assert(asset.path.startsWith('public/') || /\.(png|webp|jpe?g|gif|pdf|zip|mp[34]|woff2?|ico|ttf)$/i.test(asset.path));
    const path = resolve(root, asset.path);
    assert(path.startsWith(root + sep), 'Asset path leaves repository.');
    assert(!/^\.env(?:\.|$)/i.test(basename(path)), 'Environment files are not assets.');
    assert(lstatSync(path).isFile(), 'Asset review must not follow symlinks.');
    let data = readFileSync(path);
    if (asset.normalization) {
        assert.equal(asset.normalization, 'lf-text');
        assert(asset.path.endsWith('.svg'), 'Only SVG text has canonical line endings.');
        data = Buffer.from(data.toString('utf8').replace(/\r\n/g, '\n'));
    }
    assert.equal(data.length, asset.bytes, `Asset size changed: ${asset.path}`);
    assert.equal(createHash('sha256').update(data).digest('hex'), asset.sha256, `Asset changed: ${asset.path}`);
}
const catalogs = JSON.parse(readFileSync('database/seeds/catalogs.json', 'utf8'));
const missing = [];
for (const [table, rows] of Object.entries(catalogs)) for (const row of rows) {
    if (typeof row.image_url === 'string' && row.image_url.startsWith('/')) {
        const path = 'public' + row.image_url;
        if (!existsSync(path)) missing.push({ table, id: row.id, path });
    }
}
assert.deepEqual(missing, manifest.missingCatalogImageReferences, 'Catalog image findings changed; update the review.');
const pending = manifest.assets.filter(asset => !['approved', 'omitted'].includes(asset.review)).length;
const omitted = manifest.assets.filter(asset => asset.review === 'omitted').length;
const invalidApproved = manifest.assets.filter(asset => asset.review === 'approved' && typeof asset.license !== 'string').length;
console.log(`${manifest.assets.length} asset hashes verified; ${pending} provenance/rights reviews pending; ${omitted} marked for omission; ${missing.length} known missing catalog image references.`);
if (releaseGate && (pending > 0 || missing.length > 0 || invalidApproved > 0)) {
    console.error(`Release asset gate failed: ${pending} reviews pending, ${invalidApproved} approved entries lack a license, and ${missing.length} catalog image references missing.`);
    process.exitCode = 1;
} else {
    console.log(releaseGate
        ? 'Release asset gate passed: all inventoried assets are approved and catalog references resolve.'
        : 'Integrity verification does not grant redistribution rights.');
}
