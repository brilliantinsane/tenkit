import { describe, expect, test } from 'vitest';

import {
  createReleaseSetManifest,
  parseReleaseSetManifest,
  type PackedReleasePackage,
} from '../src/release-set-manifest';
import type { ReleaseSetPlan } from '../src/release-plan';

const plan = {
  kind: 'release',
  sourceSha: '3a10d24d0de14a4a0b175b58e046ecbc00a996f3',
  previousStableTag: {
    name: 'v0.2.0',
    version: '0.2.0',
    sha: 'a7d7a733e82d33f3a75f567756c96b247c54b155',
  },
  version: '0.3.0',
  contributingCommits: [
    {
      sha: '3a10d24d0de14a4a0b175b58e046ecbc00a996f3',
      title: 'feat(playground): upgrade to Expo SDK 57 (#29)',
      paths: ['packages/template-generator/tests/generator.test.ts'],
      impact: 'minor',
    },
  ],
} satisfies Extract<ReleaseSetPlan, { kind: 'release' }>;

const packedPackages = [
  {
    name: '@tenkit/template-generator',
    root: 'packages/template-generator',
    version: '0.3.0',
    artifactFilename: 'tenkit-template-generator-0.3.0.tgz',
    size: 101,
    integrity: 'sha512-dGVtcGxhdGU=',
    shasum: '1111111111111111111111111111111111111111',
    internalDependencies: [],
  },
  {
    name: '@tenkit/cli',
    root: 'packages/cli',
    version: '0.3.0',
    artifactFilename: 'tenkit-cli-0.3.0.tgz',
    size: 202,
    integrity: 'sha512-Y2xp',
    shasum: '2222222222222222222222222222222222222222',
    internalDependencies: [{ name: '@tenkit/template-generator', version: '0.3.0' }],
  },
  {
    name: 'create-tenkit',
    root: 'packages/create-tenkit',
    version: '0.3.0',
    artifactFilename: 'create-tenkit-0.3.0.tgz',
    size: 303,
    integrity: 'sha512-Y3JlYXRl',
    shasum: '3333333333333333333333333333333333333333',
    internalDependencies: [{ name: '@tenkit/cli', version: '0.3.0' }],
  },
] satisfies readonly PackedReleasePackage[];

describe('Release Set manifest', () => {
  test('records the complete immutable identity consumed by later release operations', () => {
    const manifest = createReleaseSetManifest({
      plan,
      packedPackages,
      toolchain: { node: '24.16.0', npm: '11.16.0', pnpm: '11.15.0' },
      createdAt: '2026-07-20T12:00:00.000Z',
    });

    expect(manifest).toEqual({
      schemaVersion: 1,
      sourceSha: plan.sourceSha,
      version: '0.3.0',
      previousStableTag: plan.previousStableTag,
      contributingCommits: plan.contributingCommits,
      stagedTag: 'candidate',
      toolchain: { node: '24.16.0', npm: '11.16.0', pnpm: '11.15.0' },
      createdAt: '2026-07-20T12:00:00.000Z',
      packages: [
        expect.objectContaining({
          name: '@tenkit/template-generator',
          dependencyOrder: 1,
          internalDependencies: [],
        }),
        expect.objectContaining({
          name: '@tenkit/cli',
          dependencyOrder: 2,
          internalDependencies: [{ name: '@tenkit/template-generator', version: '0.3.0' }],
        }),
        expect.objectContaining({
          name: 'create-tenkit',
          dependencyOrder: 3,
          internalDependencies: [{ name: '@tenkit/cli', version: '0.3.0' }],
        }),
      ],
    });
    expect(manifest.packages[0]?.artifact).toEqual({
      filename: 'tenkit-template-generator-0.3.0.tgz',
      size: 101,
      integrity: 'sha512-dGVtcGxhdGU=',
      shasum: '1111111111111111111111111111111111111111',
    });
    expect(manifest.packages[0]?.provenance).toEqual({
      repository: 'https://github.com/brilliantinsane/tenkit',
      sourceSha: plan.sourceSha,
    });
  });

  test('rejects a manifest whose internal package chain drifts from the Release Set version', () => {
    const manifest = createReleaseSetManifest({
      plan,
      packedPackages,
      toolchain: { node: '24.16.0', npm: '11.16.0', pnpm: '11.15.0' },
      createdAt: '2026-07-20T12:00:00.000Z',
    });
    const corruptedManifest = structuredClone(manifest);
    corruptedManifest.packages[1]!.internalDependencies[0]!.version = '0.2.0';

    expect(() => parseReleaseSetManifest(corruptedManifest)).toThrow(
      /@tenkit\/cli.*@tenkit\/template-generator.*expected 0\.3\.0.*found 0\.2\.0/,
    );
  });

  test('rejects malformed timestamps and inconsistent previous stable identity', () => {
    const manifest = createReleaseSetManifest({
      plan,
      packedPackages,
      toolchain: { node: '24.16.0', npm: '11.16.0', pnpm: '11.15.0' },
      createdAt: '2026-07-20T12:00:00.000Z',
    });

    expect(() => parseReleaseSetManifest({ ...manifest, createdAt: 'not-a-date' })).toThrow(
      /creation timestamp must be an ISO timestamp/,
    );
    expect(() =>
      parseReleaseSetManifest({
        ...manifest,
        previousStableTag: { ...manifest.previousStableTag, name: 'v0.1.0' },
      }),
    ).toThrow(/name and version must identify the same release/);
  });

  test('rejects an artifact filename that does not match its package identity', () => {
    const manifest = createReleaseSetManifest({
      plan,
      packedPackages,
      toolchain: { node: '24.16.0', npm: '11.16.0', pnpm: '11.15.0' },
      createdAt: '2026-07-20T12:00:00.000Z',
    });
    const corruptedManifest = structuredClone(manifest);
    corruptedManifest.packages[1]!.artifact.filename = 'create-tenkit-0.3.0.tgz';

    expect(() => parseReleaseSetManifest(corruptedManifest)).toThrow(
      /@tenkit\/cli artifact filename must be tenkit-cli-0\.3\.0\.tgz/,
    );
  });
});
