import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { injectReleaseSetVersion } from '../src/inject-release-set-version';
import type { ReleaseSetPlan } from '../src/release-plan';
import { RELEASE_SET_PACKAGES } from '../src/release-set';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((tempRoot) => rm(tempRoot, { recursive: true })));
});

const stablePlan = {
  kind: 'release',
  channel: 'stable',
  sourceSha: '3a10d24d41f822e47df10fd18edc1d40fabf34cb',
  previousStableTag: {
    name: 'v0.2.0',
    version: '0.2.0',
    sha: '103302551ade74642d62d35c693c6593816ad7ac',
  },
  version: '0.3.0',
  npmDistTag: 'latest',
  gitTag: 'v0.3.0',
  githubReleaseType: 'release',
  dependencyApprovalOrder: [
    '@tenkit/types',
    '@tenkit/template-generator',
    '@tenkit/cli',
    'create-tenkit',
  ],
  contributingCommits: [],
} as const satisfies Extract<ReleaseSetPlan, { kind: 'release' }>;

async function createWorkspaceWithCliMetadata(cliMetadata: Record<string, unknown>) {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'tenkit-release-version-'));
  tempRoots.push(workspaceRoot);
  const manifests = new Map<string, string>();

  for (const releasePackage of RELEASE_SET_PACKAGES) {
    const path = join(workspaceRoot, releasePackage.root, 'package.json');
    const metadata =
      releasePackage.name === '@tenkit/cli'
        ? cliMetadata
        : {
            name: releasePackage.name,
            version: '0.2.0',
            ...(releasePackage.internalDependencies.length > 0
              ? {
                  dependencies: Object.fromEntries(
                    releasePackage.internalDependencies.map((dependencyName) => [
                      dependencyName,
                      'workspace:*',
                    ]),
                  ),
                }
              : {}),
          };
    const contents = `${JSON.stringify(metadata, null, 2)}\n`;
    await mkdir(join(workspaceRoot, releasePackage.root), { recursive: true });
    await writeFile(path, contents);
    manifests.set(path, contents);
  }

  return { workspaceRoot, manifests };
}

describe('isolated Release Set version injection', () => {
  test.each([
    {
      channel: 'stable' as const,
      version: '0.3.0',
      npmDistTag: 'latest' as const,
      githubReleaseType: 'release' as const,
    },
    {
      channel: 'rc' as const,
      version: '0.3.0-rc.2',
      npmDistTag: 'next' as const,
      githubReleaseType: 'prerelease' as const,
    },
  ])(
    'writes one exact $channel version and dependency graph to all manifests',
    async ({ channel, version, npmDistTag, githubReleaseType }) => {
      const workspaceRoot = await mkdtemp(join(tmpdir(), 'tenkit-release-version-'));
      tempRoots.push(workspaceRoot);
      const packages = [
        ['types', '@tenkit/types', []],
        ['template-generator', '@tenkit/template-generator', ['@tenkit/types']],
        ['cli', '@tenkit/cli', ['@tenkit/types', '@tenkit/template-generator']],
        ['create-tenkit', 'create-tenkit', ['@tenkit/cli']],
      ] as const;

      for (const [folder, name, internalDependencies] of packages) {
        const packageRoot = join(workspaceRoot, 'packages', folder);
        await mkdir(packageRoot, { recursive: true });
        await writeFile(
          join(packageRoot, 'package.json'),
          `${JSON.stringify(
            {
              name,
              version: '0.2.0',
              private: false,
              ...(internalDependencies.length > 0
                ? {
                    dependencies: Object.fromEntries(
                      internalDependencies.map((dependencyName) => [dependencyName, 'workspace:*']),
                    ),
                  }
                : {}),
            },
            null,
            2,
          )}\n`,
        );
      }

      const plan = {
        kind: 'release',
        channel,
        sourceSha: '3a10d24d41f822e47df10fd18edc1d40fabf34cb',
        previousStableTag: {
          name: 'v0.2.0',
          version: '0.2.0',
          sha: '103302551ade74642d62d35c693c6593816ad7ac',
        },
        version,
        npmDistTag,
        gitTag: `v${version}`,
        githubReleaseType,
        dependencyApprovalOrder: [
          '@tenkit/types',
          '@tenkit/template-generator',
          '@tenkit/cli',
          'create-tenkit',
        ],
        contributingCommits: [],
      } satisfies Extract<ReleaseSetPlan, { kind: 'release' }>;

      await injectReleaseSetVersion({ isolatedWorkspaceRoot: workspaceRoot, plan });

      for (const [folder, name, internalDependencies] of packages) {
        const packageMetadata = JSON.parse(
          await readFile(join(workspaceRoot, 'packages', folder, 'package.json'), 'utf8'),
        ) as Record<string, unknown>;
        expect(packageMetadata).toEqual({
          name,
          version,
          private: false,
          ...(internalDependencies.length > 0
            ? {
                dependencies: Object.fromEntries(
                  internalDependencies.map((dependencyName) => [dependencyName, version]),
                ),
              }
            : {}),
        });
      }
    },
  );

  test('rejects a corrupted planned version before changing any manifest', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'tenkit-release-version-'));
    tempRoots.push(workspaceRoot);
    const plan = {
      kind: 'release',
      channel: 'stable',
      sourceSha: '3a10d24d41f822e47df10fd18edc1d40fabf34cb',
      previousStableTag: {
        name: 'v0.2.0',
        version: '0.2.0',
        sha: '103302551ade74642d62d35c693c6593816ad7ac',
      },
      version: 'next',
      npmDistTag: 'latest',
      gitTag: 'vnext',
      githubReleaseType: 'release',
      dependencyApprovalOrder: [
        '@tenkit/types',
        '@tenkit/template-generator',
        '@tenkit/cli',
        'create-tenkit',
      ],
      contributingCommits: [],
    } as unknown as Extract<ReleaseSetPlan, { kind: 'release' }>;

    await expect(
      injectReleaseSetVersion({ isolatedWorkspaceRoot: workspaceRoot, plan }),
    ).rejects.toThrow(/exact Stable or RC version/);
  });

  test.each([
    {
      label: 'missing edge',
      cliMetadata: {
        name: '@tenkit/cli',
        version: '0.2.0',
        dependencies: { '@tenkit/types': 'workspace:*' },
      },
      expectedError: /expected 2 internal Release Set dependencies, found 1/,
    },
    {
      label: 'duplicate edge',
      cliMetadata: {
        name: '@tenkit/cli',
        version: '0.2.0',
        dependencies: {
          '@tenkit/types': 'workspace:*',
          '@tenkit/template-generator': 'workspace:*',
        },
        peerDependencies: { '@tenkit/template-generator': 'workspace:*' },
      },
      expectedError: /expected 2 internal Release Set dependencies, found 3/,
    },
    {
      label: 'non-string edge',
      cliMetadata: {
        name: '@tenkit/cli',
        version: '0.2.0',
        dependencies: { '@tenkit/types': 'workspace:*', '@tenkit/template-generator': 3 },
      },
      expectedError: /entry @tenkit\/template-generator must be a string/,
    },
  ])('rejects a $label without changing any manifest', async ({ cliMetadata, expectedError }) => {
    const { workspaceRoot, manifests } = await createWorkspaceWithCliMetadata(cliMetadata);

    await expect(
      injectReleaseSetVersion({
        isolatedWorkspaceRoot: workspaceRoot,
        plan: stablePlan,
      }),
    ).rejects.toThrow(expectedError);

    for (const [path, contents] of manifests) {
      await expect(readFile(path, 'utf8')).resolves.toBe(contents);
    }
  });
});
