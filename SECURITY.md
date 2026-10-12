# Security policy

Security validation applies to the supported application and deployment paths.
Operators must retain private backups, use supported runtimes and review the
release checklist before distributing a public build. The current support
baseline is Node.js 22.20 or newer within the documented major version and
PostgreSQL 17 or newer.

This is an unofficial, non-commercial fan project. Do not include third-party
franchise material, personal data or deployment credentials in a vulnerability
report. See the [fan-project notice](docs/FAN_PROJECT_NOTICE.md) for licensing
boundaries.

## Reporting a vulnerability

Do not post exploit details, credentials or player data in a public issue or PR.
Use the repository's Security > Advisories > Report a vulnerability form after
the maintainer enables private vulnerability reporting. If that form is not
available, open a minimal issue asking for a private contact channel without
including sensitive details. The maintainer must enable and monitor a private
reporting route before changing repository visibility.
[GitHub's configuration guidance](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository)
explains the repository setting.

Privately provide the affected commit/version, reproduction using synthetic data,
impact and any proposed fix. Redact hostnames, credentials, sessions and personal
information. Test only systems you control; do not probe other users' deployments.

## Operational boundaries

Keep PostgreSQL on a trusted private network or secured tunnel, use HTTPS with
secure cookies, and restrict developer access by server-configured UUID. The app
does not implement remote database TLS options, public self-registration or
multi-instance rate-limit coordination. See [deployment guidance](DEPLOYMENT.md)
and the [release checklist](docs/RELEASE_CHECKLIST.md) for limits and release
requirements.

Source snapshots and Git branches do not remove historical secrets. Rotate affected
credentials and review the exact public artifact and history before publication.
