/// <reference types="node" />

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { promisify } from 'node:util';

import fs from 'fs-extra';
import { join } from 'pathe';

import { commitInitialGitSnapshot, runWhiteLabelGenerationProof } from '../src/local-proof';

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
  const playgroundDir = join(tempRoot, 'playground');

  try {
    const result = await runWhiteLabelGenerationProof({
      targetDir,
      git: 'init',
      playgroundDir,
    });
    await configureTestGitIdentity(targetDir);
    await commitInitialGitSnapshot(targetDir);
    const packageJson = JSON.parse(
      await fs.readFile(join(targetDir, 'package.json'), 'utf8'),
    ) as PackageJson;
    const readme = await fs.readFile(join(targetDir, 'README.md'), 'utf8');
    const envExample = await fs.readFile(join(targetDir, '.env.example'), 'utf8');
    const easJson = await fs.readFile(join(targetDir, 'eas.json'), 'utf8');
    const appConfig = await fs.readFile(join(targetDir, 'app.config.ts'), 'utf8');
    const appVariantTypes = await fs.readFile(join(targetDir, 'src/types/app-variant.ts'), 'utf8');
    const appVariants = await fs.readFile(join(targetDir, 'src/constants/app-variants.ts'), 'utf8');
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
    assert.match(readme, /pnpm tenkit build/);
    assert.ok(readme.indexOf('pnpm tenkit build') < readme.indexOf('pnpm ios'));
    assert.match(readme, /\.env\.example/);
    assert.match(envExample, /APP_VARIANT_SLUG=first-tenant/);
    assert.match(envExample, /\.env\.local/);
    assert.match(easJson, /"developmentClient": true/);
    assert.match(appConfig, /resolveAppVariantConfig/);
    assert.doesNotMatch(appConfig, /sharedExpoConfig/);
    assert.match(appConfig, /favicon: `\$\{icons\}\/favicon\.png`/);
    assert.match(appConfig, /'expo-system-ui'/);
    assert.match(appConfig, /APP_VARIANT_SLUG/);
    assert.match(appConfig, /\.\/src\/constants\/project-config/);
    assert.doesNotMatch(appConfig, /appVariants: \[/);
    assert.match(appConfig, /const assetPath = `\.\/assets\/\$\{slug\}`/);
    assert.match(appConfig, /expo-splash-screen/);
    assert.match(appConfig, /splash-icon-light\.png/);
    assert.match(appConfig, /splash-icon-dark\.png/);
    assert.match(appVariantTypes, /export type AppVariant =/);
    assert.match(appVariantTypes, /appVariantId: AppVariantId/);
    assert.match(appVariantTypes, /AppVariantConfigExtra/);
    assert.match(appVariantHook, /AppVariantConfigExtra/);
    assert.doesNotMatch(appVariantHook, /'id' in/);
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
    assert.doesNotMatch(tenkitCli, /command\('setup'\)/);
    assert.match(tenkitCliRuntime, /\.env\.local/);
    assert.match(app, /App Variant/);
    assert.match(pnpmWorkspace, /allowBuilds:\n  esbuild: true/);
    assert.doesNotMatch(pnpmWorkspace, /unrs-resolver/);
    assert.ok(result.filesWritten.includes('src/app/_layout.tsx'));
    assert.ok(result.filesWritten.includes('src/app/explore.tsx'));
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
    assert.equal(await exists(join(playgroundDir, 'package.json')), false);
  } finally {
    await fs.remove(tempRoot);
  }
});

test('local proof command boundary refuses to generate into the Playground', async () => {
  const tempRoot = await fs.mkdtemp(join(tmpdir(), 'tenkit-template-proof-'));
  const playgroundDir = join(tempRoot, 'apps/playground');

  try {
    await assert.rejects(
      () =>
        runWhiteLabelGenerationProof({
          targetDir: join(playgroundDir, 'generated'),
          playgroundDir,
        }),
      /protected project root/,
    );
  } finally {
    await fs.remove(tempRoot);
  }
});
