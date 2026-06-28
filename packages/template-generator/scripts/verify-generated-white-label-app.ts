import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import fs from 'fs-extra';
import { join, resolve } from 'pathe';

import { commitInitialGitSnapshot, runWhiteLabelGenerationProof } from '../src/local-proof';

const execFileAsync = promisify(execFile);

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

async function main() {
  const packageRoot = resolve(fileURLToPath(import.meta.url), '..', '..');
  const workspaceRoot = resolve(packageRoot, '..', '..');
  const tempRoot = await fs.mkdtemp(join(tmpdir(), 'tenkit-generated-white-label-'));
  const targetDir = join(tempRoot, 'app');

  try {
    await runWhiteLabelGenerationProof({
      targetDir,
      git: 'init',
      playgroundDir: resolve(workspaceRoot, 'apps/playground'),
    });
    await configureTestGitIdentity(targetDir);
    await commitInitialGitSnapshot(targetDir);

    const packageJson = await readJson<PackageJson>(join(targetDir, 'package.json'));
    const readme = await readText(join(targetDir, 'README.md'));
    const envExample = await readText(join(targetDir, '.env.example'));
    const easJson = await readText(join(targetDir, 'eas.json'));
    const appConfig = await readText(join(targetDir, 'app.config.ts'));
    const appVariantTypes = await readText(join(targetDir, 'src/types/app-variant.ts'));
    const appVariants = await readText(join(targetDir, 'src/constants/app-variants.ts'));
    const projectConfig = await readText(join(targetDir, 'src/constants/project-config.ts'));
    const appVariantHook = await readText(join(targetDir, 'src/hooks/use-app-variant-config.ts'));
    const resolver = await readText(join(targetDir, 'src/lib/resolve-app-variant-config.ts'));
    const tenkitCli = await readText(join(targetDir, 'scripts/tenkit-cli.ts'));
    const tenkitCliCore = await readText(join(targetDir, 'scripts/tenkit-cli-core.ts'));
    const tenkitCliRuntime = await readText(join(targetDir, 'scripts/tenkit-cli-runtime.ts'));
    const app = await readText(join(targetDir, 'src/app/index.tsx'));
    const layout = await readText(join(targetDir, 'src/app/_layout.tsx'));
    const pnpmWorkspace = await readText(join(targetDir, 'pnpm-workspace.yaml'));

    assert.equal(packageJson.name, 'tenkit-white-label-app');
    assert.equal(packageJson.scripts?.start, 'expo start');
    assert.equal(packageJson.scripts?.tenkit, 'tsx scripts/tenkit-cli.ts');
    assert.equal(packageJson.scripts?.android, 'expo run:android');
    assert.equal(packageJson.scripts?.ios, 'expo run:ios');
    assert.equal(packageJson.scripts?.web, 'expo start --web');
    assert.equal(packageJson.scripts?.typecheck, 'tsc --noEmit --pretty false');
    assert.equal(packageJson.scripts?.['expo:config'], 'expo config --type public');
    assert.equal(packageJson.dependencies?.expo, '~56.0.12');
    assert.equal(packageJson.dependencies?.['expo-dev-client'], '~56.0.19');
    assert.equal(packageJson.dependencies?.['expo-router'], '~56.2.11');
    assert.equal(packageJson.dependencies?.['expo-splash-screen'], '~56.0.10');
    assert.equal(packageJson.dependencies?.['expo-system-ui'], '~56.0.5');
    assert.equal(packageJson.devDependencies?.['@inquirer/prompts'], '^8.5.2');
    assert.equal(packageJson.devDependencies?.['@expo/config-types'], '56.0.6');
    assert.equal(packageJson.devDependencies?.commander, '^15.0.0');
    assert.match(readme, /## Highlights/);
    assert.match(readme, /## Get Started/);
    assert.match(readme, /## Select an App Variant/);
    assert.match(readme, /## Build Preparation/);
    assert.match(readme, /## Run the Prepared App/);
    assert.match(readme, /pnpm tenkit build/);
    assert.match(readme, /EXPO_OWNER/);
    assert.match(readme, /starts blank on purpose/);
    assert.ok(readme.indexOf('pnpm tenkit build') < readme.indexOf('pnpm ios'));
    assert.match(readme, /\.env\.example/);
    assert.match(envExample, /APP_VARIANT_SLUG=first-tenant/);
    assert.match(envExample, /\.env\.local/);
    assert.match(easJson, /"developmentClient": true/);
    assert.match(appConfig, /APP_VARIANT_SLUG/);
    assert.match(appConfig, /resolveAppVariantConfig/);
    assert.doesNotMatch(appConfig, /sharedExpoConfig/);
    assert.match(appConfig, /favicon: `\$\{icons\}\/favicon\.png`/);
    assert.match(appConfig, /'expo-system-ui'/);
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
    assert.match(projectConfig, /EXPO_OWNER = ''/);
    assert.doesNotMatch(projectConfig, /brilliant-insane/);
    assert.match(appVariants, /satisfies readonly AppVariant\[\]/);
    assert.match(appVariants, /bundleIdentifier/);
    assert.match(appVariants, /slug: 'first-tenant'/);
    assert.match(resolver, /Missing required App Variant asset/);
    assert.match(resolver, /favicon\.png/);
    assert.match(resolver, /splash-icon-light\.png/);
    assert.match(resolver, /splash-icon-dark\.png/);
    assert.match(tenkitCli, /command\('build'\)/);
    assert.match(tenkitCli, /command\('reset'\)/);
    assert.match(tenkitCli, /command\('doctor'\)/);
    assert.doesNotMatch(tenkitCli, /command\('setup'\)/);
    assert.match(tenkitCliCore, /APP_VARIANT_ENVIRONMENTS/);
    assert.match(tenkitCliRuntime, /\.env\.local/);
    assert.match(app, /App Variant/);
    assert.match(layout, /ColorsProvider/);
    assert.match(pnpmWorkspace, /allowBuilds:\n  esbuild: true/);
    assert.doesNotMatch(pnpmWorkspace, /unrs-resolver/);
    assert.equal(await exists(join(targetDir, '.git/HEAD')), true);
    assert.equal(await exists(join(targetDir, 'AGENTS.md')), true);
    assert.equal(await exists(join(targetDir, '.env.example')), true);
    assert.equal(await exists(join(targetDir, 'CLAUDE.md')), true);
    assert.equal(await exists(join(targetDir, '.claude/settings.json')), true);
    assert.equal(await exists(join(targetDir, '.vscode/settings.json')), true);
    assert.equal(await exists(join(targetDir, 'LICENSE')), false);
    assert.equal(await exists(join(targetDir, 'assets/_global/README.md')), true);
    assert.equal(await exists(join(targetDir, 'assets/app/icons/icon.png')), false);
    assert.equal(await exists(join(targetDir, 'assets/first-tenant/icons/icon.png')), true);
    assert.equal(await exists(join(targetDir, 'assets/first-tenant/icons/favicon.png')), true);
    assert.equal(
      await exists(join(targetDir, 'assets/first-tenant/icons/android-icon-background.png')),
      true,
    );
    assert.equal(
      await exists(join(targetDir, 'assets/first-tenant/icons/android-icon-foreground.png')),
      true,
    );
    assert.equal(
      await exists(join(targetDir, 'assets/first-tenant/icons/android-icon-monochrome.png')),
      true,
    );
    assert.equal(
      await exists(join(targetDir, 'assets/first-tenant/icons/splash-icon-light.png')),
      true,
    );
    assert.equal(
      await exists(join(targetDir, 'assets/first-tenant/icons/splash-icon-dark.png')),
      true,
    );
    assert.equal(await exists(join(targetDir, 'assets/second-tenant/icons/icon.png')), true);
    assert.equal(await exists(join(targetDir, 'assets/second-tenant/icons/favicon.png')), true);
    assert.equal(
      await exists(join(targetDir, 'assets/second-tenant/icons/android-icon-background.png')),
      true,
    );
    assert.equal(
      await exists(join(targetDir, 'assets/second-tenant/icons/android-icon-foreground.png')),
      true,
    );
    assert.equal(
      await exists(join(targetDir, 'assets/second-tenant/icons/android-icon-monochrome.png')),
      true,
    );
    assert.equal(
      await exists(join(targetDir, 'assets/second-tenant/icons/splash-icon-light.png')),
      true,
    );
    assert.equal(
      await exists(join(targetDir, 'assets/second-tenant/icons/splash-icon-dark.png')),
      true,
    );
    assert.equal(await exists(join(targetDir, 'assets/first-tenant/.DS_Store')), false);
    assert.equal(await exists(join(targetDir, 'assets/second-tenant/.DS_Store')), false);

    const combinedGeneratedSource = [
      appConfig,
      appVariants,
      resolver,
      tenkitCli,
      tenkitCliCore,
      tenkitCliRuntime,
      app,
      layout,
    ].join('\n');
    assert.doesNotMatch(combinedGeneratedSource, /apps\/playground/);
    assert.doesNotMatch(combinedGeneratedSource, /from ['"].*playground/);
    assert.doesNotMatch(combinedGeneratedSource, /active-setup|setup-types/);
    assert.doesNotMatch(combinedGeneratedSource, /from ['"](?:@tenkit\/|tenkit\/)/);
    assert.doesNotMatch(combinedGeneratedSource, /defineWhiteLabelAppsSetup/);
    assert.doesNotMatch(combinedGeneratedSource, /activeSetup|Active Setup/);
    assert.doesNotMatch(combinedGeneratedSource, /setupType|Setup Type/);
    assert.doesNotMatch(combinedGeneratedSource, /base-expo|templates\/assets/);

    await runGeneratedCommand(targetDir, 'pnpm', ['install']);
    await runGeneratedCommand(targetDir, 'pnpm', ['run', 'typecheck']);
    await runGeneratedCommand(targetDir, 'pnpm', ['expo:config']);

    console.log('Verified generated White Label Apps Expo app.');
  } finally {
    await fs.remove(tempRoot);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
