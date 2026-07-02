/// <reference types="node" />

import { assert, test } from 'vitest';

import {
  generateGenericWithStandaloneAppVariantsProject,
  generateProject,
  generateSingleAppRuntimeTenantsProject,
  generateWhiteLabelAppsProject,
} from '../src/generator';
import {
  getVirtualFile,
  mergeVirtualFileTrees,
  type VirtualFileTree,
} from '../src/virtual-file-tree';

function readVirtualFile(tree: VirtualFileTree, path: string): string {
  const file = getVirtualFile(tree, path);
  assert.ok(file, `Expected virtual file ${path}`);
  if (typeof file.contents !== 'string') {
    assert.fail(`Expected virtual file ${path} to be text`);
  }

  return file.contents;
}

function readVirtualBinary(tree: VirtualFileTree, path: string): Uint8Array {
  const file = getVirtualFile(tree, path);
  assert.ok(file, `Expected virtual file ${path}`);
  assert.ok(file.contents instanceof Uint8Array, `Expected virtual file ${path} to be binary`);
  return file.contents;
}

test('White Label Apps Template generation is deterministic', () => {
  const first = generateWhiteLabelAppsProject({
    setupType: 'white-label-apps',
    projectName: 'Example App',
    packageName: 'example-app',
  });
  const second = generateWhiteLabelAppsProject({
    setupType: 'white-label-apps',
    projectName: 'Example App',
    packageName: 'example-app',
  });

  assert.deepEqual(first, second);
});

test('Template layer merge rejects duplicate output paths', () => {
  assert.throws(
    () =>
      mergeVirtualFileTrees(
        [{ path: 'src/theme/colors.ts', contents: 'shared\n' }],
        [{ path: 'src/theme/colors.ts', contents: 'white-label\n' }],
      ),
    /duplicate path/,
  );
});

test('generic Template generation dispatches by Setup Type', () => {
  assert.deepEqual(
    generateProject({ setupType: 'white-label-apps', projectName: 'Example App' }),
    generateWhiteLabelAppsProject({
      setupType: 'white-label-apps',
      projectName: 'Example App',
    }),
  );
  assert.deepEqual(
    generateProject({
      setupType: 'runtime-tenants',
      projectName: 'Example App',
    }),
    generateSingleAppRuntimeTenantsProject({
      setupType: 'runtime-tenants',
      projectName: 'Example App',
    }),
  );
  assert.deepEqual(
    generateProject({
      setupType: 'single-app-runtime-tenants',
      projectName: 'Example App',
    }),
    generateSingleAppRuntimeTenantsProject({
      setupType: 'single-app-runtime-tenants',
      projectName: 'Example App',
    }),
  );
  assert.deepEqual(
    generateProject({
      setupType: 'generic-standalone',
      projectName: 'Example App',
    }),
    generateGenericWithStandaloneAppVariantsProject({
      setupType: 'generic-standalone',
      projectName: 'Example App',
    }),
  );
  assert.deepEqual(
    generateProject({
      setupType: 'generic-with-standalone-app-variants',
      projectName: 'Example App',
    }),
    generateGenericWithStandaloneAppVariantsProject({
      setupType: 'generic-with-standalone-app-variants',
      projectName: 'Example App',
    }),
  );
});

test('generic Template generation rejects unsupported Setup Types', () => {
  assert.throws(
    () =>
      generateProject({
        setupType: 'unsupported-setup',
      } as unknown as Parameters<typeof generateProject>[0]),
    /Unsupported generated Setup Type "unsupported-setup".*public Setup slugs: white-label, runtime-tenants, generic-standalone; canonical Setup Type IDs: white-label-apps, single-app-runtime-tenants, generic-with-standalone-app-variants/,
  );
});

test('White Label Apps Template combines shared, setup-owned, and App Variant asset output', () => {
  const tree = generateWhiteLabelAppsProject({
    setupType: 'white-label-apps',
    projectName: 'Custom White Label',
    packageName: 'custom-white-label',
  });
  const paths = tree.map((file) => file.path);
  const packageJson = JSON.parse(readVirtualFile(tree, 'package.json')) as {
    name: string;
    packageManager?: string;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    scripts: Record<string, string>;
  };

  assert.ok(paths.includes('README.md'));
  assert.ok(paths.includes('.env.example'));
  assert.ok(paths.includes('eas.json'));
  assert.ok(paths.includes('app.config.ts'));
  assert.ok(paths.includes('AGENTS.md'));
  assert.ok(paths.includes('CLAUDE.md'));
  assert.ok(paths.includes('.claude/settings.json'));
  assert.ok(paths.includes('.vscode/settings.json'));
  assert.equal(paths.includes('LICENSE'), false);
  assert.ok(paths.includes('src/app/_layout.tsx'));
  assert.ok(paths.includes('src/app/index.tsx'));
  assert.ok(paths.includes('src/app/explore.tsx'));
  assert.ok(paths.includes('src/components/app-tabs.tsx'));
  assert.ok(paths.includes('src/components/app-tabs.web.tsx'));
  assert.ok(paths.includes('src/theme/ThemeContext.tsx'));
  assert.ok(paths.includes('src/constants/design-tokens.ts'));
  assert.ok(paths.includes('src/constants/globals.ts'));
  assert.ok(paths.includes('src/constants/project-config.ts'));
  assert.ok(paths.includes('src/types/app-variant.ts'));
  assert.ok(paths.includes('src/constants/app-variants.ts'));
  assert.ok(paths.includes('src/lib/resolve-app-variant-config.ts'));
  assert.ok(paths.includes('src/hooks/use-app-variant-config.ts'));
  assert.ok(paths.includes('scripts/tenkit-cli.ts'));
  assert.ok(paths.includes('scripts/tenkit-cli-core.ts'));
  assert.ok(paths.includes('scripts/tenkit-cli-runtime.ts'));
  assert.ok(paths.includes('assets/_global/README.md'));
  assert.ok(paths.includes('assets/first-tenant/icons/icon.png'));
  assert.ok(paths.includes('assets/first-tenant/icons/favicon.png'));
  assert.ok(paths.includes('assets/first-tenant/icons/android-icon-background.png'));
  assert.ok(paths.includes('assets/first-tenant/icons/android-icon-foreground.png'));
  assert.ok(paths.includes('assets/first-tenant/icons/android-icon-monochrome.png'));
  assert.ok(paths.includes('assets/first-tenant/icons/splash-icon-light.png'));
  assert.ok(paths.includes('assets/first-tenant/icons/splash-icon-dark.png'));
  assert.ok(paths.includes('assets/second-tenant/icons/icon.png'));
  assert.ok(paths.includes('assets/second-tenant/icons/favicon.png'));
  assert.ok(paths.includes('assets/second-tenant/icons/android-icon-background.png'));
  assert.ok(paths.includes('assets/second-tenant/icons/android-icon-foreground.png'));
  assert.ok(paths.includes('assets/second-tenant/icons/android-icon-monochrome.png'));
  assert.ok(paths.includes('assets/second-tenant/icons/splash-icon-light.png'));
  assert.ok(paths.includes('assets/second-tenant/icons/splash-icon-dark.png'));
  assert.ok(paths.includes('assets/first-tenant/app.icon/icon.json'));
  assert.ok(paths.includes('assets/second-tenant/app.icon/icon.json'));
  assert.equal(
    paths.some((path) => path.includes('.DS_Store')),
    false,
  );
  assert.equal(
    paths.some((path) => path.startsWith('assets/app/')),
    false,
  );
  assert.equal(readVirtualBinary(tree, 'assets/first-tenant/icons/icon.png').byteLength > 0, true);
  assert.equal(
    readVirtualBinary(tree, 'assets/first-tenant/icons/favicon.png').byteLength > 0,
    true,
  );
  assert.deepEqual(
    readVirtualBinary(tree, 'assets/first-tenant/icons/icon.png'),
    readVirtualBinary(tree, 'assets/second-tenant/icons/icon.png'),
  );
  assert.deepEqual(
    readVirtualBinary(tree, 'assets/first-tenant/icons/favicon.png'),
    readVirtualBinary(tree, 'assets/second-tenant/icons/favicon.png'),
  );
  assert.equal(packageJson.name, 'custom-white-label');
  assert.equal(packageJson.packageManager, undefined);
  assert.equal(packageJson.dependencies.expo, '~56.0.12');
  assert.equal(packageJson.dependencies['expo-constants'], '~56.0.18');
  assert.equal(packageJson.dependencies['expo-dev-client'], '~56.0.19');
  assert.equal(packageJson.dependencies['expo-linking'], '~56.0.14');
  assert.equal(packageJson.dependencies['expo-router'], '~56.2.11');
  assert.equal(packageJson.dependencies['expo-splash-screen'], '~56.0.10');
  assert.equal(packageJson.dependencies['expo-system-ui'], '~56.0.5');
  assert.equal(packageJson.devDependencies['@inquirer/prompts'], '^8.5.2');
  assert.equal(packageJson.devDependencies.commander, '^15.0.0');
  assert.equal(packageJson.scripts.tenkit, 'tsx scripts/tenkit-cli.ts');
  assert.equal(packageJson.scripts.android, 'expo run:android');
  assert.equal(packageJson.scripts.ios, 'expo run:ios');
  assert.equal(packageJson.scripts.web, 'expo start --web');
  assert.equal(packageJson.scripts['expo:config'], 'expo config --type public');
  assert.match(
    readVirtualFile(tree, 'src/theme/colors.ts'),
    /getSystemColor\('background', colorScheme\)/,
  );
  assert.match(readVirtualFile(tree, 'src/theme/colors.ts'), /background: '#000000'/);
  assert.match(readVirtualFile(tree, 'README.md'), /A Tenkit White Label Apps project/);
  assert.match(readVirtualFile(tree, 'README.md'), /## Highlights/);
  assert.match(readVirtualFile(tree, 'README.md'), /## Get Started/);
  assert.match(readVirtualFile(tree, 'README.md'), /## Select an App Variant/);
  assert.match(readVirtualFile(tree, 'README.md'), /## Build Preparation/);
  assert.match(readVirtualFile(tree, 'README.md'), /## Run the Prepared App/);
  assert.match(readVirtualFile(tree, 'README.md'), /pnpm run tenkit build/);
  assert.match(readVirtualFile(tree, 'README.md'), /EXPO_OWNER/);
  assert.match(readVirtualFile(tree, 'README.md'), /starts blank on purpose/);
  assert.ok(
    readVirtualFile(tree, 'README.md').indexOf('pnpm run tenkit build') <
      readVirtualFile(tree, 'README.md').indexOf('pnpm run ios'),
  );
  assert.match(readVirtualFile(tree, 'README.md'), /\.env\.example/);
  assert.match(readVirtualFile(tree, '.env.example'), /APP_VARIANT_SLUG=first-tenant/);
  assert.match(readVirtualFile(tree, '.env.example'), /\.env\.local/);
  assert.match(readVirtualFile(tree, 'eas.json'), /"developmentClient": true/);
  assert.match(readVirtualFile(tree, 'assets/_global/README.md'), /Global Assets/);
  assert.match(readVirtualFile(tree, 'pnpm-workspace.yaml'), /allowBuilds:\n  esbuild: true/);
  assert.notMatch(readVirtualFile(tree, 'pnpm-workspace.yaml'), /unrs-resolver/);
  assert.match(readVirtualFile(tree, 'app.config.ts'), /APP_VARIANT_SLUG/);
  assert.match(readVirtualFile(tree, 'app.config.ts'), /resolveAppVariantConfig/);
  assert.notMatch(readVirtualFile(tree, 'app.config.ts'), /sharedExpoConfig/);
  assert.match(readVirtualFile(tree, 'app.config.ts'), /favicon: `\$\{icons\}\/favicon\.png`/);
  assert.match(readVirtualFile(tree, 'app.config.ts'), /'expo-system-ui'/);
  assert.match(readVirtualFile(tree, 'app.config.ts'), /\.\/src\/constants\/project-config/);
  assert.notMatch(readVirtualFile(tree, 'app.config.ts'), /appVariants: \[/);
  assert.match(
    readVirtualFile(tree, 'app.config.ts'),
    /const assetPath = `\.\/assets\/\$\{slug\}`/,
  );
  assert.match(readVirtualFile(tree, 'app.config.ts'), /expo-splash-screen/);
  assert.match(readVirtualFile(tree, 'app.config.ts'), /splash-icon-light\.png/);
  assert.match(readVirtualFile(tree, 'app.config.ts'), /splash-icon-dark\.png/);
  assert.match(readVirtualFile(tree, 'src/types/app-variant.ts'), /export type AppVariant =/);
  assert.match(readVirtualFile(tree, 'src/types/app-variant.ts'), /appVariantId: AppVariantId/);
  assert.match(readVirtualFile(tree, 'src/types/app-variant.ts'), /AppVariantConfigExtra/);
  assert.match(
    readVirtualFile(tree, 'src/hooks/use-app-variant-config.ts'),
    /AppVariantConfigExtra/,
  );
  assert.notMatch(readVirtualFile(tree, 'src/hooks/use-app-variant-config.ts'), /'id' in/);
  assert.match(
    readVirtualFile(tree, 'src/constants/app-variants.ts'),
    /satisfies readonly AppVariant\[\]/,
  );
  assert.match(readVirtualFile(tree, 'src/constants/app-variants.ts'), /bundleIdentifier/);
  assert.match(readVirtualFile(tree, 'src/constants/app-variants.ts'), /slug: 'first-tenant'/);
  assert.match(readVirtualFile(tree, 'src/constants/project-config.ts'), /EXPO_OWNER = ''/);
  assert.match(readVirtualFile(tree, 'src/constants/design-tokens.ts'), /export const Typography/);
  assert.match(
    readVirtualFile(tree, 'src/components/themed-text.tsx'),
    /@\/constants\/design-tokens/,
  );
  assert.match(readVirtualFile(tree, 'src/components/themed-text.tsx'), /linkPrimary/);
  assert.match(readVirtualFile(tree, 'src/components/themed-view.tsx'), /type\?: ThemeColor/);
  assert.match(readVirtualFile(tree, 'src/constants/globals.ts'), /globalStyles/);
  assert.match(readVirtualFile(tree, 'src/app/index.tsx'), /globalStyles\.centeredContainer/);
  assert.match(readVirtualFile(tree, 'src/app/explore.tsx'), /globalStyles\.container/);
  assert.notMatch(readVirtualFile(tree, 'src/constants/project-config.ts'), /brilliant-insane/);
  assert.match(
    readVirtualFile(tree, 'src/lib/resolve-app-variant-config.ts'),
    /Missing required App Variant asset/,
  );
  assert.match(readVirtualFile(tree, 'src/lib/resolve-app-variant-config.ts'), /favicon\.png/);
  assert.match(
    readVirtualFile(tree, 'src/lib/resolve-app-variant-config.ts'),
    /android-icon-background\.png/,
  );
  assert.match(
    readVirtualFile(tree, 'src/lib/resolve-app-variant-config.ts'),
    /splash-icon-light\.png/,
  );
  assert.match(
    readVirtualFile(tree, 'src/lib/resolve-app-variant-config.ts'),
    /splash-icon-dark\.png/,
  );
  assert.match(readVirtualFile(tree, 'scripts/tenkit-cli.ts'), /command\('build'\)/);
  assert.match(readVirtualFile(tree, 'scripts/tenkit-cli.ts'), /command\('reset'\)/);
  assert.match(readVirtualFile(tree, 'scripts/tenkit-cli.ts'), /command\('doctor'\)/);
  assert.notMatch(readVirtualFile(tree, 'scripts/tenkit-cli.ts'), /command\('setup'\)/);
  assert.match(readVirtualFile(tree, 'scripts/tenkit-cli-core.ts'), /APP_VARIANT_ENVIRONMENTS/);
  assert.match(
    readVirtualFile(tree, 'scripts/tenkit-cli-core.ts'),
    /from '\.\.\/src\/constants\/app-variants'/,
  );
  assert.match(readVirtualFile(tree, 'scripts/tenkit-cli-runtime.ts'), /\.env\.local/);
  assert.notMatch(paths.join('\n'), /app-variant-targets/);
  assert.match(readVirtualFile(tree, 'src/app/index.tsx'), /App Variant/);
  assert.notMatch(
    paths.join('\n'),
    /active-setup|setup-types|^tenkit\/|^types\/|^constants\/|\.hbs$/,
  );
  assert.notMatch(paths.join('\n'), /base-expo|templates\/assets/);
});

test('White Label Apps Template serializes project names used inside TSX', () => {
  const tree = generateWhiteLabelAppsProject({
    setupType: 'white-label-apps',
    projectName: 'ACME <Pilot> {One}',
    packageName: 'acme-pilot',
  });
  const appTabs = readVirtualFile(tree, 'src/components/app-tabs.web.tsx');

  assert.match(appTabs, /const projectName = "ACME <Pilot> \{One\}";/);
  assert.match(
    appTabs,
    /<ThemedText type="smallBold" style=\{styles\.brandText\}>\n\s+\{projectName\}/,
  );
  assert.notMatch(appTabs, />\s*ACME <Pilot> \{One\}\s*</);
});

test('Template generation renders selected package manager into generated app output', () => {
  const bunTree = generateWhiteLabelAppsProject({
    setupType: 'white-label-apps',
    projectName: 'Bun App',
    packageName: 'bun-app',
    packageManager: 'bun',
  });
  const bunPackageJson = JSON.parse(readVirtualFile(bunTree, 'package.json')) as {
    packageManager?: string;
  };
  const bunPaths = bunTree.map((file) => file.path);

  assert.equal(bunPackageJson.packageManager, undefined);
  assert.equal(bunPaths.includes('pnpm-workspace.yaml'), false);
  assert.match(readVirtualFile(bunTree, 'README.md'), /bun install/);
  assert.match(readVirtualFile(bunTree, 'README.md'), /bun run tenkit build/);
  assert.match(readVirtualFile(bunTree, 'scripts/tenkit-cli-core.ts'), /bin: 'bun'/);
  assert.match(
    readVirtualFile(bunTree, 'scripts/tenkit-cli-core.ts'),
    /args: \['expo', \.\.\.args\]/,
  );

  const npmTree = generateGenericWithStandaloneAppVariantsProject({
    setupType: 'generic-with-standalone-app-variants',
    projectName: 'Npm App',
    packageName: 'npm-app',
    packageManager: 'npm',
  });

  assert.match(readVirtualFile(npmTree, 'README.md'), /npm run tenkit -- build/);
  assert.match(readVirtualFile(npmTree, 'scripts/tenkit-cli-core.ts'), /bin: 'npx'/);
});

test('White Label Apps generated tree is standalone and does not import from the Playground', () => {
  const tree = generateProject({ setupType: 'white-label-apps' });
  const generatedSource = tree
    .map((file) => file.contents)
    .filter((contents): contents is string => typeof contents === 'string')
    .join('\n');

  assert.notMatch(generatedSource, /apps\/playground/);
  assert.notMatch(generatedSource, /from ['"].*playground/);
  assert.notMatch(generatedSource, /defineWhiteLabelAppsSetup/);
  assert.notMatch(generatedSource, /activeSetup|Active Setup/);
  assert.notMatch(generatedSource, /setupType|Setup Type/);
  assert.notMatch(tree.map((file) => file.path).join('\n'), /^tenkit\//m);
  assert.notMatch(tree.map((file) => file.path).join('\n'), /LICENSE|\.hbs|base-expo/);
  assert.notMatch(generatedSource, /single-app-runtime-tenants/);
  assert.notMatch(generatedSource, /generic-with-standalone-app-variants/);
});

test('Single App Runtime Tenants Template generates one App Variant with bundled Runtime Tenants', () => {
  const tree = generateProject({
    setupType: 'single-app-runtime-tenants',
    projectName: 'Custom Runtime Tenants',
    packageName: 'custom-runtime-tenants',
  });
  const paths = tree.map((file) => file.path);
  const packageJson = JSON.parse(readVirtualFile(tree, 'package.json')) as {
    name: string;
    dependencies: Record<string, string>;
    scripts: Record<string, string>;
  };
  const appVariant = readVirtualFile(tree, 'src/constants/app-variant.ts');
  const runtimeTenants = readVirtualFile(tree, 'src/constants/runtime-tenants.ts');
  const runtimeTenantAccess = readVirtualFile(tree, 'src/lib/runtime-tenant-access.ts');
  const appVariantTypes = readVirtualFile(tree, 'src/types/app-variant.ts');
  const runtimeTenantTypes = readVirtualFile(tree, 'src/types/runtime-tenant.ts');
  const resolver = readVirtualFile(tree, 'src/lib/resolve-app-variant-config.ts');
  const appConfig = readVirtualFile(tree, 'app.config.ts');
  const appVariantHook = readVirtualFile(tree, 'src/hooks/use-app-variant-config.ts');
  const activeRuntimeTenantHook = readVirtualFile(tree, 'src/hooks/use-active-runtime-tenant.ts');
  const themedText = readVirtualFile(tree, 'src/components/themed-text.tsx');
  const themedView = readVirtualFile(tree, 'src/components/themed-view.tsx');
  const app = readVirtualFile(tree, 'src/app/index.tsx');
  const settings = readVirtualFile(tree, 'src/app/settings.tsx');
  const readme = readVirtualFile(tree, 'README.md');
  const tenkitCliCore = readVirtualFile(tree, 'scripts/tenkit-cli-core.ts');
  const tenkitCliRuntime = readVirtualFile(tree, 'scripts/tenkit-cli-runtime.ts');

  assert.equal(packageJson.name, 'custom-runtime-tenants');
  assert.equal(packageJson.dependencies['@expo/ui'], '~56.0.16');
  assert.equal(packageJson.dependencies['react-native-mmkv'], '^4.3.1');
  assert.equal(packageJson.dependencies['react-native-nitro-modules'], '^0.35.9');
  assert.equal(packageJson.scripts.tenkit, 'tsx scripts/tenkit-cli.ts');
  assert.ok(paths.includes('src/app/settings.tsx'));
  assert.equal(paths.includes('src/app/explore.tsx'), false);
  assert.ok(paths.includes('src/constants/design-tokens.ts'));
  assert.ok(paths.includes('src/constants/runtime-tenants.ts'));
  assert.ok(paths.includes('src/constants/globals.ts'));
  assert.ok(paths.includes('src/hooks/use-active-runtime-tenant.ts'));
  assert.ok(paths.includes('src/lib/runtime-tenant-access.ts'));
  assert.ok(paths.includes('src/storage/app-preferences.ts'));
  assert.ok(paths.includes('src/types/runtime-tenant.ts'));
  assert.ok(paths.includes('assets/acme-app/icons/icon.png'));
  assert.ok(paths.includes('assets/acme-app/icons/favicon.png'));
  assert.ok(paths.includes('assets/acme-app/icons/android-icon-background.png'));
  assert.ok(paths.includes('assets/acme-app/icons/android-icon-foreground.png'));
  assert.ok(paths.includes('assets/acme-app/icons/android-icon-monochrome.png'));
  assert.ok(paths.includes('assets/acme-app/icons/splash-icon-light.png'));
  assert.ok(paths.includes('assets/acme-app/icons/splash-icon-dark.png'));
  assert.ok(paths.includes('assets/acme-app/app.icon/icon.json'));
  assert.equal(
    paths.some((path) => path.startsWith('assets/first-tenant/')),
    false,
  );
  assert.equal(
    paths.some((path) => path.startsWith('assets/second-tenant/')),
    false,
  );
  assert.equal(readVirtualBinary(tree, 'assets/acme-app/icons/icon.png').byteLength > 0, true);
  assert.match(readVirtualFile(tree, '.env.example'), /APP_VARIANT_SLUG=acme-app/);
  assert.match(readVirtualFile(tree, 'src/constants/design-tokens.ts'), /export const Typography/);
  assert.match(readVirtualFile(tree, 'src/constants/globals.ts'), /globalStyles/);
  assert.ok(paths.includes('src/constants/app-variant.ts'));
  assert.equal(paths.includes('src/constants/app-variants.ts'), false);
  assert.match(appVariant, /export const appVariant =/);
  assert.match(appVariant, /slug: 'acme-app'/);
  assert.match(appVariant, /name: 'Acme App'/);
  assert.match(appVariant, /runtimeTenantAccess/);
  assert.match(appVariant, /allowedRuntimeTenantIds: \[100, 101, 102\]/);
  assert.notMatch(appVariant, /appVariants|defaultAppVariantId|selectionMode/);
  assert.match(tenkitCliCore, /from '\.\.\/src\/constants\/app-variant'/);
  assert.match(tenkitCliCore, /Expected: \$\{appVariant\.slug\}/);
  assert.notMatch(tenkitCliCore, /defaultAppVariantId|appVariants\?: readonly AppVariant\[\]/);
  assert.match(tenkitCliRuntime, /from '\.\.\/src\/constants\/app-variant'/);
  assert.notMatch(tenkitCliRuntime, /Select an App Variant:|appVariants/);
  assert.match(runtimeTenants, /runtimeTenantId: 100/);
  assert.match(runtimeTenants, /name: 'North Branch'/);
  assert.match(runtimeTenants, /satisfies readonly RuntimeTenant\[\]/);
  assert.match(runtimeTenantTypes, /export type RuntimeTenant =/);
  assert.match(runtimeTenantAccess, /resolveDefaultRuntimeTenant/);
  assert.match(runtimeTenantAccess, /resolveSelectableRuntimeTenants/);
  assert.match(runtimeTenantAccess, /normalizeCapabilityProfile/);
  assert.match(runtimeTenantAccess, /Duplicate Runtime Tenant ID/);
  assert.match(appVariantTypes, /runtimeTenantAccess: RuntimeTenantAccess/);
  assert.match(resolver, /validateRuntimeTenantAccess/);
  assert.match(resolver, /const extra: ResolvedAppVariantConfig\['extra'\]/);
  assert.match(resolver, /runtimeTenantAccess,/);
  assert.notMatch(resolver, /runtimeTenants:/);
  assert.match(appConfig, /APP_VARIANT_SLUG/);
  assert.match(appConfig, /resolveAppVariantConfig/);
  assert.notMatch(appVariantHook, /isAppVariantConfigExtra/);
  assert.match(appVariantHook, /Constants\.expoConfig\?\.extra as AppVariantConfigExtra/);
  assert.match(appVariantHook, /runtimeTenantAccess/);
  assert.match(themedText, /@\/constants\/design-tokens/);
  assert.match(themedText, /linkPrimary/);
  assert.match(themedView, /type\?: ThemeColor/);
  assert.match(activeRuntimeTenantHook, /useActiveRuntimeTenant/);
  assert.match(activeRuntimeTenantHook, /useMMKVNumber/);
  assert.match(activeRuntimeTenantHook, /ACTIVE_RUNTIME_TENANT_ID_KEY/);
  assert.match(activeRuntimeTenantHook, /resolveSelectableRuntimeTenants/);
  assert.match(
    activeRuntimeTenantHook,
    /hasRuntimeTenantSelection: allowedRuntimeTenantIds\.length > 1/,
  );
  assert.notMatch(activeRuntimeTenantHook, /selectionMode/);
  assert.match(readVirtualFile(tree, 'src/storage/app-preferences.ts'), /createMMKV/);
  assert.match(app, /Active Runtime Tenant/);
  assert.match(app, /Active Runtime Tenant ID/);
  assert.match(app, /globalStyles\.centeredContainer/);
  assert.notMatch(app, /Runtime Tenant IDs/);
  assert.notMatch(app, /resolveSelectableRuntimeTenants/);
  assert.match(settings, /Picker/);
  assert.match(settings, /Active Runtime Tenant/);
  assert.match(settings, /globalStyles\.container/);
  assert.notMatch(settings, /swift-ui\/modifiers|scrollContentBackground/);
  assert.match(readme, /Single App Runtime Tenants project/);
  assert.match(readme, /Runtime Tenant records live in generated source data/);
});

test('Single App Runtime Tenants generated tree is standalone selected output', () => {
  const tree = generateProject({ setupType: 'single-app-runtime-tenants' });
  const generatedSource = tree
    .map((file) => file.contents)
    .filter((contents): contents is string => typeof contents === 'string')
    .join('\n');

  assert.notMatch(generatedSource, /apps\/playground/);
  assert.notMatch(generatedSource, /from ['"].*playground/);
  assert.notMatch(generatedSource, /defineSingleAppRuntimeTenantsSetup/);
  assert.notMatch(generatedSource, /activeSetup|Active Setup/);
  assert.notMatch(generatedSource, /setupType|Setup Type/);
  assert.notMatch(tree.map((file) => file.path).join('\n'), /^tenkit\//m);
  assert.notMatch(tree.map((file) => file.path).join('\n'), /LICENSE|\.hbs|base-expo/);
  assert.notMatch(generatedSource, /generic-with-standalone-app-variants/);
});

test('Generic With Standalone App Variants Template generates App Variant assets and Runtime Tenant access', () => {
  const tree = generateProject({
    setupType: 'generic-with-standalone-app-variants',
    projectName: 'Custom Generic App',
    packageName: 'custom-generic-app',
  });
  const paths = tree.map((file) => file.path);
  const packageJson = JSON.parse(readVirtualFile(tree, 'package.json')) as {
    name: string;
    dependencies: Record<string, string>;
    scripts: Record<string, string>;
  };
  const appVariants = readVirtualFile(tree, 'src/constants/app-variants.ts');
  const runtimeTenants = readVirtualFile(tree, 'src/constants/runtime-tenants.ts');
  const runtimeTenantAccess = readVirtualFile(tree, 'src/lib/runtime-tenant-access.ts');
  const appVariantTypes = readVirtualFile(tree, 'src/types/app-variant.ts');
  const resolver = readVirtualFile(tree, 'src/lib/resolve-app-variant-config.ts');
  const appConfig = readVirtualFile(tree, 'app.config.ts');
  const activeRuntimeTenantHook = readVirtualFile(tree, 'src/hooks/use-active-runtime-tenant.ts');
  const tenkitCli = readVirtualFile(tree, 'scripts/tenkit-cli.ts');
  const tenkitCliCore = readVirtualFile(tree, 'scripts/tenkit-cli-core.ts');
  const tenkitCliRuntime = readVirtualFile(tree, 'scripts/tenkit-cli-runtime.ts');
  const readme = readVirtualFile(tree, 'README.md');

  assert.equal(packageJson.name, 'custom-generic-app');
  assert.equal(packageJson.dependencies['@expo/ui'], '~56.0.16');
  assert.equal(packageJson.dependencies['react-native-mmkv'], '^4.3.1');
  assert.equal(packageJson.scripts.tenkit, 'tsx scripts/tenkit-cli.ts');
  assert.ok(paths.includes('src/app/settings.tsx'));
  assert.ok(paths.includes('src/constants/app-variants.ts'));
  assert.equal(paths.includes('src/constants/app-variant.ts'), false);
  assert.ok(paths.includes('src/constants/runtime-tenants.ts'));
  assert.ok(paths.includes('src/lib/runtime-tenant-access.ts'));
  assert.ok(paths.includes('assets/atlas-network/icons/icon.png'));
  assert.ok(paths.includes('assets/west-studio/icons/icon.png'));
  assert.ok(paths.includes('assets/atlas-network/app.icon/icon.json'));
  assert.ok(paths.includes('assets/west-studio/app.icon/icon.json'));
  assert.equal(
    paths.some((path) => path.startsWith('assets/north-studio/')),
    false,
  );
  assert.equal(
    paths.some((path) => path.startsWith('assets/south-studio/')),
    false,
  );
  assert.equal(
    paths.some((path) => path.startsWith('assets/east-studio/')),
    false,
  );
  assert.equal(readVirtualBinary(tree, 'assets/atlas-network/icons/icon.png').byteLength > 0, true);
  assert.deepEqual(
    readVirtualBinary(tree, 'assets/atlas-network/icons/icon.png'),
    readVirtualBinary(tree, 'assets/west-studio/icons/icon.png'),
  );
  assert.match(readVirtualFile(tree, '.env.example'), /APP_VARIANT_SLUG=atlas-network/);
  assert.match(appVariants, /role: 'generic'/);
  assert.match(appVariants, /slug: 'atlas-network'/);
  assert.match(appVariants, /name: 'Atlas Network'/);
  assert.match(appVariants, /role: 'standalone'/);
  assert.match(appVariants, /slug: 'west-studio'/);
  assert.match(appVariants, /name: 'West Studio'/);
  assert.match(appVariants, /standaloneRuntimeTenantId: 103/);
  assert.match(appVariants, /allowedRuntimeTenantIds: \[100, 101, 102\]/);
  assert.match(runtimeTenants, /name: 'North Studio'/);
  assert.match(runtimeTenants, /name: 'South Studio'/);
  assert.match(runtimeTenants, /name: 'East Studio'/);
  assert.match(runtimeTenants, /name: 'West Studio'/);
  assert.match(appVariantTypes, /export type GenericAppVariant/);
  assert.match(appVariantTypes, /export type StandaloneAppVariant/);
  assert.match(resolver, /runtimeTenantAccess: resolvedAppVariant\.runtimeTenantAccess/);
  assert.match(
    resolver,
    /standaloneRuntimeTenantId: resolvedAppVariant\.standaloneRuntimeTenantId/,
  );
  assert.notMatch(resolver, /runtimeTenants:/);
  assert.match(appConfig, /APP_VARIANT_SLUG/);
  assert.match(runtimeTenantAccess, /Duplicate Runtime Tenant ID/);
  assert.match(runtimeTenantAccess, /validateGenericAppVariantCount/);
  assert.match(runtimeTenantAccess, /genericAppVariants\.length !== 1/);
  assert.match(runtimeTenantAccess, /must include exactly one Generic App Variant/);
  assert.match(runtimeTenantAccess, /Duplicate standalone Runtime Tenant assignment/);
  assert.match(runtimeTenantAccess, /must not appear in Generic App Variant Runtime Tenant Access/);
  assert.match(resolver, /duplicateAppVariantId !== undefined/);
  assert.match(activeRuntimeTenantHook, /appVariant\.role === 'standalone'/);
  assert.match(
    activeRuntimeTenantHook,
    /hasRuntimeTenantSelection: appVariant\.role === 'generic'/,
  );
  assert.match(tenkitCli, /command\('build'\)/);
  assert.match(tenkitCli, /command\('reset'\)/);
  assert.match(tenkitCli, /command\('doctor'\)/);
  assert.notMatch(tenkitCli, /command\('setup'\)/);
  assert.match(tenkitCliCore, /APP_VARIANT_ENVIRONMENTS/);
  assert.match(tenkitCliCore, /from '\.\.\/src\/constants\/app-variants'/);
  assert.match(tenkitCliRuntime, /Select an App Variant:/);
  assert.notMatch(tenkitCliRuntime, /Runtime Tenant/);
  assert.notMatch(paths.join('\n'), /app-variant-targets/);
  assert.match(readme, /third proof Template/);
  assert.match(readme, /Public CLI create flow/);
  assert.match(readme, /APP_VARIANT_SLUG=atlas-network/);
  assert.match(readme, /APP_VARIANT_SLUG=west-studio/);
  assert.match(readme, /Atlas Network App Variant's EAS environment/);
  assert.match(readme, /West Studio App Variant's EAS environment/);
  assert.notMatch(readme, /public create entrypoint|web builder|publishing/);
});

test('Generic With Standalone App Variants generated tree is standalone selected output', () => {
  const tree = generateProject({ setupType: 'generic-with-standalone-app-variants' });
  const generatedSource = tree
    .map((file) => file.contents)
    .filter((contents): contents is string => typeof contents === 'string')
    .join('\n');

  assert.notMatch(generatedSource, /apps\/playground/);
  assert.notMatch(generatedSource, /from ['"].*playground/);
  assert.notMatch(generatedSource, /defineGenericAppSetup/);
  assert.notMatch(generatedSource, /activeSetup|Active Setup/);
  assert.notMatch(generatedSource, /setupType|Setup Type/);
  assert.notMatch(tree.map((file) => file.path).join('\n'), /^tenkit\//m);
  assert.notMatch(tree.map((file) => file.path).join('\n'), /LICENSE|\.hbs|base-expo/);
});
