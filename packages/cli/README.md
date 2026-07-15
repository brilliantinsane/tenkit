# @tenkit/cli

Public CLI implementation for creating Tenkit Expo projects.

Most users should run Tenkit through the create entrypoint:

```bash
pnpm create tenkit@latest
```

`@tenkit/cli` owns the real create flow behind `create-tenkit`: option parsing,
prompts, Template generation, dependency installation, initial git setup, and
final next steps.

## Highlights

- Create a generated Expo project from a selected Tenkit Setup Type.
- Prompt for project name, Setup Type, App Variant customization, and Styling Choice.
- Support `pnpm`, `npm`, `npx`, Bun, and `bunx` launchers.
- Use the selected package manager for install commands, generated README
  commands, and generated app-local commands.
- Treat install and git failures as follow-up work so successful generation is
  not hidden by convenience-step failures.

## Usage

```bash
# Package-manager create entrypoints
pnpm create tenkit@latest
npm create tenkit@latest
npx create-tenkit@latest
bun create tenkit@latest
bunx create-tenkit@latest
```

Direct binary usage is also available:

```bash
tenkit --help
```

## Common Options

```bash
tenkit --name studio-app --setup white-label --yes
tenkit --name venue-network --setup runtime-tenants --yes
tenkit --name franchise-app --setup generic-standalone --yes
tenkit --name unistyles-app --setup white-label --styling unistyles --yes
```

```bash
tenkit --name demo --setup runtime-tenants --yes --no-install --no-git
```

Supported public Setup Type slugs:

```text
white-label
runtime-tenants
generic-standalone
```

Supported Styling Option Values:

```text
bare
uniwind
unistyles
```

Bare remains the default when Styling is omitted or `--yes` accepts defaults.

Override package-manager detection when needed:

```bash
tenkit --package-manager pnpm
tenkit --package-manager npm
tenkit --package-manager bun
```

## Package Boundary

`@tenkit/cli` is the Public CLI implementation package. The `create-tenkit`
package is a thin create entrypoint that delegates here. Template source,
generation, and writer safety live in `@tenkit/template-generator`.
