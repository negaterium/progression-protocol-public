# Public release checklist

This checklist records the state of the clean public source snapshot. It is
deliberately separate from the private preparation repository and does not
publish inherited private Git history.

## Source and history

- [x] Select the reviewed clean no-history public snapshot; keep the inherited
      preparation history private rather than publishing it.
- [x] Keep private preparation history, production data, real environment files
      and provider credentials out of the public snapshot.
- [x] Run the dedicated secret scan against the exact public release archive and
      its extracted contents.
- [x] Exclude private task logs, agent workflows, debug scripts and personal data
      from the generated public tree.

## Licensing and content

- [x] Confirm the copyright holder in `LICENSE` (`Negaterium`).
- [x] Record provenance, permission and attribution for every retained asset.
- [x] Remove or replace uncleared artwork, screenshots, fonts and binaries from
      the generated public tree; private preparation assets remain omitted.
- [x] Resolve the catalog image references retained by the public tree.
- [x] Pass `npm run assets:verify:release` on the reviewed tree.
- [x] Record that retained images were generated locally with SDXL 1.0 from
      text-only prompts and that no weights, checkpoints or adapters are
      distributed by this repository. Model-use terms remain separate from the
      project code and asset notices.
- [x] Record the unofficial, non-commercial fan-project posture and the fact
      that the repository does not claim affiliation, permission or ownership
      of third-party names, lore, characters or trademarks.
- [x] Record direct dependency licenses in `THIRD_PARTY_NOTICES.md`.
- [x] Refresh the dependency inventory and publish notices for retained assets.

## Database and deployment

- [x] Provide a checksum-checked, explicit PostgreSQL upgrade runner.
- [x] Add numbered catalog migrations for reviewed existing installs.
- [x] Test the numbered migration on a disposable PostgreSQL upgrade rehearsal.
- [ ] Add and test a numbered migration for each future schema/catalog change.
- [x] Review the schema/catalog export for private text, URLs and asset paths.
- [x] Rehearse initialization, upgrade, backup and restore on disposable systems.
- [ ] Verify HTTPS, reverse-proxy headers, firewall rules and service management
      on each target host. These are deployment-specific operator checks.

## Community and release operations

- [x] Keep the public README, contributing and security docs publication-ready.
- [x] Enable GitHub private vulnerability reporting and publish the monitored
      security-reporting route in `SECURITY.md`.
- [x] Enable the active `master` ruleset for deletion protection,
      non-fast-forward protection and required linear history. The repository
      owner may add required checks or review rules later; the current ruleset
      is intentionally recorded as configured.
- [x] Pass `npm run package:check:public` on the generated public source tree.
- [x] Run `npm run public:export` after the asset gate passes and scan the
      generated tree before synchronizing the public repository.
- [x] Create the first immutable release tag, changelog and reproducible source
      artifact checksum; the tag workflow passed the release asset gate.
- [x] Smoke-test the exact release source snapshot before publication.

## Latest verification record

The release commit, public repository commit, archive checksum and passing CI
run are recorded in the public release notes. Private preparation history is
not part of the public repository and is intentionally not reproduced here.

## Ongoing operator checks

- Repeat restoration and gameplay checks for every future schema or catalog
  migration. The current baseline passed disposable PostgreSQL integration and
  production-browser checks; future upgrades still need their own rehearsal.
- Verify HTTPS, reverse-proxy headers, firewall rules and service management on
  each deployment host. These are deployment-specific and are not asserted by
  the source package.
- Keep the fan-project notice, asset provenance and separate dependency notices
  with every redistribution.
