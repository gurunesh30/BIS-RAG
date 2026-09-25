# Security policy

## Supported versions

Security fixes are applied to the `main` branch. Older snapshots and forks are not maintained separately.

## Reporting a vulnerability

Do not open a public issue for an exploitable vulnerability, exposed credential, or private standards document.

Use GitHub's **Report a vulnerability** option on the repository's Security tab when private reporting is available. If that option is disabled, contact a maintainer through a private channel listed on their GitHub profile before sharing technical details.

Include:

- affected files, component, or endpoint
- reproduction steps or a proof of concept
- expected and observed impact
- any suggested mitigation
- whether public disclosure or credential rotation is already needed

Keep credentials, real user data, and copyrighted standards files out of the report. If a secret was exposed, revoke or rotate it before continuing the investigation.

## Response

Maintainers will acknowledge a complete report when they can review it, assess the impact, and coordinate a fix and disclosure timeline with the reporter. Public disclosure should wait until users have a reasonable path to update.

## Scope

The application, API, UI, deployment definitions, and test code are in scope. Vulnerabilities in third-party services require a report to that service unless this project exposes or misconfigures them.
