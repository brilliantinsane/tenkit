import { resolve } from 'node:path';

import { describe, expect, test, vi } from 'vitest';

import { buildDraftReleaseSet } from '../src/draft-release-set';

const workspaceRoot = resolve(import.meta.dirname, '../../..');
const sourceSha = '58e3fcb1b27635d2f3c9d08f31f6d26a626d0c98';

describe('Draft Release Set build', () => {
  test('uses canonical reproduction and returns only untrusted artifact diagnostics', async () => {
    const packages = [
      {
        name: '@tenkit/template-generator' as const,
        version: '0.4.0',
        artifactFilename: 'tenkit-template-generator-0.4.0.tgz',
        integrity: 'sha512-template',
        shasum: '1'.repeat(40),
        internalDependencies: [],
      },
      {
        name: '@tenkit/cli' as const,
        version: '0.4.0',
        artifactFilename: 'tenkit-cli-0.4.0.tgz',
        integrity: 'sha512-cli',
        shasum: '2'.repeat(40),
        internalDependencies: [{ name: '@tenkit/template-generator' as const, version: '0.4.0' }],
      },
      {
        name: 'create-tenkit' as const,
        version: '0.4.0',
        artifactFilename: 'create-tenkit-0.4.0.tgz',
        integrity: 'sha512-create',
        shasum: '3'.repeat(40),
        internalDependencies: [{ name: '@tenkit/cli' as const, version: '0.4.0' }],
      },
    ];
    const reproduceReleaseSet = vi.fn(async () => ({
      sourceSha,
      version: '0.4.0',
      artifactPaths: packages.map(({ artifactFilename }) => `/release/${artifactFilename}`),
      packages,
    }));

    await expect(
      buildDraftReleaseSet({
        workspaceRoot,
        sourceSha,
        version: '0.4.0',
        reproduceReleaseSet,
      }),
    ).resolves.toEqual({ sourceSha, version: '0.4.0', packages });

    expect(reproduceReleaseSet).toHaveBeenCalledExactlyOnceWith({
      repositoryRoot: workspaceRoot,
      outputRoot: resolve(workspaceRoot, 'release-artifacts'),
      sourceSha,
      version: '0.4.0',
    });
  });
});
