# @tenkit/template-generator

Template source, generation, and writer package for Tenkit generated Expo
projects.

This package renders selected Setup Type Templates into a sorted virtual file
tree, then writes that generated project safely to disk.

## Highlights

- Generate Tenkit Expo project source for supported Setup Types.
- Keep Template source under `packages/template-generator/templates`.
- Render text files with Handlebars while copying static and binary assets
  directly.
- Keep generation pure by returning a `VirtualFileTree`.
- Keep filesystem persistence in the writer boundary with path validation,
  duplicate-output detection, overwrite policy, and target-folder safety.
- Support package-manager-specific generated commands and files from the Public
  CLI create flow.

## Usage

Most users should create projects through the public create command:

```bash
pnpm create tenkit@latest
```

Maintainer workflows can call this package through workspace scripts:

```bash
pnpm proof -- --setup-type white-label --target ../tenkit-white-label-proof
pnpm proof -- --setup-type runtime-tenants --target ../tenkit-runtime-tenants-proof
pnpm proof -- --setup-type generic-standalone --target ../tenkit-generic-standalone-proof
```

Run generated-output proof tests:

```bash
pnpm test:proof
```

Run generated app command verification:

```bash
pnpm verify -- --setup-type white-label
pnpm verify -- --setup-type runtime-tenants
pnpm verify -- --setup-type generic-standalone
```

## Supported Setup Types

```text
white-label
runtime-tenants
generic-standalone
```

Canonical Setup Type IDs are also accepted at the generator boundary for
maintainer workflows.

## Package Boundary

`@tenkit/template-generator` owns Template source, pure generation, and writer
safety. The Public CLI owns prompts, option parsing, create-flow orchestration,
install policy, git policy, and user-facing output.
