# Single App Runtime Tenants Example

This is a living local-source reference for Tenkit's **Single App Runtime Tenants** Setup Type. It is not the default Playground Active Setup, not standalone Template packaging, and not a replacement for **White Label Apps**.

The model is: one **App Variant** owns the native app identity, and that app can open multiple **Runtime Tenants** at runtime. Build Preparation selects the App Variant only; Runtime Tenant selection remains an in-app/runtime concern.

## What This Example Proves

`acmeAppVariant` is the only App Variant in this example. It owns build-time native identity for `Acme App`, including app identifiers, version, scheme, theme, EAS project metadata, and Runtime Tenant Access bootstrap data.

`runtimeTenants` contains the local Runtime Tenant records the App Variant may open:

- `100`: `North Branch`
- `101`: `South Branch`
- `102`: `East Branch`

Runtime Tenant Access lives on the App Variant. Its `allowedRuntimeTenantIds` list is explicit, includes the default Runtime Tenant ID, and preserves selectable order.

The durable model and validation logic live in `src/setup-types/single-app-runtime-tenants.ts`; this example imports shared Starter Data from `starter-data/` so its Acme fixture facts stay aligned with Scaffold output.

## Capability Profiles

Runtime Tenant Capability Profiles are generic product feature flags. The only capability keys are `featureA`, `featureB`, and `featureC`.

Raw Runtime Tenant capability data can omit the whole capabilities object or omit individual flags. Resolved Runtime Tenants always receive a complete normalized profile where omitted flags are `false`.

Capability Profiles in this example deliberately do not use provider or integration names such as Convex, Clerk, Better Auth, Stripe, or RevenueCat.

## Use As The Active Setup

The supported local path is the Scaffold command from the repo root:

```bash
pnpm tenkit setup --setup-type single-app-runtime-tenants --dry-run --yes
pnpm tenkit setup --setup-type single-app-runtime-tenants --yes --force
```

The Scaffold writes setup-owned Playground files for an editable starter App Variant. It does not modify shared app entry points, native assets, EAS project state, local env files, or native `ios/` and `android/` directories.

## Verification

Default clone checks do not run example-specific tests. Verify this example explicitly with:

```bash
pnpm -F playground exec tsx --test examples/single-app-runtime-tenants/runtime-tenant-access.test.ts
```

## Out Of Scope

This example does not include auth, backend implementation, billing, a Runtime Tenant picker UI, backend-driven Runtime Tenant data, reusable capability profiles, parent Runtime Tenant relationships, visibility rules, source flags, standalone Template generation, or a public `tenkit init` flow.

White Label Apps remain a valid Tenkit Setup Type. This example expands the setup model; it does not migrate the starter unless the Scaffold is explicitly applied.
