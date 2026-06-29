import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import fs from 'fs-extra';
import { join, resolve } from 'pathe';

import { SUPPORTED_GENERATED_SETUP_TYPES, type GeneratedSetupType } from '../src/generator';
import { commitInitialGitSnapshot, runGenerationProof } from '../src/local-proof';

const execFileAsync = promisify(execFile);

type PackageJson = {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function usage(): string {
  return `Usage: pnpm -F @tenkit/template-generator verify:generated-app -- --setup-type <${SUPPORTED_GENERATED_SETUP_TYPES.join('|')}>`;
}

function parseSetupType(args: string[]): GeneratedSetupType {
  const setupTypeIndex = args.indexOf('--setup-type');
  const setupType = setupTypeIndex === -1 ? undefined : args[setupTypeIndex + 1];

  if (!setupType) {
    throw new Error(`Missing --setup-type.\n${usage()}`);
  }

  if (SUPPORTED_GENERATED_SETUP_TYPES.includes(setupType as GeneratedSetupType)) {
    return setupType as GeneratedSetupType;
  }

  throw new Error(
    `Unsupported generated Setup Type ${JSON.stringify(setupType)}. Expected one of: ${SUPPORTED_GENERATED_SETUP_TYPES.join(', ')}`,
  );
}

async function readText(path: string): Promise<string> {
  return fs.readFile(path, 'utf8');
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readText(path)) as T;
}

async function exists(path: string): Promise<boolean> {
  return fs.pathExists(path);
}

async function configureTestGitIdentity(cwd: string): Promise<void> {
  await execFileAsync('git', ['config', 'user.name', 'Tenkit Test'], { cwd });
  await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd });
}

async function runGeneratedCommand(cwd: string, command: string, args: string[]) {
  const commandText = [command, ...args].join(' ');

  try {
    await execFileAsync(command, args, {
      cwd,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error) {
    if (error && typeof error === 'object') {
      const details: string[] = [];

      if ('code' in error && error.code !== undefined) {
        details.push(`exit code ${String(error.code)}`);
      }

      if ('signal' in error && error.signal !== undefined) {
        details.push(`signal ${String(error.signal)}`);
      }

      throw new Error(
        `Generated app verification command failed: ${commandText}${
          details.length > 0 ? ` (${details.join(', ')})` : ''
        }. Re-run that command in the generated app for full output.`,
      );
    }

    throw error;
  }
}

function assertNoStandaloneGeneratedSourceLeaks(generatedSource: string) {
  assert.doesNotMatch(generatedSource, /apps\/playground/);
  assert.doesNotMatch(generatedSource, /from ['"].*playground/);
  assert.doesNotMatch(generatedSource, /active-setup|setup-types/);
  assert.doesNotMatch(generatedSource, /from ['"](?:@tenkit\/|tenkit\/)/);
  assert.doesNotMatch(generatedSource, /activeSetup|Active Setup/);
  assert.doesNotMatch(generatedSource, /setupType|Setup Type/);
  assert.doesNotMatch(generatedSource, /base-expo|templates\/assets/);
}

async function verifyWhiteLabelApps(targetDir: string) {
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

  assert.equal(packageJson.name, 'tenkit-white-label-app');
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
  assert.doesNotMatch(tenkitCli, /command\('setup'\)/);
  assert.equal(await exists(join(targetDir, 'src/constants/design-tokens.ts')), true);
  assert.equal(await exists(join(targetDir, 'src/constants/globals.ts')), true);
  assert.equal(await exists(join(targetDir, 'assets/first-tenant/icons/icon.png')), true);
  assert.equal(await exists(join(targetDir, 'assets/second-tenant/icons/icon.png')), true);
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

  assert.equal(packageJson.name, 'tenkit-single-app-runtime-tenants');
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
  assert.doesNotMatch(appVariant, /appVariants|defaultAppVariantId/);
  assert.match(runtimeTenants, /runtimeTenantId: 100/);
  assert.match(runtimeTenants, /name: 'North Branch'/);
  assert.match(runtimeTenants, /satisfies readonly RuntimeTenant\[\]/);
  assert.doesNotMatch(appVariantHook, /isAppVariantConfigExtra/);
  assert.match(appVariantHook, /Constants\.expoConfig\?\.extra as AppVariantConfigExtra/);
  assert.match(appVariantHook, /runtimeTenantAccess/);
  assert.match(themedText, /@\/constants\/design-tokens/);
  assert.match(themedText, /linkPrimary/);
  assert.match(themedView, /type\?: ThemeColor/);
  assert.match(resolver, /validateRuntimeTenantAccess/);
  assert.match(resolver, /const extra: ResolvedAppVariantConfig\['extra'\]/);
  assert.match(resolver, /runtimeTenantAccess,/);
  assert.doesNotMatch(resolver, /runtimeTenants:/);
  assert.match(runtimeTenantAccess, /resolveDefaultRuntimeTenant/);
  assert.match(runtimeTenantAccess, /resolveSelectableRuntimeTenants/);
  assert.match(runtimeTenantAccess, /normalizeCapabilityProfile/);
  assert.match(runtimeTenantAccess, /Duplicate Runtime Tenant ID/);
  assert.match(activeRuntimeTenantHook, /useActiveRuntimeTenant/);
  assert.match(activeRuntimeTenantHook, /useMMKVNumber/);
  assert.match(activeRuntimeTenantHook, /ACTIVE_RUNTIME_TENANT_ID_KEY/);
  assert.match(activeRuntimeTenantHook, /resolveSelectableRuntimeTenants/);
  assert.match(appPreferences, /createMMKV/);
  assert.match(tenkitCli, /command\('build'\)/);
  assert.match(tenkitCli, /command\('reset'\)/);
  assert.match(tenkitCli, /command\('doctor'\)/);
  assert.doesNotMatch(tenkitCli, /command\('setup'\)/);
  assert.doesNotMatch(tenkitCliCore, /variants\.length|appVariants|defaultAppVariantId/);
  assert.doesNotMatch(tenkitCliRuntime, /variants\.length|appVariants|defaultAppVariantId/);
  assert.doesNotMatch(tenkitCliRuntime, /Select an App Variant:/);
  assert.doesNotMatch(tenkitCliRuntime, /Runtime Tenant/);
  assert.match(app, /Active Runtime Tenant/);
  assert.match(app, /Active Runtime Tenant ID/);
  assert.match(app, /globalStyles\.centeredContainer/);
  assert.doesNotMatch(app, /Runtime Tenant IDs/);
  assert.doesNotMatch(app, /resolveSelectableRuntimeTenants/);
  assert.match(settings, /Picker/);
  assert.match(settings, /Active Runtime Tenant/);
  assert.match(settings, /globalStyles\.container/);
  assert.doesNotMatch(settings, /swift-ui\/modifiers|scrollContentBackground/);
  assert.equal(await exists(join(targetDir, 'src/app/settings.tsx')), true);
  assert.equal(await exists(join(targetDir, 'src/app/explore.tsx')), false);
  assert.equal(await exists(join(targetDir, 'src/constants/design-tokens.ts')), true);
  assert.equal(await exists(join(targetDir, 'src/constants/globals.ts')), true);
  assert.equal(await exists(join(targetDir, 'src/constants/app-variant.ts')), true);
  assert.equal(await exists(join(targetDir, 'src/constants/app-variants.ts')), false);
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

async function main() {
  const setupType = parseSetupType(process.argv.slice(2));
  const packageRoot = resolve(fileURLToPath(import.meta.url), '..', '..');
  const workspaceRoot = resolve(packageRoot, '..', '..');
  const tempRoot = await fs.mkdtemp(join(tmpdir(), `tenkit-generated-${setupType}-`));
  const targetDir = join(tempRoot, 'app');

  try {
    await runGenerationProof({
      setupType,
      targetDir,
      git: 'init',
      workspaceRoot,
    });
    await configureTestGitIdentity(targetDir);
    await commitInitialGitSnapshot(targetDir);

    if (setupType === 'white-label-apps') {
      await verifyWhiteLabelApps(targetDir);
    } else {
      await verifySingleAppRuntimeTenants(targetDir);
    }

    await runGeneratedCommand(targetDir, 'pnpm', ['install']);
    await runGeneratedCommand(targetDir, 'pnpm', ['run', 'typecheck']);
    await runGeneratedCommand(targetDir, 'pnpm', ['expo:config']);

    console.log(`Verified generated ${setupType} Expo app.`);
  } finally {
    await fs.remove(tempRoot);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
