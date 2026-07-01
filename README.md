# tenkit

![Tenkit banner](apps/playground/assets/hero.png)

<p align="center">
  <a href="https://www.npmjs.com/package/create-tenkit"><img alt="version" src="https://shieldcn.dev/npm/create-tenkit.svg?variant=branded" /></a>
  <a href="https://github.com/brilliantinsane/tenkit"><img alt="badge" src="https://shieldcn.dev/github/brilliantinsane/tenkit/stars.svg?variant=branded&amp;font=geist-mono&amp;logo=github" /></a>
  <a href="https://x.com/brill_insane"><img alt="follow" src="https://shieldcn.dev/x/follow/brill_insane.svg?variant=branded&amp;font=geist" /></a>
</p>

Build and ship multiple Expo apps from one codebase.

```bash
pnpm create tenkit@latest
```

Tenkit creates Expo projects for products that need multiple native app identities: different names, icons, colors, bundle IDs, Android package names, URL schemes, EAS projects, and runtime business contexts.

Instead of copying an Expo app for every brand, venue, customer, or business unit, Tenkit keeps the shared product model explicit and generates a project around the Setup Type you choose.

## Highlights

- Create a generated Expo project with a familiar package-manager create command.
- Choose between White Label Apps, Runtime Tenant App, and Generic + Standalone Apps.
- Keep App Variant identity typed and reviewable: name, slug, scheme, bundle ID, Android package, native assets, theme, and EAS project.
- Keep Runtime Tenant behavior separate from build-time App Variant identity.
- Use generated local commands for Build Preparation, reset, and diagnostics.
- Verify Template output through generated app tests, TypeScript, and Expo config checks.

## Create A Project

```bash
pnpm create tenkit@latest
```

The create flow asks for:

- project name
- Setup Type

It then creates a child folder, installs dependencies with pnpm, initializes git when safe, and prints next steps.

Non-interactive examples:

```bash
pnpm create tenkit@latest --name studio-app --setup white-label --yes
pnpm create tenkit@latest --name venue-network --setup runtime-tenants --yes
pnpm create tenkit@latest --name franchise-app --setup generic-standalone --yes
```

Skip convenience steps when needed:

```bash
pnpm create tenkit@latest --name demo --setup runtime-tenants --yes --no-install --no-git
```

## Setup Types

| Setup Type                    | Use When                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **White Label Apps**          | Every brand, customer, or venue ships as its own native app.                                                             |
| **Runtime Tenant App**        | One native app opens multiple Runtime Tenants.                                                                           |
| **Generic + Standalone Apps** | One Generic App Variant opens selected Runtime Tenants, while some Runtime Tenants also ship as Standalone App Variants. |

Public create slugs:

```text
white-label
runtime-tenants
generic-standalone
```

## Core Concepts

| Concept            | Meaning                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **App Variant**    | A build-time native app identity: app name, slug, scheme, bundle ID, package name, assets, theme, and EAS project. |
| **Runtime Tenant** | A business, organization, customer, venue, or context opened at runtime.                                           |
| **Setup Type**     | The relationship model between App Variants and Runtime Tenants.                                                   |
| **Template**       | Standalone project-generation source for a selected Setup Type.                                                    |
| **Public CLI**     | The create command surface that generates Tenkit projects from Template source.                                    |
| **Playground**     | The Expo app inside this repo that proves setup behavior in a real runnable app.                                   |

Build Preparation selects an App Variant. Runtime Tenant selection, when a setup uses Runtime Tenants, remains runtime behavior inside the app.

## Local Development

Clone the repo:

```bash
git clone <repository-url>
cd tenkit
```

Use the project Node version and install dependencies:

```bash
nvm install
nvm use
corepack enable pnpm
pnpm install
```

Start the Playground:

```bash
pnpm start
```

The root start command runs `apps/playground`. You can also run commands directly from that package:

```bash
cd apps/playground
pnpm start
```

## Playground Workflows

Choose a local App Variant with `apps/playground/.env.local`:

```bash
cp apps/playground/.env.example apps/playground/.env.local
```

```bash
APP_VARIANT_SLUG=first-tenant
```

If `APP_VARIANT_SLUG` is omitted, the Playground uses the default App Variant from `apps/playground/src/active-setup/manifest.ts`.

Run the selected variant:

```bash
pnpm ios
pnpm android
pnpm web
```

Prepare native projects after changing App Variant identity, native assets, plugin config, or App Variant Environment:

```bash
pnpm tenkit build
```

Reset generated native projects:

```bash
pnpm tenkit reset
```

Check setup health:

```bash
pnpm tenkit doctor
```

`pnpm tenkit` is Playground-local tooling for Scaffold, Build Preparation, reset, and diagnostics. Public project creation lives in `create-tenkit` and delegates to `@tenkit/cli`.

## Template Verification

Generate Template output into a separate folder:

```bash
pnpm proof -- --setup-type white-label --target ../tenkit-white-label-proof
pnpm proof -- --setup-type runtime-tenants --target ../tenkit-runtime-tenants-proof
pnpm proof -- --setup-type generic-standalone --target ../tenkit-generic-standalone-proof
```

Run generated app shape proof tests:

```bash
pnpm test:proof
```

Run full generated app command verification:

```bash
pnpm verify -- --setup-type white-label
pnpm verify -- --setup-type runtime-tenants
pnpm verify -- --setup-type generic-standalone
```

## EAS Setup

Each App Variant maps to exactly one EAS Project.

For each App Variant:

1. Log in with EAS CLI.
2. Create or find one EAS Project in your Expo account or organization.
3. Copy that EAS Project ID into the App Variant's `eas.projectId`.
4. Replace `EXPO_OWNER` with your Expo account or organization owner.

```bash
eas login
```

Use `eas init` only to create or discover an App Variant's EAS Project ID. EAS Project IDs are public identifiers and belong in setup data, not EAS environment variables.

## Project Structure

```text
.
├── apps/
│   └── playground/                       # Runnable Expo Playground app
├── packages/
│   ├── cli/                              # Public CLI implementation package
│   ├── create-tenkit/                    # Thin package-manager create entrypoint
│   └── template-generator/               # Template source, generation, and writer package
├── package.json                          # Workspace command surface
└── pnpm-workspace.yaml                   # pnpm workspace configuration
```

## Checks

```bash
pnpm test
pnpm check
pnpm typecheck
pnpm lint
```

Public CLI checks:

```bash
pnpm build
pnpm smoke
pnpm pack:dry-run
```

Template-generator checks:

```bash
pnpm -F @tenkit/template-generator test
pnpm test:proof
pnpm verify -- --setup-type white-label
```

## Feedback And Contributing

Open an issue for bugs, missing Setup Type behavior, generated output problems, or CLI create-flow rough edges. Keep domain language precise: App Variant, Runtime Tenant, Setup Type, Template, Public CLI, Playground, Scaffold, and Build Preparation each mean different things in Tenkit.

## Expo SDK

This repo targets Expo SDK 56.

Read the exact versioned Expo docs before changing Expo code:

https://docs.expo.dev/versions/v56.0.0/

## License

MIT

<p align="center">
  <img alt="chart" src="https://shieldcn.dev/chart/github/stars/brilliantinsane/tenkit.svg?theme=zinc" />
</p>
