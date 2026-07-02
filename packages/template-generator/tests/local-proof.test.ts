/// <reference types="node" />

import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { assert, expect, test } from 'vitest';

import fs from 'fs-extra';
import { join } from 'pathe';

import {
  commitInitialGitSnapshot,
  runGenerationProof,
  runWhiteLabelGenerationProof,
} from '../src/local-proof';
import { verifyGeneratedAppShape } from './generated-app-verifiers';

const execFileAsync = promisify(execFile);

type PackageJson = {
  name?: string;
  private?: boolean;
  scripts?: Record<string, string>;
};

async function exists(path: string): Promise<boolean> {
  return fs.pathExists(path);
}

async function readGitStatus(cwd: string): Promise<string> {
  const { stdout } = await execFileAsync('git', ['status', '--short'], { cwd });
  return stdout;
}

async function configureTestGitIdentity(cwd: string): Promise<void> {
  await execFileAsync('git', ['config', 'user.name', 'Tenkit Test'], { cwd });
  await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd });
}

test('local proof command boundary generates a White Label Apps Expo app in a separate folder', async () => {
  const tempRoot = await fs.mkdtemp(join(tmpdir(), 'tenkit-template-proof-'));
  const targetDir = join(tempRoot, 'generated-app');
  const workspaceRoot = join(tempRoot, 'tenkit-workspace');

  try {
    const result = await runWhiteLabelGenerationProof({
      targetDir,
      git: 'init',
      workspaceRoot,
    });
    await configureTestGitIdentity(targetDir);
    await commitInitialGitSnapshot(targetDir);
    await verifyGeneratedAppShape('white-label-apps', targetDir);
    const packageJson = JSON.parse(
      await fs.readFile(join(targetDir, 'package.json'), 'utf8'),
    ) as PackageJson;
    const readme = await fs.readFile(join(targetDir, 'README.md'), 'utf8');
    const envExample = await fs.readFile(join(targetDir, '.env.example'), 'utf8');
    const easJson = await fs.readFile(join(targetDir, 'eas.json'), 'utf8');
    const appConfig = await fs.readFile(join(targetDir, 'app.config.ts'), 'utf8');
    const designTokens = await fs.readFile(
      join(targetDir, 'src/constants/design-tokens.ts'),
      'utf8',
    );
    const globals = await fs.readFile(join(targetDir, 'src/constants/globals.ts'), 'utf8');
    const appVariantTypes = await fs.readFile(join(targetDir, 'src/types/app-variant.ts'), 'utf8');
    const appVariants = await fs.readFile(join(targetDir, 'src/constants/app-variants.ts'), 'utf8');
    const projectConfig = await fs.readFile(
      join(targetDir, 'src/constants/project-config.ts'),
      'utf8',
    );
    const appVariantHook = await fs.readFile(
      join(targetDir, 'src/hooks/use-app-variant-config.ts'),
      'utf8',
    );
    const resolver = await fs.readFile(
      join(targetDir, 'src/lib/resolve-app-variant-config.ts'),
      'utf8',
    );
    const tenkitCli = await fs.readFile(join(targetDir, 'scripts/tenkit-cli.ts'), 'utf8');
    const tenkitCliRuntime = await fs.readFile(
      join(targetDir, 'scripts/tenkit-cli-runtime.ts'),
      'utf8',
    );
    const app = await fs.readFile(join(targetDir, 'src/app/index.tsx'), 'utf8');
    const pnpmWorkspace = await fs.readFile(join(targetDir, 'pnpm-workspace.yaml'), 'utf8');

    assert.ok(result.filesWritten.includes('package.json'));
    assert.equal(result.gitInitialized, true);
    assert.equal(result.gitCommitted, false);
    assert.equal(result.gitSkippedBecauseTargetWasNotEmpty, false);
    assert.equal(packageJson.name, 'tenkit-white-label-app');
    assert.equal(packageJson.private, true);
    assert.equal(packageJson.scripts?.start, 'expo start');
    assert.equal(packageJson.scripts?.tenkit, 'tsx scripts/tenkit-cli.ts');
    assert.equal(packageJson.scripts?.android, 'expo run:android');
    assert.equal(packageJson.scripts?.ios, 'expo run:ios');
    assert.equal(packageJson.scripts?.typecheck, 'tsc --noEmit --pretty false');
    assert.match(readme, /## Highlights/);
    assert.match(readme, /## Get Started/);
    assert.match(readme, /## Select an App Variant/);
    assert.match(readme, /## Build Preparation/);
    assert.match(readme, /## Run the Prepared App/);
    assert.match(readme, /pnpm run tenkit build/);
    assert.match(readme, /EXPO_OWNER/);
    assert.match(readme, /starts blank on purpose/);
    assert.ok(readme.indexOf('pnpm run tenkit build') < readme.indexOf('pnpm run ios'));
    assert.match(readme, /\.env\.example/);
    assert.match(envExample, /APP_VARIANT_SLUG=first-tenant/);
    assert.match(envExample, /\.env\.local/);
    assert.match(easJson, /"developmentClient": true/);
    assert.match(appConfig, /resolveAppVariantConfig/);
    assert.notMatch(appConfig, /sharedExpoConfig/);
    assert.match(appConfig, /favicon: `\$\{icons\}\/favicon\.png`/);
    assert.match(appConfig, /'expo-system-ui'/);
    assert.match(appConfig, /APP_VARIANT_SLUG/);
    assert.match(appConfig, /\.\/src\/constants\/project-config/);
    assert.notMatch(appConfig, /appVariants: \[/);
    assert.match(appConfig, /const assetPath = `\.\/assets\/\$\{slug\}`/);
    assert.match(appConfig, /expo-splash-screen/);
    assert.match(appConfig, /splash-icon-light\.png/);
    assert.match(appConfig, /splash-icon-dark\.png/);
    assert.match(appVariantTypes, /export type AppVariant =/);
    assert.match(appVariantTypes, /appVariantId: AppVariantId/);
    assert.match(appVariantTypes, /AppVariantConfigExtra/);
    assert.match(appVariantHook, /AppVariantConfigExtra/);
    assert.notMatch(appVariantHook, /'id' in/);
    assert.match(projectConfig, /EXPO_OWNER = ''/);
    assert.match(designTokens, /export const Typography/);
    assert.match(globals, /globalStyles/);
    assert.notMatch(projectConfig, /brilliant-insane/);
    assert.match(appVariants, /satisfies readonly AppVariant\[\]/);
    assert.match(appVariants, /slug: 'first-tenant'/);
    assert.match(appVariants, /bundleIdentifier/);
    assert.match(resolver, /Missing required App Variant asset/);
    assert.match(resolver, /favicon\.png/);
    assert.match(resolver, /splash-icon-light\.png/);
    assert.match(resolver, /splash-icon-dark\.png/);
    assert.match(tenkitCli, /command\('build'\)/);
    assert.match(tenkitCli, /command\('reset'\)/);
    assert.match(tenkitCli, /command\('doctor'\)/);
    assert.notMatch(tenkitCli, /command\('setup'\)/);
    assert.match(tenkitCliRuntime, /\.env\.local/);
    assert.match(app, /App Variant/);
    assert.match(pnpmWorkspace, /allowBuilds:\n  esbuild: true/);
    assert.notMatch(pnpmWorkspace, /unrs-resolver/);
    assert.ok(result.filesWritten.includes('src/app/_layout.tsx'));
    assert.ok(result.filesWritten.includes('src/app/explore.tsx'));
    assert.ok(result.filesWritten.includes('src/constants/design-tokens.ts'));
    assert.ok(result.filesWritten.includes('src/constants/globals.ts'));
    assert.ok(result.filesWritten.includes('src/types/app-variant.ts'));
    assert.ok(result.filesWritten.includes('src/constants/app-variants.ts'));
    assert.ok(result.filesWritten.includes('src/constants/project-config.ts'));
    assert.ok(result.filesWritten.includes('src/lib/resolve-app-variant-config.ts'));
    assert.ok(result.filesWritten.includes('AGENTS.md'));
    assert.ok(result.filesWritten.includes('.env.example'));
    assert.ok(result.filesWritten.includes('CLAUDE.md'));
    assert.ok(result.filesWritten.includes('README.md'));
    assert.ok(result.filesWritten.includes('eas.json'));
    assert.ok(result.filesWritten.includes('.claude/settings.json'));
    assert.ok(result.filesWritten.includes('.vscode/settings.json'));
    assert.equal(result.filesWritten.includes('LICENSE'), false);
    assert.ok(result.filesWritten.includes('assets/_global/README.md'));
    assert.ok(result.filesWritten.includes('scripts/tenkit-cli.ts'));
    assert.ok(result.filesWritten.includes('scripts/tenkit-cli-core.ts'));
    assert.ok(result.filesWritten.includes('scripts/tenkit-cli-runtime.ts'));
    assert.equal(result.filesWritten.includes('scripts/tenkit-cli-app-variant-targets.ts'), false);
    assert.ok(result.filesWritten.includes('assets/first-tenant/icons/icon.png'));
    assert.ok(result.filesWritten.includes('assets/first-tenant/icons/favicon.png'));
    assert.ok(
      result.filesWritten.includes('assets/first-tenant/icons/android-icon-background.png'),
    );
    assert.ok(
      result.filesWritten.includes('assets/first-tenant/icons/android-icon-foreground.png'),
    );
    assert.ok(
      result.filesWritten.includes('assets/first-tenant/icons/android-icon-monochrome.png'),
    );
    assert.ok(result.filesWritten.includes('assets/first-tenant/icons/splash-icon-light.png'));
    assert.ok(result.filesWritten.includes('assets/first-tenant/icons/splash-icon-dark.png'));
    assert.ok(result.filesWritten.includes('assets/second-tenant/icons/icon.png'));
    assert.ok(result.filesWritten.includes('assets/second-tenant/icons/favicon.png'));
    assert.ok(
      result.filesWritten.includes('assets/second-tenant/icons/android-icon-background.png'),
    );
    assert.ok(
      result.filesWritten.includes('assets/second-tenant/icons/android-icon-foreground.png'),
    );
    assert.ok(
      result.filesWritten.includes('assets/second-tenant/icons/android-icon-monochrome.png'),
    );
    assert.ok(result.filesWritten.includes('assets/second-tenant/icons/splash-icon-light.png'));
    assert.ok(result.filesWritten.includes('assets/second-tenant/icons/splash-icon-dark.png'));
    assert.equal(
      result.filesWritten.some((filePath) => filePath.includes('.DS_Store')),
      false,
    );
    assert.equal(
      result.filesWritten.some((filePath) =>
        /active-setup|setup-types|^tenkit\/|^types\/|^constants\/|^assets\/app\/|\.hbs$|base-expo|templates\/assets/.test(
          filePath,
        ),
      ),
      false,
    );
    assert.equal(await exists(join(targetDir, '.git/HEAD')), true);
    assert.equal(await readGitStatus(targetDir), '');
    assert.equal(await exists(join(workspaceRoot, 'package.json')), false);
  } finally {
    await fs.remove(tempRoot);
  }
});

test('local proof command boundary generates Single App Runtime Tenants by Setup Type', async () => {
  const tempRoot = await fs.mkdtemp(join(tmpdir(), 'tenkit-template-proof-'));
  const targetDir = join(tempRoot, 'generated-app');
  const workspaceRoot = join(tempRoot, 'tenkit-workspace');

  try {
    const result = await runGenerationProof({
      setupType: 'single-app-runtime-tenants',
      targetDir,
      git: 'init',
      workspaceRoot,
    });
    await verifyGeneratedAppShape('single-app-runtime-tenants', targetDir);
    const packageJson = JSON.parse(
      await fs.readFile(join(targetDir, 'package.json'), 'utf8'),
    ) as PackageJson;
    const appVariant = await fs.readFile(join(targetDir, 'src/constants/app-variant.ts'), 'utf8');
    const runtimeTenants = await fs.readFile(
      join(targetDir, 'src/constants/runtime-tenants.ts'),
      'utf8',
    );
    const resolver = await fs.readFile(
      join(targetDir, 'src/lib/resolve-app-variant-config.ts'),
      'utf8',
    );
    const tenkitCli = await fs.readFile(join(targetDir, 'scripts/tenkit-cli.ts'), 'utf8');
    const tenkitCliCore = await fs.readFile(join(targetDir, 'scripts/tenkit-cli-core.ts'), 'utf8');
    const tenkitCliRuntime = await fs.readFile(
      join(targetDir, 'scripts/tenkit-cli-runtime.ts'),
      'utf8',
    );

    assert.ok(result.filesWritten.includes('package.json'));
    assert.equal(result.gitInitialized, true);
    assert.equal(result.gitCommitted, false);
    assert.equal(packageJson.name, 'tenkit-runtime-tenants');
    assert.equal(packageJson.scripts?.tenkit, 'tsx scripts/tenkit-cli.ts');
    assert.match(appVariant, /export const appVariant =/);
    assert.match(appVariant, /slug: 'acme-app'/);
    assert.match(appVariant, /runtimeTenantAccess/);
    assert.notMatch(appVariant, /appVariants|defaultAppVariantId|selectionMode/);
    assert.match(runtimeTenants, /runtimeTenantId: 100/);
    assert.match(resolver, /validateRuntimeTenantAccess/);
    assert.match(resolver, /const extra: ResolvedAppVariantConfig\['extra'\]/);
    assert.match(resolver, /runtimeTenantAccess,/);
    assert.notMatch(resolver, /runtimeTenants:/);
    assert.match(tenkitCli, /command\('build'\)/);
    assert.match(tenkitCli, /command\('reset'\)/);
    assert.match(tenkitCli, /command\('doctor'\)/);
    assert.notMatch(tenkitCli, /command\('setup'\)/);
    assert.match(tenkitCliCore, /from '\.\.\/src\/constants\/app-variant'/);
    assert.match(tenkitCliCore, /Expected: \$\{appVariant\.slug\}/);
    assert.notMatch(tenkitCliCore, /defaultAppVariantId|appVariants\?: readonly AppVariant\[\]/);
    assert.notMatch(tenkitCliRuntime, /Runtime Tenant/);
    assert.notMatch(
      tenkitCliRuntime,
      /shouldPromptForAppVariant|Select an App Variant:|appVariants/,
    );
    assert.ok(result.filesWritten.includes('src/app/settings.tsx'));
    assert.equal(result.filesWritten.includes('src/app/explore.tsx'), false);
    assert.ok(result.filesWritten.includes('src/constants/design-tokens.ts'));
    assert.ok(result.filesWritten.includes('src/constants/globals.ts'));
    assert.ok(result.filesWritten.includes('src/constants/app-variant.ts'));
    assert.equal(result.filesWritten.includes('src/constants/app-variants.ts'), false);
    assert.equal(result.filesWritten.includes('src/constants/app-variant-targets.ts'), false);
    assert.equal(result.filesWritten.includes('scripts/tenkit-cli-app-variant-targets.ts'), false);
    assert.ok(result.filesWritten.includes('src/hooks/use-active-runtime-tenant.ts'));
    assert.ok(result.filesWritten.includes('src/storage/app-preferences.ts'));
    assert.ok(result.filesWritten.includes('assets/acme-app/icons/icon.png'));
    assert.equal(result.filesWritten.includes('assets/first-tenant/icons/icon.png'), false);
    assert.equal(result.filesWritten.includes('assets/second-tenant/icons/icon.png'), false);
    assert.equal(await exists(join(targetDir, '.git/HEAD')), true);
    assert.equal(await exists(join(workspaceRoot, 'package.json')), false);
  } finally {
    await fs.remove(tempRoot);
  }
});

test('local proof command boundary generates Generic With Standalone App Variants by Setup Type', async () => {
  const tempRoot = await fs.mkdtemp(join(tmpdir(), 'tenkit-template-proof-'));
  const targetDir = join(tempRoot, 'generated-app');
  const workspaceRoot = join(tempRoot, 'tenkit-workspace');

  try {
    const result = await runGenerationProof({
      setupType: 'generic-with-standalone-app-variants',
      targetDir,
      git: 'init',
      workspaceRoot,
    });
    await verifyGeneratedAppShape('generic-with-standalone-app-variants', targetDir);
    const packageJson = JSON.parse(
      await fs.readFile(join(targetDir, 'package.json'), 'utf8'),
    ) as PackageJson;
    const appVariants = await fs.readFile(join(targetDir, 'src/constants/app-variants.ts'), 'utf8');
    const runtimeTenants = await fs.readFile(
      join(targetDir, 'src/constants/runtime-tenants.ts'),
      'utf8',
    );
    const resolver = await fs.readFile(
      join(targetDir, 'src/lib/resolve-app-variant-config.ts'),
      'utf8',
    );
    const runtimeTenantAccess = await fs.readFile(
      join(targetDir, 'src/lib/runtime-tenant-access.ts'),
      'utf8',
    );
    const tenkitCli = await fs.readFile(join(targetDir, 'scripts/tenkit-cli.ts'), 'utf8');
    const tenkitCliCore = await fs.readFile(join(targetDir, 'scripts/tenkit-cli-core.ts'), 'utf8');
    const tenkitCliRuntime = await fs.readFile(
      join(targetDir, 'scripts/tenkit-cli-runtime.ts'),
      'utf8',
    );

    assert.ok(result.filesWritten.includes('package.json'));
    assert.equal(result.gitInitialized, true);
    assert.equal(result.gitCommitted, false);
    assert.equal(packageJson.name, 'tenkit-generic-standalone');
    assert.equal(packageJson.scripts?.tenkit, 'tsx scripts/tenkit-cli.ts');
    assert.match(appVariants, /role: 'generic'/);
    assert.match(appVariants, /slug: 'atlas-network'/);
    assert.match(appVariants, /role: 'standalone'/);
    assert.match(appVariants, /slug: 'west-studio'/);
    assert.match(appVariants, /standaloneRuntimeTenantId: 103/);
    assert.match(runtimeTenants, /name: 'North Studio'/);
    assert.match(runtimeTenants, /name: 'West Studio'/);
    assert.match(resolver, /runtimeTenantAccess: resolvedAppVariant\.runtimeTenantAccess/);
    assert.match(
      resolver,
      /standaloneRuntimeTenantId: resolvedAppVariant\.standaloneRuntimeTenantId/,
    );
    assert.notMatch(resolver, /runtimeTenants:/);
    assert.match(runtimeTenantAccess, /Duplicate Runtime Tenant ID/);
    assert.match(runtimeTenantAccess, /Duplicate standalone Runtime Tenant assignment/);
    assert.match(
      runtimeTenantAccess,
      /must not appear in Generic App Variant Runtime Tenant Access/,
    );
    assert.match(tenkitCli, /command\('build'\)/);
    assert.match(tenkitCli, /command\('reset'\)/);
    assert.match(tenkitCli, /command\('doctor'\)/);
    assert.notMatch(tenkitCli, /command\('setup'\)/);
    assert.match(tenkitCliCore, /from '\.\.\/src\/constants\/app-variants'/);
    assert.match(tenkitCliRuntime, /Select an App Variant:/);
    assert.notMatch(tenkitCliRuntime, /Runtime Tenant/);
    assert.ok(result.filesWritten.includes('src/app/settings.tsx'));
    assert.equal(result.filesWritten.includes('src/app/explore.tsx'), false);
    assert.ok(result.filesWritten.includes('src/constants/app-variants.ts'));
    assert.equal(result.filesWritten.includes('src/constants/app-variant.ts'), false);
    assert.equal(result.filesWritten.includes('src/constants/app-variant-targets.ts'), false);
    assert.equal(result.filesWritten.includes('scripts/tenkit-cli-app-variant-targets.ts'), false);
    assert.ok(result.filesWritten.includes('src/constants/runtime-tenants.ts'));
    assert.ok(result.filesWritten.includes('src/hooks/use-active-runtime-tenant.ts'));
    assert.ok(result.filesWritten.includes('src/storage/app-preferences.ts'));
    assert.ok(result.filesWritten.includes('assets/atlas-network/icons/icon.png'));
    assert.ok(result.filesWritten.includes('assets/west-studio/icons/icon.png'));
    assert.equal(result.filesWritten.includes('assets/north-studio/icons/icon.png'), false);
    assert.equal(await exists(join(targetDir, '.git/HEAD')), true);
    assert.equal(await exists(join(workspaceRoot, 'package.json')), false);
  } finally {
    await fs.remove(tempRoot);
  }
});

test('local proof command boundary keeps generated files when Git initialization is unavailable', async () => {
  const tempRoot = await fs.mkdtemp(join(tmpdir(), 'tenkit-template-proof-'));
  const targetDir = join(tempRoot, 'generated-app');
  const originalPath = process.env.PATH;

  try {
    process.env.PATH = '';

    const result = await runWhiteLabelGenerationProof({
      targetDir,
      git: 'init',
    });

    assert.equal(result.gitInitialized, false);
    assert.equal(result.gitCommitted, false);
    assert.equal(result.gitSkippedBecauseTargetWasNotEmpty, false);
    assert.equal(await exists(join(targetDir, 'package.json')), true);
    assert.equal(await exists(join(targetDir, '.git/HEAD')), false);
  } finally {
    if (originalPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = originalPath;
    }

    await fs.remove(tempRoot);
  }
});

test('local proof command boundary skips Git snapshot for non-empty targets', async () => {
  const tempRoot = await fs.mkdtemp(join(tmpdir(), 'tenkit-template-proof-'));
  const targetDir = join(tempRoot, 'generated-app');

  try {
    await fs.ensureDir(targetDir);
    await fs.writeFile(join(targetDir, 'notes.txt'), 'not generated\n', 'utf8');

    const result = await runWhiteLabelGenerationProof({
      targetDir,
      git: 'init',
    });

    assert.equal(result.gitInitialized, false);
    assert.equal(result.gitCommitted, false);
    assert.equal(result.gitSkippedBecauseTargetWasNotEmpty, true);
    assert.equal(await exists(join(targetDir, 'package.json')), true);
    assert.equal(await exists(join(targetDir, 'notes.txt')), true);
    assert.equal(await exists(join(targetDir, '.git/HEAD')), false);
  } finally {
    await fs.remove(tempRoot);
  }
});

test('local proof command boundary refuses to generate inside the Tenkit workspace', async () => {
  const tempRoot = await fs.mkdtemp(join(tmpdir(), 'tenkit-template-proof-'));
  const workspaceRoot = join(tempRoot, 'tenkit-workspace');

  try {
    await expect(
      runWhiteLabelGenerationProof({
        targetDir: join(workspaceRoot, 'packages/proof'),
        workspaceRoot,
      }),
    ).rejects.toThrow(/protected project root/);
  } finally {
    await fs.remove(tempRoot);
  }
});
