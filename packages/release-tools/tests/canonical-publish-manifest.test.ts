import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, expect, test } from 'vitest';

const canonicalPublishManifestPath = resolve(
  import.meta.dirname,
  '../container/canonical-publish-manifest.cjs',
);
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((tempRoot) => rm(tempRoot, { recursive: true })));
});

async function packFixture(dependencyNames: readonly string[]): Promise<Buffer> {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'tenkit-canonical-manifest-'));
  tempRoots.push(fixtureRoot);
  const packageRoot = join(fixtureRoot, 'package');
  const artifactRoot = join(fixtureRoot, 'artifacts');
  await mkdir(packageRoot);
  await mkdir(artifactRoot);
  await writeFile(
    join(packageRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: 'tenkit-canonical-manifest-fixture',
        version: '1.0.0',
        dependencies: Object.fromEntries(dependencyNames.map((name) => [name, '1.0.0'])),
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(join(packageRoot, 'README.md'), 'canonical manifest fixture\n');

  const packed = spawnSync(
    'pnpm',
    [
      `--config.pnpmfile=${canonicalPublishManifestPath}`,
      'pack',
      '--pack-destination',
      artifactRoot,
    ],
    {
      cwd: packageRoot,
      env: process.env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  if (packed.status !== 0) {
    throw new Error(`Fixture pack failed: ${packed.stderr.trim()}`);
  }

  return readFile(join(artifactRoot, 'tenkit-canonical-manifest-fixture-1.0.0.tgz'));
}

test('canonical packing ignores dependency insertion order', async () => {
  const typesFirst = await packFixture(['@tenkit/types', '@tenkit/template-generator']);
  const templateGeneratorFirst = await packFixture(['@tenkit/template-generator', '@tenkit/types']);

  expect(typesFirst).toEqual(templateGeneratorFirst);
});
