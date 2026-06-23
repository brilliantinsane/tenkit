# Generic With Standalone App Variants Example

This is a living local-source reference for Tenkit's **Generic With Standalone App Variants** Setup Type. It is an **Example**, not a **Template**, not public `tenkit init` packaging, and not the default Playground **Active Setup**.

The model is: one **Generic App Variant** can open multiple selectable **Runtime Tenants**, while selected **Runtime Tenants** may ship as dedicated **Standalone App Variants**. Build Preparation selects an App Variant only; Runtime Tenant selection remains an in-app/runtime concern.

## What This Example Proves

`Atlas Network` is the Generic App Variant. Its Runtime Tenant Access allows only:

- `100`: `North Studio`
- `101`: `South Studio`
- `102`: `East Studio`

`West Studio` is both a Runtime Tenant and a Standalone App Variant. The standalone App Variant points directly at Runtime Tenant ID `103`, so West Studio does not appear in Atlas Network's selectable Runtime Tenant list.

`runtimeTenants` means all known business contexts for this Active Setup. App Variant access decides which of those Runtime Tenants each installed app can open.

The durable model and validation logic live in `src/setup-types/generic-app.ts`; this example imports shared Starter Data from `starter-data/` so its fixture facts stay aligned with Scaffold output.

## Use As The Active Setup

The supported local path is the Scaffold command from the repo root:

```bash
pnpm tenkit setup --setup-type generic-with-standalone-app-variants --dry-run --yes
pnpm tenkit setup --setup-type generic-with-standalone-app-variants --yes --force
```

The Scaffold writes setup-owned Playground files for editable starter data. It does not modify shared app entry points, generate native assets, create EAS projects, write local env files, or run native prebuild. Native assets are expected under `assets/atlas-network/` and `assets/west-studio/`.

## Verification

Default clone checks do not run example-specific tests. Verify this example explicitly with:

```bash
pnpm -F playground exec tsx --test examples/generic-with-standalone-app-variants/runtime-tenant-access.test.ts
```

## Out Of Scope

This example does not include auth, backend implementation, billing, a Runtime Tenant picker UI, backend-driven Runtime Tenant data, child Runtime Tenants under Standalone App Variants, standalone Template generation, monorepo migration, or a public `tenkit init` flow.

White Label Apps and Single App Runtime Tenants remain valid Tenkit Setup Types. This example expands the setup model; it does not migrate the starter unless the Scaffold is explicitly applied.
