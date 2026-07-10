import fs from 'fs-extra';
import { join } from 'pathe';
import { assert } from 'vitest';

import {
  getGeneratedSetupTypeDefinition,
  type GeneratedSetupType,
} from '../src/generated-setup-types';
import { type GeneratedStylingChoice } from '../src/generated-styling-choices';

type PackageJson = {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

async function readText(path: string): Promise<string> {
  return fs.readFile(path, 'utf8');
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readText(path)) as T;
}

async function exists(path: string): Promise<boolean> {
  return fs.pathExists(path);
}

function assertNoStandaloneGeneratedSourceLeaks(generatedSource: string) {
  assert.notMatch(generatedSource, /apps\/playground/);
  assert.notMatch(generatedSource, /from ['"].*playground/);
  assert.notMatch(generatedSource, /active-setup|setup-types/);
  assert.notMatch(generatedSource, /from ['"](?:@tenkit\/|tenkit\/)/);
  assert.notMatch(generatedSource, /activeSetup|Active Setup/);
  assert.notMatch(generatedSource, /setupType|Setup Type/);
  assert.notMatch(generatedSource, /base-expo|templates\/assets/);
}

async function verifyWhiteLabelApps(targetDir: string) {
  const definition = getGeneratedSetupTypeDefinition('white-label-apps');
  const packageJson = await readJson<PackageJson>(join(targetDir, 'package.json'));
  const appVariants = await readText(join(targetDir, 'src/constants/app-variants.ts'));
  const designTokens = await readText(join(targetDir, 'src/constants/design-tokens.ts'));
  const globals = await readText(join(targetDir, 'src/constants/globals.ts'));
  const appConfig = await readText(join(targetDir, 'app.config.ts'));
  const themedText = await readText(join(targetDir, 'src/components/themed-text.tsx'));
  const themedView = await readText(join(targetDir, 'src/components/themed-view.tsx'));
  const tenkitCli = await readText(join(targetDir, 'scripts/tenkit-cli.ts'));
  const tenkitCliCore = await readText(join(targetDir, 'scripts/tenkit-cli-core.ts'));
  const tenkitCliRuntime = await readText(join(targetDir, 'scripts/tenkit-cli-runtime.ts'));
  const app = await readText(join(targetDir, 'src/app/index.tsx'));

  assert.equal(packageJson.name, definition.defaultPackageName);
  assert.equal(packageJson.scripts?.tenkit, 'tsx scripts/tenkit-cli.ts');
  assert.equal(packageJson.dependencies?.expo, '~56.0.12');
  assert.match(appVariants, /slug: 'first-tenant'/);
  assert.match(appVariants, /slug: 'second-tenant'/);
  assert.match(appConfig, /resolveAppVariantConfig/);
  assert.match(designTokens, /export const Typography/);
  assert.match(themedText, /@\/constants\/design-tokens/);
  assert.match(themedText, /linkPrimary/);
  assert.match(themedView, /type\?: ThemeColor/);
  assert.match(globals, /globalStyles/);
  assert.match(app, /globalStyles\.centeredContainer/);
  assert.match(tenkitCli, /command\('build'\)/);
  assert.match(tenkitCli, /command\('reset'\)/);
  assert.match(tenkitCli, /command\('doctor'\)/);
  assert.notMatch(tenkitCli, /command\('setup'\)/);
  assert.match(tenkitCliCore, /from '\.\.\/src\/constants\/app-variants'/);
  assert.match(tenkitCliRuntime, /from '\.\.\/src\/constants\/app-variants'/);
  assert.equal(await exists(join(targetDir, 'src/constants/design-tokens.ts')), true);
  assert.equal(await exists(join(targetDir, 'src/constants/globals.ts')), true);
  assert.equal(await exists(join(targetDir, 'src/constants/app-variant-targets.ts')), false);
  assert.equal(await exists(join(targetDir, 'scripts/tenkit-cli-app-variant-targets.ts')), false);
  for (const slug of definition.appVariantSlugs) {
    assert.equal(await exists(join(targetDir, `assets/${slug}/icons/icon.png`)), true);
  }
  assertNoStandaloneGeneratedSourceLeaks(
    [
      appConfig,
      appVariants,
      designTokens,
      globals,
      themedText,
      themedView,
      tenkitCli,
      tenkitCliCore,
      tenkitCliRuntime,
      app,
    ].join('\n'),
  );
}

async function verifySingleAppRuntimeTenants(targetDir: string) {
  const definition = getGeneratedSetupTypeDefinition('single-app-runtime-tenants');
  const packageJson = await readJson<PackageJson>(join(targetDir, 'package.json'));
  const readme = await readText(join(targetDir, 'README.md'));
  const envExample = await readText(join(targetDir, '.env.example'));
  const appConfig = await readText(join(targetDir, 'app.config.ts'));
  const appVariantTypes = await readText(join(targetDir, 'src/types/app-variant.ts'));
  const runtimeTenantTypes = await readText(join(targetDir, 'src/types/runtime-tenant.ts'));
  const appVariant = await readText(join(targetDir, 'src/constants/app-variant.ts'));
  const designTokens = await readText(join(targetDir, 'src/constants/design-tokens.ts'));
  const globals = await readText(join(targetDir, 'src/constants/globals.ts'));
  const runtimeTenants = await readText(join(targetDir, 'src/constants/runtime-tenants.ts'));
  const appVariantHook = await readText(join(targetDir, 'src/hooks/use-app-variant-config.ts'));
  const activeRuntimeTenantHook = await readText(
    join(targetDir, 'src/hooks/use-active-runtime-tenant.ts'),
  );
  const appPreferences = await readText(join(targetDir, 'src/storage/app-preferences.ts'));
  const resolver = await readText(join(targetDir, 'src/lib/resolve-app-variant-config.ts'));
  const runtimeTenantAccess = await readText(join(targetDir, 'src/lib/runtime-tenant-access.ts'));
  const themedText = await readText(join(targetDir, 'src/components/themed-text.tsx'));
  const themedView = await readText(join(targetDir, 'src/components/themed-view.tsx'));
  const tenkitCli = await readText(join(targetDir, 'scripts/tenkit-cli.ts'));
  const tenkitCliCore = await readText(join(targetDir, 'scripts/tenkit-cli-core.ts'));
  const tenkitCliRuntime = await readText(join(targetDir, 'scripts/tenkit-cli-runtime.ts'));
  const app = await readText(join(targetDir, 'src/app/index.tsx'));
  const settings = await readText(join(targetDir, 'src/app/settings.tsx'));

  assert.equal(packageJson.name, definition.defaultPackageName);
  assert.equal(packageJson.scripts?.tenkit, 'tsx scripts/tenkit-cli.ts');
  assert.equal(packageJson.scripts?.typecheck, 'tsc --noEmit --pretty false');
  assert.equal(packageJson.dependencies?.['@expo/ui'], '~56.0.16');
  assert.equal(packageJson.dependencies?.['react-native-mmkv'], '^4.3.1');
  assert.equal(packageJson.dependencies?.['react-native-nitro-modules'], '^0.35.9');
  assert.equal(packageJson.dependencies?.expo, '~56.0.12');
  assert.match(readme, /Runtime Tenant records live in generated source data/);
  assert.match(envExample, /APP_VARIANT_SLUG=acme-app/);
  assert.match(appConfig, /APP_VARIANT_SLUG/);
  assert.match(appConfig, /resolveAppVariantConfig/);
  assert.match(appVariantTypes, /runtimeTenantAccess: RuntimeTenantAccess/);
  assert.match(runtimeTenantTypes, /export type RuntimeTenant =/);
  assert.match(appVariant, /export const appVariant =/);
  assert.match(designTokens, /export const Typography/);
  assert.match(globals, /globalStyles/);
  assert.match(appVariant, /slug: 'acme-app'/);
  assert.match(appVariant, /runtimeTenantAccess/);
  assert.match(appVariant, /allowedRuntimeTenantIds: \[100, 101, 102\]/);
  assert.notMatch(appVariant, /appVariants|defaultAppVariantId|selectionMode/);
  assert.match(runtimeTenants, /runtimeTenantId: 100/);
  assert.match(runtimeTenants, /name: 'North Branch'/);
  assert.match(runtimeTenants, /satisfies readonly RuntimeTenant\[\]/);
  assert.notMatch(appVariantHook, /isAppVariantConfigExtra/);
  assert.match(appVariantHook, /Constants\.expoConfig\?\.extra as AppVariantConfigExtra/);
  assert.match(appVariantHook, /runtimeTenantAccess/);
  assert.match(themedText, /@\/constants\/design-tokens/);
  assert.match(themedText, /linkPrimary/);
  assert.match(themedView, /type\?: ThemeColor/);
  assert.match(resolver, /validateRuntimeTenantAccess/);
  assert.match(resolver, /const extra: ResolvedAppVariantConfig\['extra'\]/);
  assert.match(resolver, /runtimeTenantAccess,/);
  assert.notMatch(resolver, /runtimeTenants:/);
  assert.match(runtimeTenantAccess, /resolveDefaultRuntimeTenant/);
  assert.match(runtimeTenantAccess, /resolveSelectableRuntimeTenants/);
  assert.match(runtimeTenantAccess, /normalizeCapabilityProfile/);
  assert.match(runtimeTenantAccess, /Duplicate Runtime Tenant ID/);
  assert.match(activeRuntimeTenantHook, /useActiveRuntimeTenant/);
  assert.match(activeRuntimeTenantHook, /useMMKVNumber/);
  assert.match(activeRuntimeTenantHook, /ACTIVE_RUNTIME_TENANT_ID_KEY/);
  assert.match(activeRuntimeTenantHook, /resolveSelectableRuntimeTenants/);
  assert.match(
    activeRuntimeTenantHook,
    /hasRuntimeTenantSelection: allowedRuntimeTenantIds\.length > 1/,
  );
  assert.notMatch(activeRuntimeTenantHook, /selectionMode/);
  assert.match(appPreferences, /createMMKV/);
  assert.match(tenkitCli, /command\('build'\)/);
  assert.match(tenkitCli, /command\('reset'\)/);
  assert.match(tenkitCli, /command\('doctor'\)/);
  assert.notMatch(tenkitCli, /command\('setup'\)/);
  assert.match(tenkitCliCore, /from '\.\.\/src\/constants\/app-variant'/);
  assert.match(tenkitCliCore, /Expected: \$\{appVariant\.slug\}/);
  assert.notMatch(tenkitCliCore, /defaultAppVariantId|appVariants\?: readonly AppVariant\[\]/);
  assert.match(tenkitCliRuntime, /from '\.\.\/src\/constants\/app-variant'/);
  assert.notMatch(tenkitCliRuntime, /shouldPromptForAppVariant|Select an App Variant:|appVariants/);
  assert.notMatch(tenkitCliRuntime, /Runtime Tenant/);
  assert.match(app, /Active Runtime Tenant/);
  assert.match(app, /Active Runtime Tenant ID/);
  assert.match(app, /globalStyles\.centeredContainer/);
  assert.notMatch(app, /Runtime Tenant IDs/);
  assert.notMatch(app, /resolveSelectableRuntimeTenants/);
  assert.match(settings, /Picker/);
  assert.match(settings, /Active Runtime Tenant/);
  assert.match(settings, /globalStyles\.container/);
  assert.notMatch(settings, /swift-ui\/modifiers|scrollContentBackground/);
  assert.equal(await exists(join(targetDir, 'src/app/settings.tsx')), true);
  assert.equal(await exists(join(targetDir, 'src/app/explore.tsx')), false);
  assert.equal(await exists(join(targetDir, 'src/constants/design-tokens.ts')), true);
  assert.equal(await exists(join(targetDir, 'src/constants/globals.ts')), true);
  assert.equal(await exists(join(targetDir, 'src/constants/app-variant.ts')), true);
  assert.equal(await exists(join(targetDir, 'src/constants/app-variants.ts')), false);
  assert.equal(await exists(join(targetDir, 'src/constants/app-variant-targets.ts')), false);
  assert.equal(await exists(join(targetDir, 'scripts/tenkit-cli-app-variant-targets.ts')), false);
  assert.equal(await exists(join(targetDir, 'src/storage/app-preferences.ts')), true);
  assert.equal(await exists(join(targetDir, 'assets/acme-app/icons/icon.png')), true);
  assert.equal(await exists(join(targetDir, 'assets/acme-app/icons/favicon.png')), true);
  assert.equal(
    await exists(join(targetDir, 'assets/acme-app/icons/android-icon-background.png')),
    true,
  );
  assert.equal(
    await exists(join(targetDir, 'assets/acme-app/icons/android-icon-foreground.png')),
    true,
  );
  assert.equal(
    await exists(join(targetDir, 'assets/acme-app/icons/android-icon-monochrome.png')),
    true,
  );
  assert.equal(await exists(join(targetDir, 'assets/acme-app/icons/splash-icon-light.png')), true);
  assert.equal(await exists(join(targetDir, 'assets/acme-app/icons/splash-icon-dark.png')), true);
  assert.equal(await exists(join(targetDir, 'assets/acme-app/app.icon/icon.json')), true);
  assert.equal(await exists(join(targetDir, 'assets/first-tenant/icons/icon.png')), false);
  assert.equal(await exists(join(targetDir, 'assets/second-tenant/icons/icon.png')), false);
  assertNoStandaloneGeneratedSourceLeaks(
    [
      appConfig,
      appVariant,
      designTokens,
      globals,
      runtimeTenants,
      activeRuntimeTenantHook,
      appPreferences,
      appVariantHook,
      resolver,
      runtimeTenantAccess,
      themedText,
      themedView,
      tenkitCli,
      tenkitCliCore,
      tenkitCliRuntime,
      app,
      settings,
    ].join('\n'),
  );
}

async function verifyGenericWithStandaloneAppVariants(targetDir: string) {
  const definition = getGeneratedSetupTypeDefinition('generic-with-standalone-app-variants');
  const packageJson = await readJson<PackageJson>(join(targetDir, 'package.json'));
  const readme = await readText(join(targetDir, 'README.md'));
  const envExample = await readText(join(targetDir, '.env.example'));
  const appConfig = await readText(join(targetDir, 'app.config.ts'));
  const appVariantTypes = await readText(join(targetDir, 'src/types/app-variant.ts'));
  const runtimeTenantTypes = await readText(join(targetDir, 'src/types/runtime-tenant.ts'));
  const appVariants = await readText(join(targetDir, 'src/constants/app-variants.ts'));
  const runtimeTenants = await readText(join(targetDir, 'src/constants/runtime-tenants.ts'));
  const appVariantHook = await readText(join(targetDir, 'src/hooks/use-app-variant-config.ts'));
  const activeRuntimeTenantHook = await readText(
    join(targetDir, 'src/hooks/use-active-runtime-tenant.ts'),
  );
  const appPreferences = await readText(join(targetDir, 'src/storage/app-preferences.ts'));
  const resolver = await readText(join(targetDir, 'src/lib/resolve-app-variant-config.ts'));
  const runtimeTenantAccess = await readText(join(targetDir, 'src/lib/runtime-tenant-access.ts'));
  const themedText = await readText(join(targetDir, 'src/components/themed-text.tsx'));
  const themedView = await readText(join(targetDir, 'src/components/themed-view.tsx'));
  const tenkitCli = await readText(join(targetDir, 'scripts/tenkit-cli.ts'));
  const tenkitCliCore = await readText(join(targetDir, 'scripts/tenkit-cli-core.ts'));
  const tenkitCliRuntime = await readText(join(targetDir, 'scripts/tenkit-cli-runtime.ts'));
  const app = await readText(join(targetDir, 'src/app/index.tsx'));
  const settings = await readText(join(targetDir, 'src/app/settings.tsx'));

  assert.equal(packageJson.name, definition.defaultPackageName);
  assert.equal(packageJson.scripts?.tenkit, 'tsx scripts/tenkit-cli.ts');
  assert.equal(packageJson.scripts?.typecheck, 'tsc --noEmit --pretty false');
  assert.equal(packageJson.dependencies?.['@expo/ui'], '~56.0.16');
  assert.equal(packageJson.dependencies?.['react-native-mmkv'], '^4.3.1');
  assert.equal(packageJson.dependencies?.expo, '~56.0.12');
  assert.match(readme, /Generic With Standalone App Variants project/);
  assert.match(readme, /third proof Template/);
  assert.match(readme, /Generated App Local CLI/);
  assert.match(readme, /APP_VARIANT_SLUG=atlas-network/);
  assert.match(readme, /APP_VARIANT_SLUG=west-studio/);
  assert.match(readme, /Generic App Variant's EAS environment/);
  assert.match(readme, /Standalone App Variant's EAS environment/);
  assert.match(envExample, /APP_VARIANT_SLUG=atlas-network/);
  assert.match(appConfig, /APP_VARIANT_SLUG/);
  assert.match(appConfig, /resolveAppVariantConfig/);
  assert.match(appVariantTypes, /export type GenericAppVariant/);
  assert.match(appVariantTypes, /export type StandaloneAppVariant/);
  assert.match(runtimeTenantTypes, /export type RuntimeTenant =/);
  assert.match(appVariants, /role: 'generic'/);
  assert.match(appVariants, /slug: 'atlas-network'/);
  assert.match(appVariants, /name: "Atlas Network"/);
  assert.match(appVariants, /allowedRuntimeTenantIds: \[100, 101, 102\]/);
  assert.match(appVariants, /role: 'standalone'/);
  assert.match(appVariants, /slug: 'west-studio'/);
  assert.match(appVariants, /name: "West Studio"/);
  assert.match(appVariants, /standaloneRuntimeTenantId: 103/);
  assert.match(runtimeTenants, /name: 'North Studio'/);
  assert.match(runtimeTenants, /name: 'South Studio'/);
  assert.match(runtimeTenants, /name: 'East Studio'/);
  assert.match(runtimeTenants, /name: 'West Studio'/);
  assert.match(runtimeTenants, /satisfies readonly RuntimeTenant\[\]/);
  assert.match(appVariantHook, /Constants\.expoConfig\?\.extra as AppVariantConfigExtra/);
  assert.match(appVariantHook, /standaloneRuntimeTenantId/);
  assert.match(resolver, /validateRuntimeTenantAccess/);
  assert.match(resolver, /const extra: ResolvedAppVariantConfig\['extra'\]/);
  assert.match(resolver, /runtimeTenantAccess: resolvedAppVariant\.runtimeTenantAccess/);
  assert.match(
    resolver,
    /standaloneRuntimeTenantId: resolvedAppVariant\.standaloneRuntimeTenantId/,
  );
  assert.match(resolver, /duplicateAppVariantId !== undefined/);
  assert.notMatch(resolver, /runtimeTenants:/);
  assert.match(runtimeTenantAccess, /resolveDefaultRuntimeTenant/);
  assert.match(runtimeTenantAccess, /resolveSelectableRuntimeTenants/);
  assert.match(runtimeTenantAccess, /normalizeCapabilityProfile/);
  assert.match(runtimeTenantAccess, /Duplicate Runtime Tenant ID/);
  assert.match(runtimeTenantAccess, /validateGenericAppVariantCount/);
  assert.match(runtimeTenantAccess, /genericAppVariants\.length !== 1/);
  assert.match(runtimeTenantAccess, /must include exactly one Generic App Variant/);
  assert.match(runtimeTenantAccess, /Duplicate standalone Runtime Tenant assignment/);
  assert.match(runtimeTenantAccess, /must not appear in Generic App Variant Runtime Tenant Access/);
  assert.match(activeRuntimeTenantHook, /useActiveRuntimeTenant/);
  assert.match(activeRuntimeTenantHook, /appVariant\.role === 'standalone'/);
  assert.match(
    activeRuntimeTenantHook,
    /hasRuntimeTenantSelection: appVariant\.role === 'generic'/,
  );
  assert.match(appPreferences, /createMMKV/);
  assert.match(themedText, /@\/constants\/design-tokens/);
  assert.match(themedText, /linkPrimary/);
  assert.match(themedView, /type\?: ThemeColor/);
  assert.match(tenkitCli, /command\('build'\)/);
  assert.match(tenkitCli, /command\('reset'\)/);
  assert.match(tenkitCli, /command\('doctor'\)/);
  assert.notMatch(tenkitCli, /command\('setup'\)/);
  assert.match(tenkitCliCore, /APP_VARIANT_ENVIRONMENTS/);
  assert.match(tenkitCliCore, /from '\.\.\/src\/constants\/app-variants'/);
  assert.match(tenkitCliRuntime, /Select an App Variant:/);
  assert.notMatch(tenkitCliRuntime, /Runtime Tenant/);
  assert.match(app, /Active Runtime Tenant/);
  assert.match(app, /Active Runtime Tenant ID/);
  assert.match(app, /Atlas Network can select North, South, and East Studio/);
  assert.match(settings, /Picker/);
  assert.match(settings, /hasRuntimeTenantSelection/);
  assert.equal(await exists(join(targetDir, 'src/app/settings.tsx')), true);
  assert.equal(await exists(join(targetDir, 'src/app/explore.tsx')), false);
  assert.equal(await exists(join(targetDir, 'src/constants/app-variants.ts')), true);
  assert.equal(await exists(join(targetDir, 'src/constants/app-variant.ts')), false);
  assert.equal(await exists(join(targetDir, 'src/constants/app-variant-targets.ts')), false);
  assert.equal(await exists(join(targetDir, 'scripts/tenkit-cli-app-variant-targets.ts')), false);
  assert.equal(await exists(join(targetDir, 'src/constants/runtime-tenants.ts')), true);
  assert.equal(await exists(join(targetDir, 'src/storage/app-preferences.ts')), true);
  assert.equal(await exists(join(targetDir, 'assets/atlas-network/icons/icon.png')), true);
  assert.equal(await exists(join(targetDir, 'assets/west-studio/icons/icon.png')), true);
  assert.equal(await exists(join(targetDir, 'assets/atlas-network/app.icon/icon.json')), true);
  assert.equal(await exists(join(targetDir, 'assets/west-studio/app.icon/icon.json')), true);
  assert.equal(await exists(join(targetDir, 'assets/north-studio/icons/icon.png')), false);
  assert.equal(await exists(join(targetDir, 'assets/south-studio/icons/icon.png')), false);
  assert.equal(await exists(join(targetDir, 'assets/east-studio/icons/icon.png')), false);
  assertNoStandaloneGeneratedSourceLeaks(
    [
      appConfig,
      appVariantTypes,
      runtimeTenantTypes,
      appVariants,
      runtimeTenants,
      activeRuntimeTenantHook,
      appPreferences,
      appVariantHook,
      resolver,
      runtimeTenantAccess,
      themedText,
      themedView,
      tenkitCli,
      tenkitCliCore,
      tenkitCliRuntime,
      app,
      settings,
    ].join('\n'),
  );
}

async function verifyUniwindGeneratedApp(setupType: GeneratedSetupType, targetDir: string) {
  const definition = getGeneratedSetupTypeDefinition(setupType);
  const packageJson = await readJson<PackageJson>(join(targetDir, 'package.json'));
  const tsconfig = await readText(join(targetDir, 'tsconfig.json'));
  const metroConfig = await readText(join(targetDir, 'metro.config.js'));
  const globalCss = await readText(join(targetDir, 'src/global.css'));
  const uniwindEnv = await readText(join(targetDir, 'src/uniwind-env.d.ts'));
  const gitignore = await readText(join(targetDir, '.gitignore'));
  const layout = await readText(join(targetDir, 'src/app/_layout.tsx'));
  const app = await readText(join(targetDir, 'src/app/index.tsx'));
  const nativeTabs = await readText(join(targetDir, 'src/components/app-tabs.tsx'));
  const webTabs = await readText(join(targetDir, 'src/components/app-tabs.web.tsx'));
  const appConfig = await readText(join(targetDir, 'app.config.ts'));

  assert.equal(packageJson.name, definition.defaultPackageName);
  assert.equal(packageJson.dependencies?.uniwind, '^1.10.0');
  assert.equal(packageJson.dependencies?.clsx, '^2.1.1');
  assert.equal(packageJson.dependencies?.['tailwind-merge'], '^3.6.0');
  assert.equal(packageJson.dependencies?.['@expo/ui'], undefined);
  assert.equal(packageJson.devDependencies?.tailwindcss, '^4.3.2');
  assert.match(tsconfig, /"uniwind\/types"/);
  assert.match(tsconfig, /"src\/uniwind-env\.d\.ts"/);
  assert.match(metroConfig, /withUniwindConfig\(config, \{/);
  assert.match(metroConfig, /cssEntryFile: '\.\/src\/global\.css'/);
  assert.match(metroConfig, /dtsFile: '\.\/src\/uniwind-types\.d\.ts'/);
  assert.match(globalCss, /@layer theme/);
  assert.match(globalCss, /@variant dark/);
  assert.match(globalCss, /@variant light/);
  assert.match(globalCss, /--color-background:/);
  assert.match(globalCss, /--color-surface:/);
  assert.match(globalCss, /--color-surface-raised:/);
  assert.match(globalCss, /--color-foreground:/);
  assert.match(globalCss, /--color-muted:/);
  assert.match(globalCss, /--color-accent:/);
  assert.notMatch(globalCss, /--color-bg(?:-|:)|--color-text(?:-|:)/);
  assert.match(uniwindEnv, /<reference types="uniwind\/types" \/>/);
  assert.match(uniwindEnv, /declare module '\*\.css';/);
  assert.match(gitignore, /src\/uniwind-types\.d\.ts/);
  assert.match(layout, /import '\.\.\/global\.css'/);
  assert.match(app, /bg-background/);
  assert.match(app, /text-foreground/);
  assert.match(app, /text-muted/);
  assert.match(app, /theme\.accent/);
  assert.notMatch(app, /appVariant\.theme/);
  assert.match(nativeTabs, /useCSSVariable/);
  assert.match(nativeTabs, /'--color-surface'/);
  assert.match(nativeTabs, /'--color-surface-raised'/);
  assert.match(nativeTabs, /'--color-foreground'/);
  assert.match(nativeTabs, /'--color-muted'/);
  assert.match(nativeTabs, /as ColorValue\[\]/);
  assert.match(nativeTabs, /selected: accent/);
  assert.notMatch(nativeTabs, /#[0-9a-f]{3,8}\b/i);
  assert.match(webTabs, /className=/);
  assert.match(webTabs, /bg-surface-raised/);
  assert.match(webTabs, /bg-surface/);
  assert.match(webTabs, /text-foreground/);
  assert.match(webTabs, /text-muted/);
  assert.notMatch(`${app}\n${webTabs}`, /bg-bg|border-bg|text-text/);
  assert.match(webTabs, /style=\{isFocused \? \{ color: accent \} : undefined\}/);
  assert.match(appConfig, /resolveAppVariantConfig/);
  assert.equal(await exists(join(targetDir, 'src/css.d.ts')), false);
  assert.equal(await exists(join(targetDir, 'src/uniwind-env.d.ts')), true);
  assert.equal(await exists(join(targetDir, 'src/uniwind-types.d.ts')), false);
  assert.equal(await exists(join(targetDir, 'src/lib/cn.ts')), true);
  assert.equal(await exists(join(targetDir, 'src/theme/ThemeContext.tsx')), false);
  assert.equal(await exists(join(targetDir, 'src/theme/colors.ts')), false);
  assert.equal(await exists(join(targetDir, 'src/constants/design-tokens.ts')), false);
  assert.equal(await exists(join(targetDir, 'src/constants/globals.ts')), false);
  assert.equal(await exists(join(targetDir, 'src/components/themed-text.tsx')), false);
  assert.equal(await exists(join(targetDir, 'src/components/themed-view.tsx')), false);

  for (const slug of definition.appVariantSlugs) {
    assert.equal(await exists(join(targetDir, `assets/${slug}/icons/icon.png`)), true);
    assert.equal(await exists(join(targetDir, `assets/${slug}/app.icon/icon.json`)), true);
  }

  const generatedSource = [appConfig, layout, app, nativeTabs, webTabs, globalCss];

  if (setupType === 'white-label-apps') {
    const appVariants = await readText(join(targetDir, 'src/constants/app-variants.ts'));
    const explore = await readText(join(targetDir, 'src/app/explore.tsx'));

    assert.match(appConfig, /APP_VARIANT_SLUG/);
    assert.match(appVariants, /slug: 'first-tenant'/);
    assert.match(appVariants, /slug: 'second-tenant'/);
    assert.match(explore, /withUniwind\(NativeSafeAreaView\)/);
    assert.equal(await exists(join(targetDir, 'src/app/settings.tsx')), false);
    generatedSource.push(appVariants, explore);
  } else {
    const settings = await readText(join(targetDir, 'src/app/settings.tsx'));
    const activeRuntimeTenantHook = await readText(
      join(targetDir, 'src/hooks/use-active-runtime-tenant.ts'),
    );
    const runtimeTenantAccess = await readText(join(targetDir, 'src/lib/runtime-tenant-access.ts'));
    const appPreferences = await readText(join(targetDir, 'src/storage/app-preferences.ts'));

    assert.match(app, /useActiveRuntimeTenant/);
    assert.match(settings, /hasRuntimeTenantSelection/);
    assert.match(settings, /setActiveRuntimeTenantId/);
    assert.match(settings, /theme\.accent/);
    assert.match(activeRuntimeTenantHook, /useMMKVNumber/);
    assert.match(runtimeTenantAccess, /validateRuntimeTenantAccess/);
    assert.match(appPreferences, /createMMKV/);
    assert.equal(await exists(join(targetDir, 'src/app/explore.tsx')), false);
    generatedSource.push(settings, activeRuntimeTenantHook, runtimeTenantAccess, appPreferences);

    if (setupType === 'single-app-runtime-tenants') {
      const appVariant = await readText(join(targetDir, 'src/constants/app-variant.ts'));
      assert.match(appVariant, /slug: 'acme-app'/);
      assert.match(activeRuntimeTenantHook, /runtimeTenantAccess\.allowedRuntimeTenantIds/);
      assert.equal(await exists(join(targetDir, 'src/constants/app-variants.ts')), false);
      generatedSource.push(appVariant);
    } else {
      const appVariants = await readText(join(targetDir, 'src/constants/app-variants.ts'));
      assert.match(appConfig, /APP_VARIANT_SLUG/);
      assert.match(appVariants, /role: 'generic'/);
      assert.match(appVariants, /role: 'standalone'/);
      assert.match(activeRuntimeTenantHook, /appVariant\.role === 'standalone'/);
      assert.match(
        runtimeTenantAccess,
        /must not appear in Generic App Variant Runtime Tenant Access/,
      );
      generatedSource.push(appVariants);
    }
  }

  assertNoStandaloneGeneratedSourceLeaks(generatedSource.join('\n'));
}

export async function verifyGeneratedAppShape(
  setupType: GeneratedSetupType,
  targetDir: string,
  stylingChoice: GeneratedStylingChoice = 'bare',
): Promise<void> {
  if (stylingChoice === 'uniwind') {
    await verifyUniwindGeneratedApp(setupType, targetDir);
    return;
  }

  if (setupType === 'white-label-apps') {
    await verifyWhiteLabelApps(targetDir);
    return;
  }

  if (setupType === 'single-app-runtime-tenants') {
    await verifySingleAppRuntimeTenants(targetDir);
    return;
  }

  await verifyGenericWithStandaloneAppVariants(targetDir);
}
