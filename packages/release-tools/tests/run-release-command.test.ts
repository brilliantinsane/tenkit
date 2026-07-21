import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { runReleaseCommand } from '../src/run-release-command';

test('forces command INIT_CWD to the disposable command workspace', async () => {
  const commandRoot = await mkdtemp(join(tmpdir(), 'tenkit-release-command-'));

  try {
    const result = await runReleaseCommand({
      command: process.execPath,
      args: ['-e', 'process.stdout.write(process.env.INIT_CWD ?? "missing")'],
      cwd: commandRoot,
      env: { INIT_CWD: '/moving-main-worktree' },
    });

    expect(result.stdout).toBe(commandRoot);
  } finally {
    await rm(commandRoot, { recursive: true });
  }
});

test('can run with an explicit environment instead of inheriting workspace state', async () => {
  const commandRoot = await mkdtemp(join(tmpdir(), 'tenkit-release-command-'));

  try {
    const result = await runReleaseCommand({
      command: process.execPath,
      args: [
        '-e',
        'process.stdout.write(JSON.stringify({ safe: process.env.SAFE_VALUE, path: process.env.PATH, initCwd: process.env.INIT_CWD }))',
      ],
      cwd: commandRoot,
      env: { SAFE_VALUE: 'preserved' },
      inheritProcessEnv: false,
    });

    expect(JSON.parse(result.stdout)).toEqual({
      safe: 'preserved',
      initCwd: commandRoot,
    });
  } finally {
    await rm(commandRoot, { recursive: true });
  }
});

test('can suppress raw stderr from command failures', async () => {
  const commandRoot = await mkdtemp(join(tmpdir(), 'tenkit-release-command-'));

  try {
    await expect(
      runReleaseCommand({
        command: process.execPath,
        args: ['-e', 'process.stderr.write("sensitive external response"); process.exit(1)'],
        cwd: commandRoot,
        errorDetail: 'none',
      }),
    ).rejects.not.toThrow(/sensitive external response/);
  } finally {
    await rm(commandRoot, { recursive: true });
  }
});
