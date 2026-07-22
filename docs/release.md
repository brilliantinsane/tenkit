# Tenkit Release Architecture

> Status: design approved, implementation incomplete. Do not use this procedure for a real release until the staged-publishing tickets and rehearsal are complete.

Tenkit publishes one Release Set containing:

- `@tenkit/template-generator`
- `@tenkit/cli`
- `create-tenkit`

All three packages use one shared version and one locally reviewed source SHA. The source SHA plus version is the complete Release Set identity.

## Security Boundary

Assume GitHub Actions, its caches, workflow token, OIDC staging authority, and outputs may be compromised. Trust the locally reviewed source commit, the maintainer's npm account and authenticator, and npm's staging and registry services.

GitHub Actions may privately stage packages but cannot publish them directly. A maintainer independently reproduces the staged bytes in the same digest-pinned container, compares them with npm, and approves each package with npm 2FA.

## Stable Release Flow

```text
Draft -> Validate -> Human approval -> Candidate smoke -> Promote -> Finalize
```

1. **Draft**: manually start one GitHub workflow from the default branch with no custom inputs. GitHub snapshots that commit automatically; the workflow computes the shared version, runs source checks, packs in the canonical container, privately stages all three packages under `candidate`, and creates a draft GitHub Release.
2. **Validate**: locally run the copyable `release:verify` command with the reviewed source SHA and version. It queries npm directly and requires all three reproduced artifacts to match.
3. **Human approval**: approve Template generator, Public CLI, then create entrypoint through npm with 2FA.
4. **Candidate smoke**: locally run one exact-version registry smoke. It verifies tags, internal dependencies, npm, pnpm, Bun, and one representative generated project.
5. **Promote**: preview and explicitly apply the authenticated move of all three `latest` tags in dependency order.
6. **Finalize**: open the reviewed draft GitHub Release, confirm its version and source SHA, and click **Publish release**. This creates the stable Git tag.

Draft derives the version only from Git history and uses no npm credential while planning. If npm reports that the version is already staged or public, Draft stops. A private collision must be inspected and rejected with maintainer authentication before retrying the same Git-derived version. Recovery after part of a Release Set is already public is a separate fix-forward procedure and is not silently handled by Draft.

There is no mandatory waiting period before Promotion. A maintainer may optionally leave the verified Candidate Release Set under `candidate` until it passes a desired package-age threshold.

## Operator Manual

The intentionally detailed, click-by-click procedure lives in:

- `.scratch/staged-publishing/course/reference/operator-runbook.md`
- `.scratch/staged-publishing/course/reference/operator-runbook.html`

Those local teaching files are downstream projections of ADR 0011. They must match implemented workflow labels and commands before the design warning is removed.
