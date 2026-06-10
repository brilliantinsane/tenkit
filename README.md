# Expo Tenant Kit

Prototype kit for producing distinct Expo applications from configured Tenants.

## Get started

1. Install dependencies

   ```bash
   bun install
   ```

2. Choose a Tenant for local development

   ```bash
   cp .env.example .env.local
   ```

   Set `TENANT_SLUG` to one of the accepted Tenant Slugs, such as `first-tenant` or
   `second-tenant`. If `TENANT_SLUG` is omitted, the first configured Tenant is used.

3. Start the app

   ```bash
   bun expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

## Tenant Selection Contract

Each entry in `tenant-configs.ts` represents one independently branded application.
`TENANT_SLUG` is the build-time selector for that configured Tenant.

The selected Tenant config is the source of truth for:

- Tenant ID
- native app identity
- package identity
- app scheme
- minimal theme accent
- required native/app asset paths

Invalid Tenant Slugs fail during config resolution. Required assets for the selected
Tenant are validated before the dynamic Expo config output is trusted.

Runtime app code reads Tenant ID from `Constants.expoConfig.extra.tenantId`. There is no
active `EXPO_PUBLIC_TENANT_ID` runtime path.

Business Model is a future concept and is intentionally out of scope for this prototype
slice.

## Checks

```bash
bun test tests/tenant-configs.test.ts tests/tenant-runtime-config.test.ts
bunx tsc --noEmit --pretty false
bun run lint
```

## Expo Docs

This repo targets Expo SDK 56. Read the exact versioned docs before changing Expo code:

https://docs.expo.dev/versions/v56.0.0/
