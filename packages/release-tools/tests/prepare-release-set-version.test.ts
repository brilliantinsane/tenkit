import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, expect, test } from 'vitest';

import { prepareReleaseSetVersion } from '../src/prepare-release-set-version';
import { RELEASE_SET_PACKAGES } from '../src/release-set.ts';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((tempRoot) => rm(tempRoot, { recursive: true })));
});

test('injects the version planned from source history into an isolated release workspace', async () => {
  const isolatedWorkspaceRoot = await mkdtemp(join(tmpdir(), 'tenkit-prepared-release-version-'));
  tempRoots.push(isolatedWorkspaceRoot);

  for (const releasePackage of RELEASE_SET_PACKAGES) {
    const packageRoot = join(isolatedWorkspaceRoot, releasePackage.root);
    await mkdir(packageRoot, { recursive: true });
    await writeFile(
      join(packageRoot, 'package.json'),
      `${JSON.stringify({ name: releasePackage.name, version: '0.2.0' }, null, 2)}\n`,
    );
  }

  const plan = await prepareReleaseSetVersion({
    workspaceRoot: repositoryRoot,
    isolatedWorkspaceRoot,
    sourceRevision: '3a10d24',
    async isPackageVersionOccupied() {
      return false;
    },
  });

  expect(plan.version).toBe('0.3.0');
  for (const releasePackage of RELEASE_SET_PACKAGES) {
    const packageMetadata = JSON.parse(
      await readFile(join(isolatedWorkspaceRoot, releasePackage.root, 'package.json'), 'utf8'),
    ) as Record<string, unknown>;
    expect(packageMetadata.version).toBe(plan.version);
  }
});
