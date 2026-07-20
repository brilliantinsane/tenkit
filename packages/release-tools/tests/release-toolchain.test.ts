import { mkdtemp, readlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  assertPinnedReleaseToolchain,
  installPinnedReleaseToolchain,
  readPinnedReleaseToolchain,
} from '../src/release-toolchain';

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

  test('stops at the first active version mismatch before release commands can run', async () => {
    const runVersionCommand = vi.fn(async () => '11.16.0');

    await expect(
      assertPinnedReleaseToolchain(
        { node: '24.16.0', npm: '11.16.0', pnpm: '11.15.0' },
        {
          activeNodeVersion: '24.14.0',
          runVersionCommand,
        },
      ),
    ).rejects.toThrow(/requires Node 24\.16\.0.*found 24\.14\.0/);
    expect(runVersionCommand).not.toHaveBeenCalled();
  });

  test('checks npm and pnpm only after Node matches', async () => {
    const runVersionCommand = vi
      .fn<(command: 'npm' | 'pnpm') => Promise<string>>()
      .mockResolvedValueOnce('11.16.0\n')
      .mockResolvedValueOnce('11.9.0\n');

    await expect(
      assertPinnedReleaseToolchain(
        { node: '24.16.0', npm: '11.16.0', pnpm: '11.15.0' },
        {
          activeNodeVersion: 'v24.16.0',
          runVersionCommand,
        },
      ),
    ).rejects.toThrow(/requires pnpm 11\.15\.0.*found 11\.9\.0/);
    expect(runVersionCommand).toHaveBeenNthCalledWith(1, 'npm');
    expect(runVersionCommand).toHaveBeenNthCalledWith(2, 'pnpm');
  });

  test('installs the validated executables into an isolated toolchain used by packing', async () => {
    const targetRoot = await mkdtemp(join(tmpdir(), 'tenkit-installed-release-toolchain-'));
    tempRoots.push(targetRoot);
    const resolvedCommands: string[] = [];
    const installed = await installPinnedReleaseToolchain(
      { node: '24.16.0', npm: '11.16.0', pnpm: '11.15.0' },
      {
        targetRoot,
        activeNodeExecutable: process.execPath,
        baseEnv: { PATH: '/system/bin' },
        async resolveExecutable(command) {
          resolvedCommands.push(command);
          return process.execPath;
        },
        async runInstalledVersionCommand(tool) {
          return { Node: '24.16.0', npm: '11.16.0', pnpm: '11.15.0' }[tool];
        },
      },
    );

    expect(resolvedCommands).toEqual(['npm', 'pnpm']);
    await expect(readlink(installed.executables.node)).resolves.toBe(process.execPath);
    await expect(readlink(installed.executables.npm)).resolves.toBe(process.execPath);
    await expect(readlink(installed.executables.pnpm)).resolves.toBe(process.execPath);
    expect(installed.env.PATH).toBe(`${join(targetRoot, 'bin')}:/system/bin`);
  });
});
