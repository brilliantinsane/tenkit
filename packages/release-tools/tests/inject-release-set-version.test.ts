import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { injectReleaseSetVersion } from '../src/inject-release-set-version';
import type { ReleaseSetPlan } from '../src/release-plan';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((tempRoot) => rm(tempRoot, { recursive: true })));
});

describe('isolated Release Set version injection', () => {
  test('writes one planned version to all three public package manifests', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'tenkit-release-version-'));
    tempRoots.push(workspaceRoot);
    const packages = [
      ['template-generator', '@tenkit/template-generator'],
      ['cli', '@tenkit/cli'],
      ['create-tenkit', 'create-tenkit'],
    ] as const;

    for (const [folder, name] of packages) {
      const packageRoot = join(workspaceRoot, 'packages', folder);
      await mkdir(packageRoot, { recursive: true });
      await writeFile(
        join(packageRoot, 'package.json'),
        `${JSON.stringify({ name, version: '0.2.0', private: false }, null, 2)}\n`,
      );
    }

    const plan = {
      kind: 'release',
      sourceSha: '3a10d24d41f822e47df10fd18edc1d40fabf34cb',
      previousStableTag: {
        name: 'v0.2.0',
        version: '0.2.0',
        sha: '103302551ade74642d62d35c693c6593816ad7ac',
      },
      version: '0.3.0',
      contributingCommits: [],
    } satisfies Extract<ReleaseSetPlan, { kind: 'release' }>;

    await injectReleaseSetVersion({ isolatedWorkspaceRoot: workspaceRoot, plan });

    for (const [folder, name] of packages) {
      const packageMetadata = JSON.parse(
        await readFile(join(workspaceRoot, 'packages', folder, 'package.json'), 'utf8'),
      ) as Record<string, unknown>;
      expect(packageMetadata).toEqual({ name, version: '0.3.0', private: false });
    }
  });

  test('rejects a corrupted planned version before changing any manifest', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'tenkit-release-version-'));
    tempRoots.push(workspaceRoot);
    const plan = {
      kind: 'release',
      sourceSha: '3a10d24d41f822e47df10fd18edc1d40fabf34cb',
      previousStableTag: {
        name: 'v0.2.0',
        version: '0.2.0',
        sha: '103302551ade74642d62d35c693c6593816ad7ac',
      },
      version: 'next',
      contributingCommits: [],
    } as unknown as Extract<ReleaseSetPlan, { kind: 'release' }>;

    await expect(
      injectReleaseSetVersion({ isolatedWorkspaceRoot: workspaceRoot, plan }),
    ).rejects.toThrow(/major.minor.patch/);
  });
});
