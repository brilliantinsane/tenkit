import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test, vi } from 'vitest';

import { runReleasePackCommand } from '../src/release-pack-command';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((tempRoot) => rm(tempRoot, { recursive: true })));
});

async function writePlan(kind: 'release' | 'no-release' = 'release'): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'tenkit-release-pack-command-'));
  tempRoots.push(root);
  const path = join(root, 'plan.json');
  const shared = {
    kind,
    sourceSha: '3a10d24d0de14a4a0b175b58e046ecbc00a996f3',
    previousStableTag: {
      name: 'v0.2.0',
      version: '0.2.0',
      sha: 'a7d7a733e82d33f3a75f567756c96b247c54b155',
    },
  };
  await writeFile(
    path,
    `${JSON.stringify(
      kind === 'release'
        ? {
            ...shared,
            version: '0.3.0',
            contributingCommits: [
              {
                sha: '3a10d24d0de14a4a0b175b58e046ecbc00a996f3',
                title: 'feat(playground): upgrade to Expo SDK 57 (#29)',
                paths: ['packages/template-generator/tests/generator.test.ts'],
                impact: 'minor',
              },
            ],
          }
        : shared,
      null,
      2,
    )}\n`,
  );
  return path;
}

describe('release:pack command', () => {
  test('packs only the approved Release Set plan into the selected new output directory', async () => {
    const planPath = await writePlan();
    const outputRoot = join(tempRoots[0]!, 'release-output');
    const packReleaseSet = vi.fn(async () => ({
      manifestPath: join(outputRoot, 'release-set-0.3.0.json'),
      artifactPaths: ['template.tgz', 'cli.tgz', 'create.tgz'],
    }));
    let output = '';

    await expect(
      runReleasePackCommand({
        args: ['--', '--plan', planPath, '--output', outputRoot],
        repositoryRoot: '/tenkit',
        write(message) {
          output += message;
        },
        packReleaseSet,
      }),
    ).resolves.toBe(0);
    expect(packReleaseSet).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        repositoryRoot: '/tenkit',
        outputRoot,
        plan: expect.objectContaining({
          sourceSha: '3a10d24d0de14a4a0b175b58e046ecbc00a996f3',
          version: '0.3.0',
        }),
      }),
    );
    expect(output).toContain('release-set-0.3.0.json');
    expect(output).toContain('3 verified package artifacts');
  });

  test('rejects a no-release plan before packing', async () => {
    const planPath = await writePlan('no-release');
    const packReleaseSet = vi.fn();

    await expect(
      runReleasePackCommand({
        args: ['--plan', planPath, '--output', join(tempRoots[0]!, 'release-output')],
        repositoryRoot: '/tenkit',
        write() {},
        packReleaseSet,
      }),
    ).rejects.toThrow(/does not approve a Release Set/);
    expect(packReleaseSet).not.toHaveBeenCalled();
  });

  test('rejects ambiguous arguments instead of choosing implicit files or directories', async () => {
    await expect(
      runReleasePackCommand({
        args: ['--source', 'HEAD'],
        repositoryRoot: '/tenkit',
        write() {},
        packReleaseSet: vi.fn(),
      }),
    ).rejects.toThrow(/Usage: pnpm release:pack/);
  });
});
