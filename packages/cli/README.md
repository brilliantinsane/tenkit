# @tenkit/cli

Public Tenkit CLI implementation package.

Most users should run Tenkit through the package-manager create entrypoint:

```bash
# Using pnpm
pnpm create tenkit@latest

# Using npm
npm create tenkit@latest

# Using npx
npx create-tenkit@latest

# Using Bun
bun create tenkit@latest

# Using bunx
bunx create-tenkit@latest
```

This package owns the real Public CLI implementation behind `create-tenkit`:
parsing, prompts, create-flow orchestration, Template generation, dependency
installation, git convenience policy, and final output.

Tenkit creates Expo and React Native projects for white-label apps,
multi-tenant products, App Variant builds, and Runtime Tenant experiences.

## Direct CLI

The package exposes a `tenkit` binary for direct usage:

```bash
tenkit --help
```

For public project creation, prefer a package-manager create command so the
package manager resolves the create entrypoint correctly. The create flow uses
the launching package manager for generated project installation and next steps,
or accepts `--package-manager pnpm`, `--package-manager npm`, or
`--package-manager bun` as an explicit override.
