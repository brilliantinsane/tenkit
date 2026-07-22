import { execFile } from 'node:child_process';
import { access, chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, test } from 'vitest';

import { runReleasePlanCommand } from '../src/release-plan-command';

const workspaceRoot = resolve(import.meta.dirname, '../../..');
const planReleaseEntrypoint = resolve(import.meta.dirname, '../scripts/plan-release.ts');
const execFileAsync = promisify(execFile);

describe('release:plan command', () => {
  test('prints one Git-derived JSON plan for the selected source revision', async () => {
    let output = '';
    const exitCode = await runReleasePlanCommand({
      args: ['--', '--source', '3a10d24'],
      workspaceRoot,
      write(message) {
        output += message;
      },
    });

    expect(exitCode).toBe(0);
    expect(JSON.parse(output)).toEqual(
      expect.objectContaining({
        kind: 'release',
        sourceSha: '3a10d24d0de14a4a0b175b58e046ecbc00a996f3',
        version: '0.3.0',
      }),
    );
  });

  test('plans through the command boundary without invoking npm', async () => {
    const sentinelRoot = await mkdtemp(join(tmpdir(), 'tenkit-release-plan-npm-sentinel-'));
    const sentinelPath = join(sentinelRoot, 'npm-invoked');
    const npmPath = join(sentinelRoot, 'npm');

    try {
      await writeFile(npmPath, '#!/bin/sh\n: > "$NPM_SENTINEL"\nexit 97\n', 'utf8');
      await chmod(npmPath, 0o755);

      const { stdout } = await execFileAsync(
        process.execPath,
        ['--import', 'tsx/esm', planReleaseEntrypoint, '--source', '3a10d24'],
        {
          cwd: resolve(import.meta.dirname, '..'),
          env: {
            ...process.env,
            NPM_SENTINEL: sentinelPath,
            PATH: `${sentinelRoot}:${process.env.PATH ?? ''}`,
          },
          encoding: 'utf8',
        },
      );

      expect(JSON.parse(stdout)).toEqual(
        expect.objectContaining({
          kind: 'release',
          sourceSha: '3a10d24d0de14a4a0b175b58e046ecbc00a996f3',
          version: '0.3.0',
        }),
      );
      await expect(access(sentinelPath)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(sentinelRoot, { recursive: true, force: true });
    }
  });

  test('rejects unknown arguments instead of guessing operator intent', async () => {
    await expect(
      runReleasePlanCommand({
        args: ['--version', '1.2.3'],
        workspaceRoot,
        write() {},
      }),
    ).rejects.toThrow(/Usage: pnpm release:plan/);
  });
});
