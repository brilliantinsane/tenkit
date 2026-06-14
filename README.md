![Expo Tenant Kit banner](docs/readme-banner.svg)

Expo Tenant Kit lets you maintain one Expo codebase and ship it as separate branded mobile apps for different customers, brands, or markets.

It uses a build-time `TENANT_SLUG` to apply each tenant's native app identity, metadata, icons, splash assets, theme values, runtime config, and EAS project mapping.

## Why This Exists

Many mobile products start as one app, then need a second app with a different name, icon, bundle identifier, package name, theme, and EAS project. Copying the whole repository works once, but it creates drift immediately.

This kit keeps the shared application code in one place and moves brand-specific native identity into typed Tenant config. Pick a Tenant, prepare the native project, and build the branded app that belongs to that Tenant.

## What You Get

- **One shared Expo app** using Expo Router, React Native, TypeScript, and Bun.
- **Typed Tenant config** for app name, slug, version, scheme, iOS bundle identifier, Android package name, accent color, and EAS metadata.
- **Tenant-specific native assets** for icons, Android adaptive icons, splash imagery, and iOS app icon catalogs.
- **Dynamic Expo config** that applies the selected Tenant at build time from `TENANT_SLUG`.
- **Runtime Tenant metadata** exposed through Expo config and consumed with `useTenantConfig()`.
- **Build Preparation CLI** that pulls the selected Tenant's EAS environment values into `.env.local`, validates the Tenant Slug, and runs clean Expo prebuild.
- **Tests around the Tenant workflow** so config resolution, CLI planning, runtime config, and EAS JSON behavior stay intentional.

## What This Is Not

Expo Tenant Kit is not a backend multi-tenancy system, an in-app tenant switcher, or a finished white-label product. It is a project foundation for build-time tenantized Expo apps where each Tenant becomes its own native application.

The demo Tenants are placeholders. Downstream apps should replace names, package IDs, assets, EAS project IDs, and product UI with real Tenant data.

## How It Works

| Area                  | File                               | Purpose                                                                        |
| --------------------- | ---------------------------------- | ------------------------------------------------------------------------------ |
| Tenant list and types | `src/types/tenant-config.types.ts` | Defines accepted Tenant Slugs and the shape of each Tenant config.             |
| Tenant config         | `tenant-configs.ts`                | Stores each Tenant's native identity, theme, assets, and EAS project metadata. |
| Expo app config       | `app.config.ts`                    | Resolves the active Tenant and injects its identity into Expo's native config. |
| Project owner         | `project-config.ts`                | Holds the Expo account or organization owner for downstream projects.          |
| Build CLI             | `scripts/tenant-cli.ts`            | Provides `build-prepare`, `build-reset`, and `doctor` commands.                |
| Build planning        | `scripts/tenant-cli-core.ts`       | Validates Tenant, environment, platform, EAS project ID, and CI requirements.  |
| Build execution       | `scripts/tenant-cli-runtime.ts`    | Pulls EAS env vars, validates `.env.local`, and runs Expo prebuild.            |
| Runtime Tenant hook   | `src/hooks/use-tenant-config.ts`   | Reads the resolved Tenant metadata from Expo runtime config.                   |
| Tenant assets         | `assets/<tenant-slug>/`            | Holds required native icon and splash assets per Tenant.                       |

## Current Demo Tenants

| Tenant Slug     | App Name       | Tenant ID | Accent    | Native IDs                         |
| --------------- | -------------- | --------: | --------- | ---------------------------------- |
| `first-tenant`  | `FirstTenant`  |       `1` | `#208AEF` | `com.brilliantinsane.firsttenant`  |
| `second-tenant` | `SecondTenant` |       `2` | `#ca0b09` | `com.brilliantinsane.secondtenant` |

If `TENANT_SLUG` is omitted, the first configured Tenant is used.

## Quick Start

### 1. Clone the repository

```bash
git clone <repository-url>
cd expo-tenant-kit
```

### 2. Use the project Node version

Install `nvm` from the [official nvm instructions](https://github.com/nvm-sh/nvm), then run:

```bash
nvm install
nvm use
```

### 3. Install Bun

Use Bun for package scripts and dependency management in this repo. Do not use npm for local setup, scripts, or dependency changes.

```bash
bun --version
```

If Bun is missing, install it from the [official Bun installation guide](https://bun.sh/docs/installation).

### 4. Install dependencies

```bash
bun install
```

### 5. Configure the local Tenant

Create `.env.local` from the example file:

```bash
cp .env.example .env.local
```

Set `TENANT_SLUG` to one of the accepted Tenant Slugs:

```bash
TENANT_SLUG=first-tenant
```

You can also use:

```bash
TENANT_SLUG=second-tenant
```

### 6. Start the app

```bash
bun run start
```

Expo CLI will show options for opening the app in a development build, Android emulator, iOS simulator, web browser, or Expo Go.

## Common Workflows

### Run the selected Tenant locally

```bash
bun run ios
bun run android
bun run web
```

These commands use the Tenant already present in `.env.local`. They do not pull EAS env vars or regenerate native projects.

### Prepare native projects for a Tenant

Run Build Preparation after changing Tenant, Tenant Environment, native identity, package name, scheme, icons, splash assets, or plugin config:

```bash
bun run build:prepare
```

The command prompts for Tenant, platform, and Tenant Environment. It pulls EAS env vars first, validates that `.env.local` contains the selected `TENANT_SLUG`, then runs clean Expo prebuild.

Non-interactive examples:

```bash
bun run build:prepare -- --tenant second-tenant --env development --platform ios
bun run build:prepare -- --tenant second-tenant --env preview --android
bun run build:prepare -- --tenant second-tenant --env production --both
```

### Reset native projects to the default Tenant

```bash
bun run build:reset
```

Reset uses `first-tenant`, the `development` Tenant Environment, and both platforms. It pulls EAS development env vars, validates `TENANT_SLUG`, and runs clean prebuild.

## EAS Setup

Each Tenant maps to exactly one EAS Project. This open source starter intentionally keeps Tenant EAS Project IDs empty, so downstream apps must create or find their own EAS Projects first.

For each Tenant:

1. Log in with EAS CLI:

   ```bash
   eas login
   ```

2. Create or find one EAS Project in your Expo account or organization for the selected Tenant.
3. Copy that EAS Project ID.
4. Paste it into `tenant-configs.ts` at `configs['first-tenant'].extra.eas.projectId`, replacing `first-tenant` with the selected Tenant Slug.
5. Repeat for every Tenant you intend to build.
6. Replace `EXPO_OWNER` in `project-config.ts` with your Expo account or organization owner.

Optional helper:

```bash
TENANT_SLUG=first-tenant eas init
```

Use `eas init` only to create or discover the Tenant's EAS Project ID. If it prints a `projectId` and then exits with an error because this app uses dynamic config, copy the printed ID and paste it into `tenant-configs.ts`.

In each EAS Project, create environment variables for the EAS environments you use: `development`, `preview`, and `production`. Each environment must include `TENANT_SLUG`, and its value must match the Tenant Slug for that EAS Project.

Never put `EAS_PROJECT_ID` in EAS environment variables. EAS Project IDs live in `tenant-configs.ts`; they are public identifiers, not secrets.

## Add A Tenant

To add a Tenant, update:

- `src/types/tenant-config.types.ts` to add the Tenant Slug to `TENANT_SLUGS`.
- `tenant-configs.ts` to add the Tenant's config entry.
- `assets/<tenant-slug>/icons/` with required Android and general icon assets.
- `assets/<tenant-slug>/app.icon/` with required iOS icon asset catalog files.

Required asset paths are validated when the dynamic Expo config resolves the selected Tenant.

## Project Structure

```text
.
├── app.config.ts                 # Dynamic Expo config resolved from TENANT_SLUG
├── assets/
│   ├── first-tenant/             # Native assets for FirstTenant
│   └── second-tenant/            # Native assets for SecondTenant
├── scripts/
│   ├── tenant-cli.ts             # Bun CLI entrypoint
│   ├── tenant-cli-core.ts        # Tenant workflow planning and validation
│   └── tenant-cli-runtime.ts     # EAS/env/prebuild execution
├── src/
│   ├── app/                      # Expo Router screens
│   ├── hooks/                    # Runtime Tenant and theme hooks
│   ├── providers/                # App providers
│   ├── types/                    # Tenant and app types
│   └── utils/                    # Runtime config and tenant accent helpers
├── tenant-configs.ts             # Tenant registry
└── tests/                        # Tenant workflow tests
```

## Checks

```bash
bun test tests
bunx tsc --noEmit --pretty false
bun run lint
```

## Showcase Direction

The banner uses the main visual story: one Expo codebase can produce multiple branded native apps. A future landing page should show the same idea with real simulator screenshots once the app surface is more complete:

- one shared product flow,
- two or more Tenant-branded app identities,
- a short build workflow preview,
- and a clear note that each Tenant maps to its own native identity and EAS Project.

## Expo Docs

This repo targets Expo SDK 56. Read the exact versioned docs before changing Expo code:

https://docs.expo.dev/versions/v56.0.0/
