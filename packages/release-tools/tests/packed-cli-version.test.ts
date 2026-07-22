import { cp, mkdtemp, mkdir, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { afterEach, expect, test } from 'vitest';

import { injectReleaseSetVersion } from '../src/inject-release-set-version';
import { planReleaseSetFromRepository } from '../src/plan-release-set-from-repository';

const workspaceRoot = resolve(import.meta.dirname, '../../..');
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((tempRoot) => rm(tempRoot, { recursive: true })));
});

function run(command: string, args: readonly string[], cwd: string): void {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    const diagnostic = `${result.stdout}\n${result.stderr}`
      .replaceAll(cwd, '<release-package>')
      .trim();
    throw new Error(
      `${basename(command)} failed with exit code ${result.status ?? 1}: ${diagnostic}`,
    );
  }
}

test('packed Public CLI --version equals its injected package version', async () => {
  const releaseWorkspaceRoot = await mkdtemp(join(tmpdir(), 'tenkit-packed-cli-version-'));
  tempRoots.push(releaseWorkspaceRoot);
  const releasePackagesRoot = join(releaseWorkspaceRoot, 'packages');
  const releaseCliRoot = join(releasePackagesRoot, 'cli');
  const sourceCliRoot = join(workspaceRoot, 'packages/cli');

  await mkdir(releasePackagesRoot, { recursive: true });
  await cp(join(sourceCliRoot, 'src'), join(releaseCliRoot, 'src'), { recursive: true });
  await cp(join(sourceCliRoot, 'package.json'), join(releaseCliRoot, 'package.json'));
  await cp(join(sourceCliRoot, 'README.md'), join(releaseCliRoot, 'README.md'));
  await symlink(join(sourceCliRoot, 'node_modules'), join(releaseCliRoot, 'node_modules'));
  const releaseCliMetadata = JSON.parse(
    await readFile(join(releaseCliRoot, 'package.json'), 'utf8'),
  ) as Record<string, unknown>;
  const releaseCliScripts = releaseCliMetadata.scripts as Record<string, unknown>;
  delete releaseCliScripts.prepack;
  await writeFile(
    join(releaseCliRoot, 'package.json'),
    `${JSON.stringify(releaseCliMetadata, null, 2)}\n`,
  );

  for (const [folder, name] of [
    ['template-generator', '@tenkit/template-generator'],
    ['create-tenkit', 'create-tenkit'],
  ] as const) {
    const packageRoot = join(releasePackagesRoot, folder);
    await mkdir(packageRoot, { recursive: true });
    await writeFile(
      join(packageRoot, 'package.json'),
      `${JSON.stringify({ name, version: '0.2.0' }, null, 2)}\n`,
    );
  }

  await writeFile(
    join(releaseWorkspaceRoot, 'pnpm-workspace.yaml'),
    "packages:\n  - 'packages/*'\n",
  );
  const plan = await planReleaseSetFromRepository({
    workspaceRoot,
    sourceRevision: '3a10d24',
  });
  expect(plan.kind).toBe('release');
  if (plan.kind === 'no-release') {
    throw new Error('Expected acceptance fixture 3a10d24 to produce a Release Set version.');
  }
  await injectReleaseSetVersion({ isolatedWorkspaceRoot: releaseWorkspaceRoot, plan });

  run(
    join(sourceCliRoot, 'node_modules/.bin/tsdown'),
    ['src/index.ts', '--format', 'esm'],
    releaseCliRoot,
  );
  const packRoot = join(releaseWorkspaceRoot, 'packs');
  await mkdir(packRoot);
  run('pnpm', ['pack', '--pack-destination', packRoot], releaseCliRoot);

  const tarballNames = (await readdir(packRoot)).filter((name) => name.endsWith('.tgz'));
  expect(tarballNames).toHaveLength(1);
  const extractedRoot = join(releaseWorkspaceRoot, 'extracted');
  await mkdir(extractedRoot);
  run('tar', ['-xzf', join(packRoot, tarballNames[0]), '-C', extractedRoot], releaseWorkspaceRoot);

  const packedPackageRoot = join(extractedRoot, 'package');
  const packedMetadata = JSON.parse(
    await readFile(join(packedPackageRoot, 'package.json'), 'utf8'),
  ) as Record<string, unknown>;
  await symlink(join(sourceCliRoot, 'node_modules'), join(packedPackageRoot, 'node_modules'));
  const version = spawnSync(
    process.execPath,
    [join(packedPackageRoot, 'dist/index.mjs'), '--version'],
    {
      cwd: packedPackageRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  expect(version.status).toBe(0);
  expect(version.stdout.trim()).toBe(plan.version);
  expect(packedMetadata.version).toBe(plan.version);
});
