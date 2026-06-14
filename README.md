# Expo Tenant Kit

Prototype kit for producing distinct Expo applications from configured Tenants.

## Setup Instructions

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd expo-tenant-kit
   ```

2. **Install nvm (Node Version Manager) globally on the system**

   - Mac and Linux: `https://github.com/nvm-sh/nvm?tab=readme-ov-file#install--update-script`
   - Mac using Brew: `https://formulae.brew.sh/formula/nvm`
   - Windows: `https://github.com/coreybutler/nvm-windows?tab=readme-ov-file#nvm-for-windows`

3. **Verify nvm is correctly installed**

   ```bash
   nvm -v
   ```

4. **Use the correct Node.js version**

   ```bash
   nvm use
   ```

   If the version from `.nvmrc` is not installed yet, run:

   ```bash
   nvm install
   nvm use
   ```

5. **Install Bun**

   Use Bun for package scripts and dependency management in this repo. Do not use npm for local
   setup, scripts, or dependency changes.

   ```bash
   bun --version
   ```

   If Bun is not installed, follow `https://bun.sh/docs/installation`.

6. **Install dependencies**

   ```bash
   bun install
   ```

7. **Configure environment**

   Create a `.env.local` file from the example file:

   ```bash
   cp .env.example .env.local
   ```

   Set `TENANT_SLUG` to one of the accepted Tenant Slugs, such as `first-tenant` or
   `second-tenant`. If `TENANT_SLUG` is omitted, the first configured Tenant is used.

8. **Configure VS Code**

   If you use VS Code, install the recommended workspace extensions when prompted. This repo
   already includes workspace settings and a Prettier config.

9. **Start the app**

   ```bash
   bun run start
   ```

   This remains the normal Expo start command. It reads `TENANT_SLUG` from `.env.local`.
   The Expo CLI output includes options for opening the app in a development build, Android
   emulator, iOS simulator, web browser, or Expo Go.

10. **Run the default Tenant on iOS**

    ```bash
    bun run ios
    ```

11. **Run the default Tenant on Android**

    ```bash
    bun run android
    ```

## Per Tenant Instructions

1. **Choose a Tenant Slug**

   Accepted Tenant Slugs currently live in `src/types/tenant-config.types.ts`:

   - `first-tenant` - the default Tenant when `TENANT_SLUG` is omitted.
   - `second-tenant` - the second configured Tenant.

   Full Tenant config lives in `tenant-configs.ts`.

2. **Configure the selected Tenant for normal Expo start**

   Set the selected Tenant in `.env.local`:

   ```bash
   TENANT_SLUG=second-tenant
   ```

   `bun run start` reads this file. Build preparation pulls EAS env vars and can update
   `.env.local`, but the CLI does not manually edit it.

3. **Configure EAS for each Tenant before Build Preparation**

   Each Tenant maps to exactly one EAS Project. This OSS starter keeps Tenant EAS Project IDs
   empty, so downstream private apps must create or find their own EAS Projects first.

   For each Tenant:

   ```bash
   eas login
   ```

   - Create or find one EAS Project in your Expo account or organization for the selected Tenant.
   - Copy that EAS Project ID.
   - Paste it into `tenant-configs.ts` at `configs['first-tenant'].extra.eas.projectId`, replacing
     `first-tenant` with the selected Tenant Slug.
   - Repeat for every Tenant you intend to build.
   - Replace `EXPO_OWNER` in `project-config.ts` with your Expo account or organization owner.

   Optional helper:

   ```bash
   TENANT_SLUG=first-tenant eas init
   ```

   Use `eas init` only to create or discover the Tenant's EAS Project ID. If it prints a
   `projectId` and then exits with an error because this app uses dynamic Expo config, copy the
   printed ID and paste it into `tenant-configs.ts`.

   In each EAS Project, create environment variables for the EAS environments you use:
   `development`, `preview`, and `production`. Each environment must include `TENANT_SLUG`, and
   its value must match the Tenant Slug for that EAS Project. For example, the EAS Project for
   `second-tenant` should have `TENANT_SLUG=second-tenant` in each configured environment.

   Never put `EAS_PROJECT_ID` in EAS environment variables. EAS Project IDs live in
   `tenant-configs.ts`; they are public identifiers, not secrets.

4. **Prepare native projects for a Tenant**

   Use build preparation after changing Tenant, Tenant Environment, native identity, package name,
   scheme, icons, splash assets, or plugin config:

   ```bash
   bun run build:prepare
   ```

   The command prompts for Tenant, platform, and Tenant Environment. It pulls EAS env vars first,
   validates that `.env.local` contains the selected `TENANT_SLUG`, then runs clean Expo prebuild.

   Non-interactive examples:

   ```bash
   bun run build:prepare -- --tenant second-tenant --env development --platform ios
   bun run build:prepare -- --tenant second-tenant --env preview --android
   bun run build:prepare -- --tenant second-tenant --env production --both
   ```

5. **Run the prepared Tenant on native targets**

   ```bash
   bun run ios
   bun run android
   ```

   These are stock Expo run commands. They do not prompt for Tenant, pull EAS env vars, or prebuild.
   Use them after build preparation has already produced the native projects you need.

   Direct Expo examples:

   ```bash
   bun expo run ios --device
   bun expo run android --device
   ```

6. **Reset native projects to the default Tenant**

   ```bash
   bun run build:reset
   ```

   Reset uses `first-tenant`, the `development` Tenant Environment, and both platforms. It pulls
   EAS development env vars, validates `TENANT_SLUG`, and runs clean prebuild.

7. **EAS authentication**

   Build preparation and reset require the global EAS CLI because they run `eas env:pull`.
   If it is missing, install it globally using the official EAS CLI installation instructions.

   Locally, the CLI runs `eas login` when needed before pulling env vars. In CI, set `EXPO_TOKEN`
   and pass all required flags so the command never prompts.

8. **Add or update a Tenant**

   To add a Tenant, update:

   - `src/types/tenant-config.types.ts` - add the Tenant Slug to `TENANT_SLUGS`.
   - `tenant-configs.ts` - add the Tenant's config entry.
   - `assets/<tenant-slug>/icons/` - add required Android/general icons.
   - `assets/<tenant-slug>/app.icon/` - add required iOS icon asset catalog files.

   Required asset paths are validated when the dynamic Expo config resolves the selected Tenant.

## Checks

```bash
bun test tests
bunx tsc --noEmit --pretty false
bun run lint
```

## Expo Docs

This repo targets Expo SDK 56. Read the exact versioned docs before changing Expo code:

https://docs.expo.dev/versions/v56.0.0/
