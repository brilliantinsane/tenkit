# @tenkit/web

The Tenkit marketing website.

This app is a Next.js package inside the Tenkit monorepo. It presents the public
Tenkit product story, links to the GitHub repository and npm package, and keeps
the web surface separate from the Expo Playground.

## Highlights

- Built with Next.js App Router, React 19, Tailwind CSS, and shadcn-style local
  UI components.
- Uses the same Tenkit domain language as the rest of the repo: Setup Type, App
  Variant, Runtime Tenant, Template, Playground, and Build Preparation.
- Lives under `apps/web` and is addressed as the `@tenkit/web` workspace
  package.
- Root workspace scripts are available for the common web checks and build.

## Local Development

From the workspace root:

```bash
pnpm install
pnpm web:dev
```

The package can also be run directly:

```bash
pnpm -F @tenkit/web dev
```

## Commands

Run these from the workspace root:

```bash
pnpm web:dev
pnpm web:build
pnpm web:typecheck
pnpm web:lint
```

Package-scoped equivalents:

```bash
pnpm -F @tenkit/web dev
pnpm -F @tenkit/web build
pnpm -F @tenkit/web typecheck
pnpm -F @tenkit/web lint
pnpm -F @tenkit/web format
```

`typecheck` runs `next typegen` before `tsc --noEmit` so a clean checkout has
the generated Next route and layout declarations it needs.

## Configurator Architecture

- `/configure` owns the interactive project configurator. The root layout and
  homepage do not mount a global configurator modal or duplicate its state.
- `nuqs` query parameters are the configurator's shareable source of truth.
  Parsers, URL keys, and reset behavior live in
  `lib/configurator-search-params.ts`; command and validation derivation live in
  `lib/configurator.ts`.
- `ConfiguratorProvider` is the only component that adapts `nuqs` into the
  configurator's `state`, `actions`, and `meta` context contract. Compound page
  sections consume that contract without importing query-state implementation
  details.
- Configurator UI derives validation, previews, and commands during render. Do
  not mirror query state into effects or a second client store.
- Homepage and header entry points link to `/configure`. Configurator-only
  interactive variants and dependencies stay outside the homepage command
  component boundary.

## Project Structure

```text
apps/web/
├── app/                  # App Router routes and global styles
├── components/           # Page, layout, and UI components
├── constants/            # Landing page copy, navigation, and external URLs
├── hooks/                # Client hooks used by the website
├── lib/                  # Shared web utilities
└── public/               # Static website assets
```

## UI Components

Components are checked into this package instead of imported from a shared
design-system package. To add a shadcn component, use pnpm through the workspace:

```bash
pnpm -F @tenkit/web exec shadcn add button
```

Generated UI files should stay close to the web app unless a broader Tenkit
boundary explicitly adopts them.

## Relationship To The Playground

`apps/web` is the website. `apps/playground` is the runnable Expo Playground that
proves Tenkit setup behavior in a real app.

Do not use the website as generated Template output, and do not use it to prove
Expo runtime behavior. Template and Playground verification remain owned by the
existing Tenkit package and app boundaries.
