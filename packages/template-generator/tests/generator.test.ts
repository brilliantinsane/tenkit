/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { generateProject, generateWhiteLabelAppsProject } from '../src/generator';
import { getVirtualFile, mergeVirtualFileTrees } from '../src/virtual-file-tree';

function readVirtualFile(
  tree: ReturnType<typeof generateWhiteLabelAppsProject>,
  path: string,
): string {
  const file = getVirtualFile(tree, path);
  assert.ok(file, `Expected virtual file ${path}`);
  if (typeof file.contents !== 'string') {
    assert.fail(`Expected virtual file ${path} to be text`);
  }

  return file.contents;
}

function readVirtualBinary(
  tree: ReturnType<typeof generateWhiteLabelAppsProject>,
  path: string,
): Uint8Array {
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

test('White Label Apps Template combines shared, setup-owned, and App Variant asset output', () => {
  const tree = generateWhiteLabelAppsProject({
    setupType: 'white-label-apps',
    projectName: 'Custom White Label',
    packageName: 'custom-white-label',
  });
  const paths = tree.map((file) => file.path);
  const packageJson = JSON.parse(readVirtualFile(tree, 'package.json')) as {
    name: string;
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
  assert.equal(packageJson.dependencies.expo, '~56.0.12');
  assert.equal(packageJson.dependencies['expo-constants'], '~56.0.18');
  assert.equal(packageJson.dependencies['expo-dev-client'], '~56.0.19');
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
  assert.match(readVirtualFile(tree, 'README.md'), /A Tenkit White Label Apps project/);
  assert.match(readVirtualFile(tree, 'README.md'), /## Highlights/);
  assert.match(readVirtualFile(tree, 'README.md'), /## Get Started/);
  assert.match(readVirtualFile(tree, 'README.md'), /## Select an App Variant/);
  assert.match(readVirtualFile(tree, 'README.md'), /## Build Preparation/);
  assert.match(readVirtualFile(tree, 'README.md'), /## Run the Prepared App/);
  assert.match(readVirtualFile(tree, 'README.md'), /pnpm tenkit build/);
  assert.match(readVirtualFile(tree, 'README.md'), /EXPO_OWNER/);
  assert.match(readVirtualFile(tree, 'README.md'), /starts blank on purpose/);
  assert.ok(
    readVirtualFile(tree, 'README.md').indexOf('pnpm tenkit build') <
      readVirtualFile(tree, 'README.md').indexOf('pnpm ios'),
  );
  assert.match(readVirtualFile(tree, 'README.md'), /\.env\.example/);
  assert.match(readVirtualFile(tree, '.env.example'), /APP_VARIANT_SLUG=first-tenant/);
  assert.match(readVirtualFile(tree, '.env.example'), /\.env\.local/);
  assert.match(readVirtualFile(tree, 'eas.json'), /"developmentClient": true/);
  assert.match(readVirtualFile(tree, 'assets/_global/README.md'), /Global Assets/);
  assert.match(readVirtualFile(tree, 'pnpm-workspace.yaml'), /allowBuilds:\n  esbuild: true/);
  assert.doesNotMatch(readVirtualFile(tree, 'pnpm-workspace.yaml'), /unrs-resolver/);
  assert.match(readVirtualFile(tree, 'app.config.ts'), /APP_VARIANT_SLUG/);
  assert.match(readVirtualFile(tree, 'app.config.ts'), /resolveAppVariantConfig/);
  assert.doesNotMatch(readVirtualFile(tree, 'app.config.ts'), /sharedExpoConfig/);
  assert.match(readVirtualFile(tree, 'app.config.ts'), /favicon: `\$\{icons\}\/favicon\.png`/);
  assert.match(readVirtualFile(tree, 'app.config.ts'), /'expo-system-ui'/);
  assert.match(readVirtualFile(tree, 'app.config.ts'), /\.\/src\/constants\/project-config/);
  assert.doesNotMatch(readVirtualFile(tree, 'app.config.ts'), /appVariants: \[/);
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
  assert.doesNotMatch(readVirtualFile(tree, 'src/hooks/use-app-variant-config.ts'), /'id' in/);
  assert.match(
    readVirtualFile(tree, 'src/constants/app-variants.ts'),
    /satisfies readonly AppVariant\[\]/,
  );
  assert.match(readVirtualFile(tree, 'src/constants/app-variants.ts'), /bundleIdentifier/);
  assert.match(readVirtualFile(tree, 'src/constants/app-variants.ts'), /slug: 'first-tenant'/);
  assert.match(readVirtualFile(tree, 'src/constants/project-config.ts'), /EXPO_OWNER = ''/);
  assert.doesNotMatch(readVirtualFile(tree, 'src/constants/project-config.ts'), /brilliant-insane/);
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
  assert.doesNotMatch(readVirtualFile(tree, 'scripts/tenkit-cli.ts'), /command\('setup'\)/);
  assert.match(readVirtualFile(tree, 'scripts/tenkit-cli-core.ts'), /APP_VARIANT_ENVIRONMENTS/);
  assert.match(readVirtualFile(tree, 'scripts/tenkit-cli-runtime.ts'), /\.env\.local/);
  assert.match(readVirtualFile(tree, 'src/app/index.tsx'), /App Variant/);
  assert.doesNotMatch(
    paths.join('\n'),
    /active-setup|setup-types|^tenkit\/|^types\/|^constants\/|\.hbs$/,
  );
  assert.doesNotMatch(paths.join('\n'), /base-expo|templates\/assets/);
});

test('White Label Apps generated tree is standalone and does not import from the Playground', () => {
  const tree = generateProject({ setupType: 'white-label-apps' });
  const generatedSource = tree
    .map((file) => file.contents)
    .filter((contents): contents is string => typeof contents === 'string')
    .join('\n');

  assert.doesNotMatch(generatedSource, /apps\/playground/);
  assert.doesNotMatch(generatedSource, /from ['"].*playground/);
  assert.doesNotMatch(generatedSource, /defineWhiteLabelAppsSetup/);
  assert.doesNotMatch(generatedSource, /activeSetup|Active Setup/);
  assert.doesNotMatch(generatedSource, /setupType|Setup Type/);
  assert.doesNotMatch(tree.map((file) => file.path).join('\n'), /^tenkit\//m);
  assert.doesNotMatch(tree.map((file) => file.path).join('\n'), /LICENSE|\.hbs|base-expo/);
  assert.doesNotMatch(generatedSource, /single-app-runtime-tenants/);
  assert.doesNotMatch(generatedSource, /generic-with-standalone-app-variants/);
});
