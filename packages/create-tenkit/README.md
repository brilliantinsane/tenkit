# tenkit

![Tenkit banner](https://raw.githubusercontent.com/brilliantinsane/tenkit/main/apps/playground/assets/hero.png)

<p align="center">
  <a href="https://github.com/brilliantinsane/tenkit"><img alt="badge" src="https://shieldcn.dev/github/brilliantinsane/tenkit/stars.svg?variant=branded&amp;font=geist-mono&amp;logo=github" /></a>
  <a href="https://x.com/brill_insane"><img alt="follow" src="https://shieldcn.dev/x/follow/brill_insane.svg?variant=branded&amp;font=geist" /></a>
</p>

Build and ship multiple Expo apps from one codebase.

```bash
pnpm create tenkit@latest
```

Tenkit creates Expo and React Native projects for products that need multiple
native app identities: different names, icons, colors, bundle IDs, Android
package names, URL schemes, EAS projects, and runtime business contexts.

Instead of copying an Expo app for every brand, venue, customer, or business
unit, Tenkit keeps the shared product model explicit and generates a project
around the Setup Type you choose.

## Highlights

- Create a generated Expo project with a familiar package-manager create
  command.
- Choose between White Label Apps, Runtime Tenant App, and Generic + Standalone
  Apps.
- Keep App Variant identity typed and reviewable: name, slug, scheme, bundle ID,
  Android package, native assets, theme, and EAS project.
- Keep Runtime Tenant behavior separate from build-time App Variant identity.
- Use generated local commands for Build Preparation, reset, and diagnostics.
- Verify Template output through generated app tests, TypeScript, and Expo
  config checks.

## Create A Project

```bash
pnpm create tenkit@latest
```

The create flow asks for a project name and Setup Type, then creates a child
folder, installs dependencies with pnpm, initializes git when safe, and prints
next steps.

Non-interactive examples:

```bash
pnpm create tenkit@latest --name studio-app --setup white-label --yes
pnpm create tenkit@latest --name venue-network --setup runtime-tenants --yes
pnpm create tenkit@latest --name franchise-app --setup generic-standalone --yes
```

Skip install and git when you only want to inspect generated output:

```bash
pnpm create tenkit@latest --name demo --setup runtime-tenants --yes --no-install --no-git
```

## Setup Types

| Setup Type                | Public slug          | Use when                                                                                                                 |
| ------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| White Label Apps          | `white-label`        | Every brand, customer, or venue ships as its own native app.                                                             |
| Runtime Tenant App        | `runtime-tenants`    | One native app opens multiple Runtime Tenants.                                                                           |
| Generic + Standalone Apps | `generic-standalone` | One Generic App Variant opens selected Runtime Tenants, while some Runtime Tenants also ship as Standalone App Variants. |

## Core Concepts

| Concept           | Meaning                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| App Variant       | A build-time native app identity: app name, slug, scheme, bundle ID, package name, assets, theme, and EAS project. |
| Runtime Tenant    | A business, organization, customer, venue, or context opened at runtime.                                           |
| Setup Type        | The relationship model between App Variants and Runtime Tenants.                                                   |
| Template          | Standalone project-generation source for a selected Setup Type.                                                    |
| Public CLI        | The create command surface that generates Tenkit projects from Template source.                                    |
| Build Preparation | App Variant-specific native preparation for generated projects.                                                    |

Build Preparation selects an App Variant. Runtime Tenant selection, when a setup
uses Runtime Tenants, remains runtime behavior inside the app.

## Package Boundary

`create-tenkit` is the thin package-manager create entrypoint. It delegates to
`@tenkit/cli`, which owns prompts, create-flow orchestration, Template
generation, dependency installation, git policy, and output formatting.
