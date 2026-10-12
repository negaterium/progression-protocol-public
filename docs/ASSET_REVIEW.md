# Asset provenance and release review

This application is an unofficial, non-commercial fan project. See the
[fan-project notice](FAN_PROJECT_NOTICE.md) before redistributing catalog text,
artwork or branding.

Original code is MIT; [licensing scope](LICENSING.md) separates that grant from
visual assets and other creative material. The retained public visual assets are
owner-generated SDXL 1.0 outputs and are released under [CC0 1.0](ASSET_LICENSE.md)
to the extent that the owner controls applicable rights. The asset license does
not clear third-party names, characters, lore, trademarks or other branding.

## Recorded inventory

[asset-manifest.json](asset-manifest.json) records 190 tracked assets with byte
sizes and SHA-256 fingerprints: 160 served files under `public` (about 34.5 MiB)
and 30 other binaries (339,703,248 bytes). The latter include the favicon,
high-resolution boss PNG originals and five reference screenshots in `src/resources`.
SVG fingerprints use canonical LF text so Windows CRLF conversion does not change
their recorded content; image binaries are checked byte for byte.
No application/script references to `src/resources` were found in the initial scan.
Keep these private originals separate from a future public distribution decision.

The owner confirmed that the retained public assets, including the favicon, were
generated locally with SDXL 1.0 from text-only prompts and no reference images. The
manifest records that provenance and marks those 161 files `approved` under
`CC0-1.0`. The exact SDXL checkpoint or adapter revision was not retained; if a
non-standard checkpoint or adapter was used, verify its terms before publishing.
The 29 binaries under `src/resources` are marked `omitted` and will not enter a
public export. Five reference screenshots were visually reviewed and contain
interface imagery/player-like sample content, so they remain excluded. No assets
were edited or removed by this review.

The retained-file review records the creator/source, model context, reference-image
status, license and privacy decision. No reference images or personal likenesses
were used according to the owner's statement. Keep personal creator contact details
and private correspondence out of the repository. The model notice and asset license
are recorded in [ASSET_LICENSE.md](ASSET_LICENSE.md) and
[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

Possible release decisions for future changes are: retain with documented
permission/notices, replace with original cleared artwork, or omit from the public
package. Check UI/catalog references after replacements. Catalog descriptions,
character names and branding inspired by *Solo Leveling* or D&D need their own
review; the file inventory does not decide those rights.

## Missing catalog image references

The shared catalog package previously referenced six image files that were not
present in the repository. The seed entries now use `NULL`, and migration
`003_clear_missing_item_images.sql` clears the same stale URLs for existing
installations. This preserves the item rows while allowing the UI to render its
normal no-image state and makes the catalog self-consistent for new exports.

If reviewed replacements are added, update the seed catalog and migration workflow
together. The current asset decision does not grant permission to use third-party
franchise names, characters, logos or lore.

## Verification and publication

```sh
npm run assets:verify
```

The command checks all tracked asset fingerprints and detects inventory drift or
changes to the known missing-reference list. Passing means byte integrity and
matches the recorded review; it does not decide trademark, character or lore
rights.

The release gate is intentionally stricter:

```sh
npm run assets:verify:release
```

It fails until every manifest entry is marked `approved` or intentionally
`omitted`, every approved entry has a license value, and every catalog image
reference resolves. Omitted entries are excluded by the public-tree exporter.
The script enforces the recorded asset review and byte integrity; publication still
requires the separate trademark, character and lore decisions.

Keep repository history private until credential/history review is complete.
Do not publish the current repository or a full archive just because its source
license or automated tests pass. Record the exact released asset hashes and notices
after deciding the public repository/artifact scope.
