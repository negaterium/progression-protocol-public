# Public release checklist

This checklist separates repository preparation from owner decisions that cannot
be automated safely.

## Source and history

- [x] Select the reviewed clean no-history public snapshot; keep the inherited
      preparation history private rather than publishing it.
- [ ] Rotate every real credential that appeared in reachable history.
- [x] Run Gitleaks against the exact release archive and its extracted contents;
      the full private-history scan is complete; scan the final public refs after
      the clean repository is initialized.
- [x] Exclude private task logs, agent workflows, debug scripts and personal data
      from the generated public tree.

## Licensing and content

- [x] Confirm the copyright holder in `LICENSE` (`Negaterium`).
- [x] Record provenance, permission and attribution for every retained asset.
- [x] Remove or replace uncleared artwork, screenshots, fonts and binaries from
      the generated public tree; the reviewed export omits the 29 private assets.
- [x] Resolve the missing catalog image references.
- [x] Pass `npm run assets:verify:release` on the current reviewed tree.
- [ ] Verify the exact SDXL 1.0 base/refiner/checkpoint or adapter terms before
      the first public release.
- [x] Record the unofficial, non-commercial fan-project posture and disclaimer.
- [ ] Complete the rights and trademark review for project names, lore and
      fictional catalog content; the current posture is fan-made and does not
      claim affiliation or permission.
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
      on the target host.

## Community and release operations

- [x] Keep the public README, contributing and security docs publication-ready
      while retaining the release gates and security requirements.
- [ ] After changing repository visibility, enable private vulnerability reporting
      and publish a monitored response route.
- [ ] After changing repository visibility, configure branch protection on `master`;
      `CODEOWNERS` and Dependabot monitoring are already present.
- [x] Pass `npm run package:check:public` on the generated public source tree.
- [x] Run `npm run public:export` after the asset gate passes and scan the
      generated tree; initialize it as the public repository without history only
      after the owner approves the final branding and history decisions.
- [ ] Create the first immutable release tag, changelog and reproducible artifact
      checksums; the tag workflow must pass the release asset gate.
- [ ] Smoke-test the exact release artifact, then publish the public repository.

## Latest verification record

- Generated public candidate: 465 files; 161 approved assets included, with 29
  private preparation assets omitted from the source tree.
- Gitleaks `v8.30.1` scanned the exact ZIP and extracted contents with zero findings.
  Publish the final archive checksum with the immutable release artifact after the
  clean public repository is initialized.
- The full private-history Gitleaks scan covered 159 reachable commits and found
  seven redacted matches: five generated `.next_old` build-artifact matches and
  two copies of one legacy Supabase `service_role` JWT in old debug utilities.
  Treat that credential as exposed and rotate/revoke it before publication; no
  such code or key is present in the reviewed public tree.
- GitHub Actions run `38238714336` passed the `quality`, `database` and `boundaries`
  jobs. The final public-ref scan remains pending until the clean repository exists.
