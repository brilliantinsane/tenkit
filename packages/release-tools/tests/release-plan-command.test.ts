import { resolve } from 'node:path';

import { describe, expect, test, vi } from 'vitest';

import { runReleasePlanCommand } from '../src/release-plan-command';

const workspaceRoot = resolve(import.meta.dirname, '../../..');

describe('release:plan command', () => {
  test('loads the repository npm pin before registry inspection', async () => {
    const runNpmCommand = vi.fn(async () => ({
      exitCode: 0,
      stdout: '11.4.2\n',
      stderr: '',
    }));

    await expect(
      runReleasePlanCommand({
        args: ['--', '--source', '3a10d24'],
        workspaceRoot,
        write() {},
        runNpmCommand,
      }),
    ).rejects.toThrow(/requires npm 11\.17\.0.*found 11\.4\.2/);
    expect(runNpmCommand).toHaveBeenCalledExactlyOnceWith(['--version']);
  });

  test('prints one read-only JSON plan for the selected source revision', async () => {
    let output = '';
    const exitCode = await runReleasePlanCommand({
      args: ['--', '--source', '3a10d24'],
      workspaceRoot,
      write(message) {
        output += message;
      },
      isPackageVersionOccupied: async () => false,
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

  test('rejects unknown arguments instead of guessing operator intent', async () => {
    await expect(
      runReleasePlanCommand({
        args: ['--version', '1.2.3'],
        workspaceRoot,
        write() {},
        isPackageVersionOccupied: async () => false,
      }),
    ).rejects.toThrow(/Usage: pnpm release:plan/);
  });
});
