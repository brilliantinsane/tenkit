import { resolve } from 'node:path';

import { describe, expect, test, vi } from 'vitest';

import { buildDraftReleaseSet } from '../src/draft-release-set';

const workspaceRoot = resolve(import.meta.dirname, '../../..');
const sourceSha = '58e3fcb1b27635d2f3c9d08f31f6d26a626d0c98';

describe('Draft Release Set build', () => {
  test.each(['0.4.0', '0.4.0-rc.2'])(
    'uses canonical reproduction for %s and returns only untrusted artifact diagnostics',
    async (version) => {
      const packages = [
        {
          name: '@tenkit/template-generator' as const,
          version,
          artifactFilename: `tenkit-template-generator-${version}.tgz`,
          integrity: 'sha512-template',
          shasum: '1'.repeat(40),
          internalDependencies: [],
        },
        {
          name: '@tenkit/cli' as const,
          version,
          artifactFilename: `tenkit-cli-${version}.tgz`,
          integrity: 'sha512-cli',
          shasum: '2'.repeat(40),
          internalDependencies: [{ name: '@tenkit/template-generator' as const, version }],
        },
        {
          name: 'create-tenkit' as const,
          version,
          artifactFilename: `create-tenkit-${version}.tgz`,
          integrity: 'sha512-create',
          shasum: '3'.repeat(40),
          internalDependencies: [{ name: '@tenkit/cli' as const, version }],
        },
      ];
      const reproduceReleaseSet = vi.fn(async () => ({
        sourceSha,
        version,
        artifactPaths: packages.map(({ artifactFilename }) => `/release/${artifactFilename}`),
        packages,
      }));

      await expect(
        buildDraftReleaseSet({
          workspaceRoot,
          sourceSha,
          version,
          reproduceReleaseSet,
        }),
      ).resolves.toEqual({ sourceSha, version, packages });

      expect(reproduceReleaseSet).toHaveBeenCalledExactlyOnceWith({
        repositoryRoot: workspaceRoot,
        outputRoot: resolve(workspaceRoot, 'release-artifacts'),
        sourceSha,
        version,
      });
    },
  );

  test('rejects a noncanonical version before canonical reproduction', async () => {
    const reproduceReleaseSet = vi.fn();

    await expect(
      buildDraftReleaseSet({
        workspaceRoot,
        sourceSha,
        version: '0.4.0-next.1',
        reproduceReleaseSet,
      }),
    ).rejects.toThrow(/exact Stable or RC version/);
    expect(reproduceReleaseSet).not.toHaveBeenCalled();
  });
});
