import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, test, vi } from 'vitest';

import { runReleaseContainer } from '../src/run-release-container';

const tempRoots: string[] = [];
const releaseToolsRoot = resolve(import.meta.dirname, '..');

afterEach(async () => {
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

describe('Release Set container', () => {
  test('includes the canonical shell entrypoint in the Docker build context', async () => {
    const dockerignore = await readFile(join(releaseToolsRoot, '.dockerignore'), 'utf8');
    const containerFiles = await readdir(join(releaseToolsRoot, 'container'));

    expect(dockerignore.split(/\r?\n/)).toContain('!container/pack-release-set.sh');
    expect(containerFiles.filter((file) => /\.(?:mjs|ts)$/.test(file))).toEqual([]);
  });

  test('builds the image with the source toolchain before running its packing program', async () => {
    const sourceRoot = await createPinnedWorkspace();
    const canonicalImageId = `sha256:${'a'.repeat(64)}`;
    const runCommand = vi
      .fn()
      .mockResolvedValueOnce({ stdout: `${canonicalImageId}\n`, stderr: '' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' });

    await runReleaseContainer({
      sourceRoot,
      artifactRoot: '/tmp/release-artifacts',
      version: '0.3.0',
      runCommand,
    });

    expect(runCommand).toHaveBeenCalledTimes(2);
    expect(runCommand).toHaveBeenNthCalledWith(1, {
      command: 'docker',
      args: [
        'build',
        '--quiet',
        '--platform',
        'linux/amd64',
        '--build-arg',
        'NODE_VERSION=24.16.0',
        '--build-arg',
        'NPM_VERSION=11.16.0',
        '--build-arg',
        'PNPM_VERSION=11.15.0',
        '--tag',
        'tenkit-release-reproduction:local',
        '--file',
        'packages/release-tools/container/Dockerfile',
        'packages/release-tools',
      ],
      cwd: sourceRoot,
    });
    expect(runCommand).toHaveBeenNthCalledWith(2, {
      command: 'docker',
      args: expect.arrayContaining([
        'run',
        '--rm',
        '--platform',
        'linux/amd64',
        '--read-only',
        '--tmpfs',
        '/tmp:exec,mode=1777',
        'TENKIT_NODE_VERSION=24.16.0',
        'TENKIT_NPM_VERSION=11.16.0',
        'TENKIT_PNPM_VERSION=11.15.0',
        canonicalImageId,
        '/usr/local/bin/pack-release-set.sh',
      ]),
      cwd: sourceRoot,
    });
    expect(runCommand.mock.calls[1]?.[0].args.at(-1)).toBe('/usr/local/bin/pack-release-set.sh');
  });

  test('reports invalid root package metadata at the toolchain boundary', async () => {
    const sourceRoot = await createPinnedWorkspace();
    await writeFile(join(sourceRoot, 'package.json'), '{invalid json');

    await expect(
      runReleaseContainer({
        sourceRoot,
        artifactRoot: '/tmp/release-artifacts',
        version: '0.3.0',
      }),
    ).rejects.toThrow(/Root package metadata must contain valid JSON/);
  });
});
