# Release Checklist

Tenkit publishes three npm packages:

- `@tenkit/template-generator`
- `@tenkit/cli`
- `create-tenkit`

The release workflow is `.github/workflows/publish.yml`. Configure npm Trusted Publishing for each package with:

```text
Organization/user: brilliantinsane
Repository: tenkit
Workflow filename: publish.yml
Allowed actions: npm publish
```

Use the `next` dist-tag for the first public release.

## Local Checks

```bash
pnpm release:check
```

This runs source checks, generated-output proof, tarball smoke, and package dry runs. The tarball smoke intentionally uses a real temporary `pnpm install`, not an offline install, so it catches package resolution issues before publishing.

The local tarball smoke installs the packed packages into a temporary runner and invokes `create-tenkit` with `pnpm exec`. It cannot invoke `pnpm create tenkit@next` before `create-tenkit` exists on npm; the GitHub Action verifies the real package-manager create command after publishing to the `next` dist-tag.

## Publish Flow

1. Confirm `pnpm release:check` passes on `main`.
2. Create and push a release tag, such as `v0.1.0`.
3. Let the `Publish` GitHub Action create tarball artifacts, publish packages with provenance, smoke test `pnpm create tenkit@next`, and create the GitHub Release.
4. Smoke test the real npm package locally as a final operator check:

   ```bash
   pnpm create tenkit@next --name smoke --setup runtime-tenants --yes --no-install --no-git
   ```

5. Promote to `latest` only after the `next` package-runner path works.
