# create-tenkit

Create a Tenkit Expo project with your package manager.

![Tenkit banner](https://raw.githubusercontent.com/brilliantinsane/tenkit/main/apps/playground/assets/hero.png)

<p align="center">
  <a href="https://www.npmjs.com/package/create-tenkit"><img alt="version" src="https://shieldcn.dev/npm/create-tenkit.svg?variant=branded" /></a>
  <a href="https://github.com/brilliantinsane/tenkit"><img alt="badge" src="https://shieldcn.dev/github/brilliantinsane/tenkit/stars.svg?variant=branded&amp;font=geist-mono&amp;logo=github" /></a>
  <a href="https://x.com/brill_insane"><img alt="follow" src="https://shieldcn.dev/x/follow/brill_insane.svg?variant=branded&amp;font=geist" /></a>
</p>

```bash
pnpm create tenkit@latest
```

Tenkit creates Expo projects for products that need multiple native app
identities, runtime business contexts, or both.

## Highlights

- Generate a ready-to-run Expo project in a child folder.
- Choose between White Label Apps, Runtime Tenant App, and Generic + Standalone
  Apps.
- Keep App Variant identity separate from Runtime Tenant behavior.
- Use generated local commands for Build Preparation, reset, and diagnostics.
- Use the package manager that launched the create command for install and next
  steps.

## Create A Project

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

The interactive flow asks for:

- project name
- Setup Type

Press Return at the project-name prompt to accept `tenkit-app`.

## Non-Interactive Usage

```bash
pnpm create tenkit@latest --name studio-app --setup white-label --yes
pnpm create tenkit@latest --name venue-network --setup runtime-tenants --yes
pnpm create tenkit@latest --name franchise-app --setup generic-standalone --yes
```

Skip install and git when you only want to inspect generated output:

```bash
pnpm create tenkit@latest --name demo --setup runtime-tenants --yes --no-install --no-git
```

Override package-manager detection:

```bash
pnpm create tenkit@latest --package-manager pnpm
pnpm create tenkit@latest --package-manager npm
pnpm create tenkit@latest --package-manager bun
```

## Setup Types

| Setup Type                | Public slug          | Use when                                                                                                                 |
| ------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| White Label Apps          | `white-label`        | Every brand, customer, or venue ships as its own native app.                                                             |
| Runtime Tenant App        | `runtime-tenants`    | One native app opens multiple Runtime Tenants.                                                                           |
| Generic + Standalone Apps | `generic-standalone` | One Generic App Variant opens selected Runtime Tenants, while some Runtime Tenants also ship as Standalone App Variants. |

## Package Boundary

`create-tenkit` is the thin package-manager create entrypoint. The create flow
itself lives in `@tenkit/cli`, and Template generation lives in
`@tenkit/template-generator`.
