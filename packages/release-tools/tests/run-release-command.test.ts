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
