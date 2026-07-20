import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  assertReleaseSetArtifactsMatch,
  reproduceReleaseSetForDraft,
  reproduceReleaseSetForLocalVerification,
  type RunCanonicalReleaseContainer,
} from '../src/reproduce-release-set';
import {
  RELEASE_CONTAINER_IMAGE,
  RELEASE_CONTAINER_PLATFORM,
  runCanonicalReleaseContainer,
} from '../src/release-container';

const sourceSha = '041f79e50ff5e84f5883be026201bde10f77f93e';
const version = '0.3.0';
const tempRoots: string[] = [];
const repositoryRoot = resolve(import.meta.dirname, '../../..');
const dockerAvailable =
  spawnSync('docker', ['version', '--format', '{{.Server.Version}}'], {
    stdio: 'ignore',
    timeout: 5000,
  }).status === 0;

if (process.env.CI && !dockerAvailable) {
  throw new Error('CI must provide Docker for canonical Release Set reproduction tests.');
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((tempRoot) => rm(tempRoot, { recursive: true })));
});

const packageFixtures = [
  {
    name: '@tenkit/template-generator',
    folder: 'template-generator',
    artifactFilename: 'tenkit-template-generator-0.3.0.tgz',
  },
  {
    name: '@tenkit/cli',
    folder: 'cli',
    artifactFilename: 'tenkit-cli-0.3.0.tgz',
    internalDependency: '@tenkit/template-generator',
  },
  {
    name: 'create-tenkit',
    folder: 'create-tenkit',
    artifactFilename: 'create-tenkit-0.3.0.tgz',
    internalDependency: '@tenkit/cli',
  },
] as const;

async function writeArtifact(
  artifactRoot: string,
  packageFixture: (typeof packageFixtures)[number],
  overrides: {
    name?: string;
    version?: string;
    internalDependencyVersion?: string;
    internalDependencySection?: 'dependencies' | 'peerDependencies';
    content?: string;
  } = {},
): Promise<void> {
  const packRoot = await mkdtemp(join(tmpdir(), 'tenkit-release-artifact-fixture-'));
  tempRoots.push(packRoot);
  const packageRoot = join(packRoot, 'package');
  await mkdir(packageRoot);
  await writeFile(join(packageRoot, 'README.md'), overrides.content ?? packageFixture.name);
  await writeFile(
    join(packageRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: overrides.name ?? packageFixture.name,
        version: overrides.version ?? version,
        ...('internalDependency' in packageFixture
          ? {
              [overrides.internalDependencySection ?? 'dependencies']: {
                [packageFixture.internalDependency]: overrides.internalDependencyVersion ?? version,
              },
            }
          : {}),
      },
      null,
      2,
    )}\n`,
  );
  const fixedTime = new Date('2026-01-01T00:00:00.000Z');
  await utimes(join(packageRoot, 'README.md'), fixedTime, fixedTime);
  await utimes(join(packageRoot, 'package.json'), fixedTime, fixedTime);
  await utimes(packageRoot, fixedTime, fixedTime);
  const tarPath = join(packRoot, 'package.tar');
  execFileSync('tar', ['-cf', tarPath, 'package'], { cwd: packRoot });
  await writeFile(
    join(artifactRoot, packageFixture.artifactFilename),
    gzipSync(await readFile(tarPath)),
  );
}

async function writeReleaseArtifacts(
  artifactRoot: string,
  mutation?: {
    packageName: (typeof packageFixtures)[number]['name'];
    overrides: Parameters<typeof writeArtifact>[2];
  },
): Promise<void> {
  for (const packageFixture of packageFixtures) {
    await writeArtifact(
      artifactRoot,
      packageFixture,
      mutation?.packageName === packageFixture.name ? mutation.overrides : undefined,
    );
  }
}

async function createRepositoryFixture(): Promise<string> {
  const repositoryRoot = await mkdtemp(join(tmpdir(), 'tenkit-release-repository-fixture-'));
  tempRoots.push(repositoryRoot);
  await writeFile(join(repositoryRoot, '.nvmrc'), 'v24.16.0\n');
  await writeFile(join(repositoryRoot, '.npm-version'), '11.16.0\n');
  await writeFile(
    join(repositoryRoot, 'package.json'),
    `${JSON.stringify({ packageManager: 'pnpm@11.15.0' })}\n`,
  );
  return repositoryRoot;
}

async function fakeSourceExtraction(input: {
  repositoryRoot: string;
  sourceRoot: string;
}): Promise<void> {
  await cp(input.repositoryRoot, input.sourceRoot, { recursive: true });
}

describe('canonical Release Set reproduction', () => {
  test('Draft and local Release Verification reproduce the same three artifacts', async () => {
    const repositoryRoot = await createRepositoryFixture();
    const outputParent = await mkdtemp(join(tmpdir(), 'tenkit-release-reproduction-'));
    tempRoots.push(outputParent);
    const containerInputs: Parameters<RunCanonicalReleaseContainer>[0][] = [];
    const extractSource = vi.fn(fakeSourceExtraction);
    const runContainer: RunCanonicalReleaseContainer = vi.fn(async (input) => {
      containerInputs.push(input);
      await writeReleaseArtifacts(input.artifactRoot);
    });
    const commonInput = {
      repositoryRoot,
      sourceSha,
      version,
      runContainer,
      extractSource,
    };

    const draft = await reproduceReleaseSetForDraft({
      ...commonInput,
      outputRoot: join(outputParent, 'draft'),
    });
    const localVerification = await reproduceReleaseSetForLocalVerification({
      ...commonInput,
      outputRoot: join(outputParent, 'verification'),
    });

    expect(containerInputs).toHaveLength(2);
    expect(extractSource).toHaveBeenCalledTimes(2);
    expect(extractSource).toHaveBeenNthCalledWith(1, expect.objectContaining({ sourceSha }));
    expect(
      containerInputs.map(({ image, platform, toolchain, version: releaseVersion }) => ({
        image,
        platform,
        toolchain,
        version: releaseVersion,
      })),
    ).toEqual([
      {
        image: RELEASE_CONTAINER_IMAGE,
        platform: RELEASE_CONTAINER_PLATFORM,
        toolchain: { node: '24.16.0', npm: '11.16.0', pnpm: '11.15.0' },
        version,
      },
      {
        image: RELEASE_CONTAINER_IMAGE,
        platform: RELEASE_CONTAINER_PLATFORM,
        toolchain: { node: '24.16.0', npm: '11.16.0', pnpm: '11.15.0' },
        version,
      },
    ]);
    expect(draft.packages).toEqual(localVerification.packages);

    for (let index = 0; index < draft.artifactPaths.length; index += 1) {
      await expect(readFile(draft.artifactPaths[index]!)).resolves.toEqual(
        await readFile(localVerification.artifactPaths[index]!),
      );
    }
  });

  test.each([
    ['package identity', { name: '@tenkit/not-cli' }, /expected @tenkit\/cli/],
    ['shared version', { version: '0.3.1' }, /expected version 0\.3\.0/],
    [
      'internal dependency edge',
      { internalDependencyVersion: '0.3.1' },
      /@tenkit\/template-generator expected 0\.3\.0/,
    ],
    [
      'non-runtime internal dependency edge',
      { internalDependencySection: 'peerDependencies' },
      /direct dependency @tenkit\/template-generator/,
    ],
  ] as const)('rejects a changed %s', async (_label, overrides, expectedMessage) => {
    const repositoryRoot = await createRepositoryFixture();
    const outputParent = await mkdtemp(join(tmpdir(), 'tenkit-release-reproduction-'));
    tempRoots.push(outputParent);

    await expect(
      reproduceReleaseSetForLocalVerification({
        repositoryRoot,
        outputRoot: join(outputParent, 'verification'),
        sourceSha,
        version,
        extractSource: fakeSourceExtraction,
        async runContainer(input) {
          await writeReleaseArtifacts(input.artifactRoot, {
            packageName: '@tenkit/cli',
            overrides,
          });
        },
      }),
    ).rejects.toThrow(expectedMessage);
  });

  test('rejects changed artifact bytes even when package metadata still matches', async () => {
    const repositoryRoot = await createRepositoryFixture();
    const outputParent = await mkdtemp(join(tmpdir(), 'tenkit-release-reproduction-'));
    tempRoots.push(outputParent);
    const reproduce = async (outputRoot: string, content: string) =>
      reproduceReleaseSetForDraft({
        repositoryRoot,
        outputRoot,
        sourceSha,
        version,
        extractSource: fakeSourceExtraction,
        async runContainer(input) {
          await writeReleaseArtifacts(input.artifactRoot, {
            packageName: '@tenkit/cli',
            overrides: { content },
          });
        },
      });
    const expected = await reproduce(join(outputParent, 'expected'), 'reviewed bytes');
    const changed = await reproduce(join(outputParent, 'changed'), 'changed bytes');

    await expect(
      assertReleaseSetArtifactsMatch({
        expectedPackages: expected.packages,
        artifactPaths: changed.artifactPaths,
        expectedVersion: version,
      }),
    ).rejects.toThrow(/tenkit-cli-0\.3\.0\.tgz shasum mismatch/);
  });

  test('requires comparison metadata for the complete three-package Release Set', async () => {
    const fixtureRepositoryRoot = await createRepositoryFixture();
    const outputParent = await mkdtemp(join(tmpdir(), 'tenkit-release-reproduction-'));
    tempRoots.push(outputParent);
    const reproduced = await reproduceReleaseSetForDraft({
      repositoryRoot: fixtureRepositoryRoot,
      outputRoot: join(outputParent, 'draft'),
      sourceSha,
      version,
      extractSource: fakeSourceExtraction,
      async runContainer(input) {
        await writeReleaseArtifacts(input.artifactRoot);
      },
    });

    await expect(
      assertReleaseSetArtifactsMatch({
        expectedPackages: reproduced.packages.slice(0, 2),
        artifactPaths: reproduced.artifactPaths,
        expectedVersion: version,
      }),
    ).rejects.toThrow(/exactly 3 packages/);
  });

  test.runIf(dockerAvailable)(
    'reproduces byte-identical real package artifacts through both container entrypoints (requires Docker)',
    { timeout: 600_000 },
    async () => {
      const outputParent = await mkdtemp(join(tmpdir(), 'tenkit-container-reproduction-'));
      tempRoots.push(outputParent);
      const reviewedSourceSha = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: repositoryRoot,
        encoding: 'utf8',
      }).trim();
      const currentPackageMetadata: unknown = JSON.parse(
        await readFile(join(repositoryRoot, 'packages/template-generator/package.json'), 'utf8'),
      );

      if (
        !currentPackageMetadata ||
        typeof currentPackageMetadata !== 'object' ||
        Array.isArray(currentPackageMetadata)
      ) {
        throw new Error('Template generator package metadata must be an object.');
      }

      const currentVersion = (currentPackageMetadata as Record<string, unknown>).version;

      if (typeof currentVersion !== 'string') {
        throw new Error('Template generator package metadata must contain a version.');
      }

      const commonInput = {
        repositoryRoot,
        sourceSha: reviewedSourceSha,
        version: currentVersion,
      };
      const draft = await reproduceReleaseSetForDraft({
        ...commonInput,
        outputRoot: join(outputParent, 'draft'),
      });
      const localVerification = await reproduceReleaseSetForLocalVerification({
        ...commonInput,
        outputRoot: join(outputParent, 'verification'),
      });

      await assertReleaseSetArtifactsMatch({
        expectedPackages: draft.packages,
        artifactPaths: localVerification.artifactPaths,
        expectedVersion: commonInput.version,
      });

      for (let index = 0; index < draft.artifactPaths.length; index += 1) {
        await expect(readFile(draft.artifactPaths[index]!)).resolves.toEqual(
          await readFile(localVerification.artifactPaths[index]!),
        );
      }
    },
  );

  test('builds the canonical image before running the internal recipe', async () => {
    const canonicalImageId = `sha256:${'a'.repeat(64)}`;
    const runCommand = vi
      .fn()
      .mockResolvedValueOnce({ stdout: `${canonicalImageId}\n`, stderr: '' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' });

    await runCanonicalReleaseContainer({
      sourceRoot: '/tmp/release-source',
      artifactRoot: '/tmp/release-artifacts',
      version,
      image: RELEASE_CONTAINER_IMAGE,
      platform: RELEASE_CONTAINER_PLATFORM,
      toolchain: { node: '24.16.0', npm: '11.16.0', pnpm: '11.15.0' },
      runCommand,
    });

    expect(runCommand).toHaveBeenCalledTimes(2);
    expect(runCommand).toHaveBeenNthCalledWith(1, {
      command: 'docker',
      args: [
        'build',
        '--quiet',
        '--platform',
        'linux/amd64',
        '--build-arg',
        'NODE_VERSION=24.16.0',
        '--build-arg',
        'NPM_VERSION=11.16.0',
        '--build-arg',
        'PNPM_VERSION=11.15.0',
        '--tag',
        'tenkit-release-reproduction:local',
        '--file',
        'packages/release-tools/container/Dockerfile',
        'packages/release-tools',
      ],
      cwd: '/tmp/release-source',
    });
    expect(runCommand).toHaveBeenNthCalledWith(2, {
      command: 'docker',
      args: expect.arrayContaining([
        'run',
        '--rm',
        '--platform',
        'linux/amd64',
        '--read-only',
        '--tmpfs',
        '/tmp:exec,mode=1777',
        'TENKIT_NODE_VERSION=24.16.0',
        'TENKIT_NPM_VERSION=11.16.0',
        'TENKIT_PNPM_VERSION=11.15.0',
        canonicalImageId,
        'node',
        '--no-warnings',
        '/usr/local/lib/tenkit-release-tools/container/reproduce-release-set.ts',
      ]),
      cwd: '/tmp/release-source',
    });
    expect(RELEASE_CONTAINER_IMAGE).toBe('tenkit-release-reproduction:local');
  });
});
