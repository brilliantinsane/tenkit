import { describe, expect, test, vi } from 'vitest';

import { NpmVersionOccupancy } from '../src/npm-version-occupancy';

function stagedItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '1de6f3db-2ed9-4d72-b3dd-8f0e2b474a2f',
    packageName: '@tenkit/cli',
    version: '0.3.0',
    tag: 'candidate',
    createdAt: '2026-07-20T09:00:00.000Z',
    actor: 'tenkit-release',
    actorType: 'trusted automation',
    access: 'public',
    shasum: '4f7f5f1d5bcf2f72f6e4d6c4f3b2812d8a2f6c19',
    ...overrides,
  };
}

describe('npm Release Set version occupancy', () => {
  test('detects an already published package version without checking private stages', async () => {
    const runNpm = vi.fn(async () => ({ exitCode: 0, stdout: '"0.3.0"', stderr: '' }));
    const occupancy = new NpmVersionOccupancy(runNpm);

    await expect(occupancy.isPackageVersionOccupied('@tenkit/cli', '0.3.0')).resolves.toBe(true);
    expect(runNpm).toHaveBeenCalledExactlyOnceWith([
      'view',
      '@tenkit/cli@0.3.0',
      'version',
      '--json',
    ]);
  });

  test('detects a private staged version after confirming it is not published', async () => {
    const runNpm = vi
      .fn()
      .mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: 'npm error code E404' })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify([stagedItem()]),
        stderr: '',
      });
    const occupancy = new NpmVersionOccupancy(runNpm);

    await expect(occupancy.isPackageVersionOccupied('@tenkit/cli', '0.3.0')).resolves.toBe(true);
    expect(runNpm).toHaveBeenLastCalledWith(['stage', 'list', '@tenkit/cli', '--json']);
  });

  test('returns false when a version is neither published nor staged', async () => {
    const runNpm = vi
      .fn()
      .mockResolvedValueOnce({ exitCode: 1, stdout: '{"error":{"code":"E404"}}', stderr: '' })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: '[]',
        stderr: '',
      });
    const occupancy = new NpmVersionOccupancy(runNpm);

    await expect(occupancy.isPackageVersionOccupied('create-tenkit', '0.3.0')).resolves.toBe(false);
  });

  test('fails closed when registry inspection fails', async () => {
    const occupancy = new NpmVersionOccupancy(async () => ({
      exitCode: 1,
      stdout: '',
      stderr: 'network unavailable',
    }));

    await expect(
      occupancy.isPackageVersionOccupied('@tenkit/template-generator', '0.3.0'),
    ).rejects.toThrow(/Unable to inspect published version/);
  });

  test.each([
    ['an undocumented response shape', { stages: [{ version: '0.3.0' }] }],
    [
      'a staged package with the wrong identity',
      [stagedItem({ packageName: 'unrelated-package' })],
    ],
    ['a staged package with an invalid semantic version', [stagedItem({ version: 'next' })]],
  ])('fails closed for %s', async (_label, stagedResponse) => {
    const runNpm = vi
      .fn()
      .mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: 'npm error code E404' })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify(stagedResponse),
        stderr: '',
      });
    const occupancy = new NpmVersionOccupancy(runNpm);

    await expect(occupancy.isPackageVersionOccupied('@tenkit/cli', '0.3.0')).rejects.toThrow(
      /invalid staged-version JSON/,
    );
  });
});
