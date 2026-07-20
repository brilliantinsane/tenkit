import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { readPinnedReleaseToolchain } from '../src/release-toolchain';

const tempRoots: string[] = [];

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(tempRoots.splice(0).map((tempRoot) => rm(tempRoot, { recursive: true })));
});

async function createPinnedWorkspace(): Promise<string> {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'tenkit-release-toolchain-'));
  tempRoots.push(workspaceRoot);
  await writeFile(join(workspaceRoot, '.nvmrc'), 'v24.16.0\n');
  await writeFile(join(workspaceRoot, '.npm-version'), '11.16.0\n');
  await writeFile(
    join(workspaceRoot, 'package.json'),
    `${JSON.stringify({ packageManager: 'pnpm@11.15.0' }, null, 2)}\n`,
  );
  return workspaceRoot;
}

describe('Release Set toolchain pins', () => {
  test('reads exact Node, npm, and pnpm versions from their canonical repository sources', async () => {
    const workspaceRoot = await createPinnedWorkspace();

    await expect(readPinnedReleaseToolchain(workspaceRoot)).resolves.toEqual({
      node: '24.16.0',
      npm: '11.16.0',
      pnpm: '11.15.0',
    });
  });

  test('reports invalid root package metadata at the toolchain boundary', async () => {
    const workspaceRoot = await createPinnedWorkspace();
    await writeFile(join(workspaceRoot, 'package.json'), '{invalid json');

    await expect(readPinnedReleaseToolchain(workspaceRoot)).rejects.toThrow(
      /Root package metadata must contain valid JSON/,
    );
  });
});
