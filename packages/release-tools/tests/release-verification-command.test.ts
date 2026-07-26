import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

import { afterEach, describe, expect, test, vi } from 'vitest';

import { inspectReleaseArtifact } from '../src/release-artifacts';
import { runReleaseVerificationCommand } from '../src/release-verification-command';
import { RELEASE_SET_PACKAGES, type ReleaseSetPackageName } from '../src/release-set';

const sourceSha = '041f79e50ff5e84f5883be026201bde10f77f93e';
const previousStableVersion = '0.3.0';
const previousReleaseCandidateVersion = '0.4.0-rc.2';
const workspaceRoot = resolve(import.meta.dirname, '../../..');
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((tempRoot) => rm(tempRoot, { recursive: true })));
});

type ArtifactMutation = {
  name?: string;
  version?: string;
  internalDependencyVersion?: string;
  internalDependencySection?: 'dependencies' | 'peerDependencies';
  embeddedCliVersion?: string;
  content?: string;
};

async function writeReleaseArtifacts(
  version: string,
  mutations: Partial<Record<ReleaseSetPackageName, ArtifactMutation>> = {},
): Promise<string[]> {
  const artifactRoot = await mkdtemp(join(tmpdir(), 'tenkit-release-verification-fixture-'));
  tempRoots.push(artifactRoot);
  const artifactPaths: string[] = [];

  for (const releasePackage of RELEASE_SET_PACKAGES) {
    const mutation = mutations[releasePackage.name];
    const packRoot = await mkdtemp(join(tmpdir(), 'tenkit-release-verification-package-'));
    tempRoots.push(packRoot);
    const packageRoot = join(packRoot, 'package');
    await mkdir(packageRoot);
    await writeFile(
      join(packageRoot, 'package.json'),
      `${JSON.stringify(
        {
          name: mutation?.name ?? releasePackage.name,
          version: mutation?.version ?? version,
          ...('internalDependency' in releasePackage
            ? {
                [mutation?.internalDependencySection ?? 'dependencies']: {
                  [releasePackage.internalDependency]:
                    mutation?.internalDependencyVersion ?? version,
                },
              }
            : {}),
        },
        null,
        2,
      )}\n`,
    );
    await writeFile(
      join(packageRoot, 'README.md'),
      mutation?.content ?? `${releasePackage.name}\n`,
    );
    if (releasePackage.name === '@tenkit/cli') {
      await mkdir(join(packageRoot, 'dist'));
      await writeFile(
        join(packageRoot, 'dist/index.mjs'),
        `const CLI_VERSION = ${JSON.stringify(mutation?.embeddedCliVersion ?? version)};\n`,
      );
    }
    const fixedTime = new Date('2026-01-01T00:00:00.000Z');
    await utimes(join(packageRoot, 'package.json'), fixedTime, fixedTime);
    await utimes(join(packageRoot, 'README.md'), fixedTime, fixedTime);
    if (releasePackage.name === '@tenkit/cli') {
      await utimes(join(packageRoot, 'dist/index.mjs'), fixedTime, fixedTime);
      await utimes(join(packageRoot, 'dist'), fixedTime, fixedTime);
    }
    await utimes(packageRoot, fixedTime, fixedTime);
    const tarPath = join(packRoot, 'package.tar');
    execFileSync('tar', ['-cf', tarPath, 'package'], { cwd: packRoot });
    const artifactPath = join(artifactRoot, `${releasePackage.artifactPrefix}-${version}.tgz`);
    await writeFile(artifactPath, gzipSync(await readFile(tarPath)));
    artifactPaths.push(artifactPath);
  }

  return artifactPaths;
}

async function createReleaseArtifacts(
  version: string,
  mutations: Partial<Record<ReleaseSetPackageName, ArtifactMutation>> = {},
) {
  const artifactPaths = await writeReleaseArtifacts(version, mutations);

  return {
    artifactPaths,
    packages: await Promise.all(
      RELEASE_SET_PACKAGES.map((releasePackage, index) =>
        inspectReleaseArtifact({
          artifactPath: artifactPaths[index]!,
          expectedName: releasePackage.name,
          expectedVersion: version,
        }),
      ),
    ),
  };
}

function stageId(index: number): string {
  return `1de6f3db-2ed9-4d72-b3dd-8f0e2b474a2${index}`;
}

type RegistryState = 'private' | 'public' | 'missing';
type ReleasePublicationState = 'draft' | 'published';

type VerificationHarnessOptions = {
  version?: string;
  publicationState?: ReleasePublicationState;
  stageOverrides?: Partial<Record<ReleaseSetPackageName, Record<string, unknown>>>;
  viewedStageOverrides?: Partial<Record<ReleaseSetPackageName, Record<string, unknown>>>;
  duplicateStageFor?: ReleaseSetPackageName;
  unexpectedPublicStageFor?: ReleaseSetPackageName;
  publicMetadataOverrides?: Partial<Record<ReleaseSetPackageName, Record<string, unknown>>>;
  publicDigestOverrides?: Partial<
    Record<ReleaseSetPackageName, Partial<{ integrity: string; shasum: string }>>
  >;
  distTagOverrides?: Partial<Record<ReleaseSetPackageName, Record<string, string>>>;
  reproductionArtifactMutations?: Partial<Record<ReleaseSetPackageName, ArtifactMutation>>;
  registryArtifactMutations?: Partial<Record<ReleaseSetPackageName, ArtifactMutation>>;
  sharedArtifactMutations?: Partial<Record<ReleaseSetPackageName, ArtifactMutation>>;
  githubReleaseOverrides?: Record<string, unknown>;
  duplicateGithubRelease?: boolean;
  remoteTagSha?: string | null;
  createEntrypointVersion?: string;
  transientMissingReads?: Partial<Record<ReleaseSetPackageName, number>>;
  transientSelectedTagReads?: Partial<Record<ReleaseSetPackageName, number>>;
  npmVersion?: string;
};

async function createVerificationHarness(
  states: readonly [RegistryState, RegistryState, RegistryState],
  options: VerificationHarnessOptions = {},
) {
  const version = options.version ?? '0.4.0';
  const isReleaseCandidate = version.includes('-rc.');
  const finalTag = isReleaseCandidate ? 'next' : 'latest';
  const otherTag = isReleaseCandidate ? 'latest' : 'next';
  const previousFinalVersion = isReleaseCandidate
    ? previousReleaseCandidateVersion
    : previousStableVersion;
  const previousOtherVersion = isReleaseCandidate
    ? previousStableVersion
    : previousReleaseCandidateVersion;
  const local = await createReleaseArtifacts(version, options.reproductionArtifactMutations);
  if (options.sharedArtifactMutations) {
    local.artifactPaths = await writeReleaseArtifacts(version, options.sharedArtifactMutations);
  }
  const registryArtifactPaths =
    options.registryArtifactMutations ||
    options.reproductionArtifactMutations ||
    options.sharedArtifactMutations
      ? options.sharedArtifactMutations && !options.registryArtifactMutations
        ? local.artifactPaths
        : await writeReleaseArtifacts(version, options.registryArtifactMutations)
      : local.artifactPaths;
  const registryDigests = await Promise.all(
    registryArtifactPaths.map(async (artifactPath) => {
      const bytes = await readFile(artifactPath);
      return {
        integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
        shasum: createHash('sha1').update(bytes).digest('hex'),
      };
    }),
  );
  const stages = new Map(
    RELEASE_SET_PACKAGES.flatMap((releasePackage, index) => {
      const shouldHaveStage =
        states[index] === 'private' || options.unexpectedPublicStageFor === releasePackage.name;

      return shouldHaveStage
        ? [
            [
              releasePackage.name,
              [
                {
                  id: stageId(index),
                  packageName: releasePackage.name,
                  version,
                  tag: finalTag,
                  createdAt: '2026-07-20T09:00:00.000Z',
                  actor: 'GitHub Actions',
                  actorType: 'trusted automation',
                  access: 'public',
                  shasum: registryDigests[index]!.shasum,
                  ...options.stageOverrides?.[releasePackage.name],
                },
                ...(options.duplicateStageFor === releasePackage.name
                  ? [
                      {
                        id: '2de6f3db-2ed9-4d72-b3dd-8f0e2b474a20',
                        packageName: releasePackage.name,
                        version,
                        tag: finalTag,
                        createdAt: '2026-07-20T09:01:00.000Z',
                        actor: 'GitHub Actions',
                        actorType: 'trusted automation',
                        access: 'public',
                        shasum: registryDigests[index]!.shasum,
                      },
                    ]
                  : []),
              ],
            ] as const,
          ]
        : [];
    }),
  );
  const publicReadCounts = new Map<ReleaseSetPackageName, number>();
  const distTagReadCounts = new Map<ReleaseSetPackageName, number>();
  const runNpmCommand = vi.fn(async (input: { args: readonly string[]; cwd: string }) => {
    const args = [...input.args];

    if (args[0] === '--version') {
      return { exitCode: 0, stdout: `${options.npmVersion ?? '11.17.0'}\n`, stderr: '' };
    }

    if (args[0] === 'view' && args[1]?.includes(`@${version}`)) {
      const index = RELEASE_SET_PACKAGES.findIndex(
        (releasePackage) => `${releasePackage.name}@${version}` === args[1],
      );
      const releasePackage = RELEASE_SET_PACKAGES[index];

      if (releasePackage) {
        const readCount = (publicReadCounts.get(releasePackage.name) ?? 0) + 1;
        publicReadCounts.set(releasePackage.name, readCount);
        const transientMissingReads = options.transientMissingReads?.[releasePackage.name] ?? 0;

        if (states[index] === 'public' && readCount > transientMissingReads) {
          return {
            exitCode: 0,
            stdout: JSON.stringify({
              name: releasePackage.name,
              version,
              ...('internalDependency' in releasePackage
                ? { dependencies: { [releasePackage.internalDependency]: version } }
                : {}),
              dist: {
                integrity: registryDigests[index]!.integrity,
                shasum: registryDigests[index]!.shasum,
                ...options.publicDigestOverrides?.[releasePackage.name],
              },
              ...options.publicMetadataOverrides?.[releasePackage.name],
            }),
            stderr: '',
          };
        }
      }

      return { exitCode: 1, stdout: '', stderr: 'npm error code E404' };
    }

    if (args[0] === 'view' && args[2] === 'dist-tags') {
      const packageName = args[1] as ReleaseSetPackageName;
      const index = RELEASE_SET_PACKAGES.findIndex(
        (releasePackage) => releasePackage.name === packageName,
      );
      const readCount = (distTagReadCounts.get(packageName) ?? 0) + 1;
      distTagReadCounts.set(packageName, readCount);
      const transientSelectedTagReads = options.transientSelectedTagReads?.[packageName] ?? 0;
      const selectedVersion =
        states[index] === 'public' && readCount > transientSelectedTagReads
          ? version
          : previousFinalVersion;
      return {
        exitCode: 0,
        stdout: JSON.stringify({
          [finalTag]: selectedVersion,
          [otherTag]: previousOtherVersion,
          ...options.distTagOverrides?.[packageName],
        }),
        stderr: '',
      };
    }

    if (args[0] === 'stage' && args[1] === 'list') {
      const packageName = args[2] as ReleaseSetPackageName;
      const index = RELEASE_SET_PACKAGES.findIndex(
        (releasePackage) => releasePackage.name === packageName,
      );
      const publicReadCount = publicReadCounts.get(packageName) ?? 0;
      const transientMissingReads = options.transientMissingReads?.[packageName] ?? 0;
      const packageStages =
        states[index] === 'public' && publicReadCount <= transientMissingReads
          ? []
          : (stages.get(packageName) ?? []);
      return { exitCode: 0, stdout: JSON.stringify(packageStages), stderr: '' };
    }

    if (args[0] === 'stage' && args[1] === 'view') {
      const stage = [...stages.entries()]
        .flatMap(([packageName, packageStages]) =>
          packageStages.map((packageStage) => ({ packageName, packageStage })),
        )
        .find(({ packageStage }) => packageStage.id === args[2]);
      return {
        exitCode: 0,
        stdout: JSON.stringify(
          stage
            ? {
                ...stage.packageStage,
                ...options.viewedStageOverrides?.[stage.packageName],
              }
            : undefined,
        ),
        stderr: '',
      };
    }

    if (args[0] === 'stage' && args[1] === 'download') {
      const index = RELEASE_SET_PACKAGES.findIndex((releasePackage) =>
        stages.get(releasePackage.name)?.some((stage) => stage.id === args[2]),
      );
      const releasePackage = RELEASE_SET_PACKAGES[index]!;
      const filename = `${releasePackage.name.replace('@', '').replace('/', '-')}-${version}-${args[2]}.tgz`;
      await writeFile(join(input.cwd, filename), await readFile(registryArtifactPaths[index]!));
      return { exitCode: 0, stdout: `${filename}\n`, stderr: '' };
    }

    if (args[0] === 'pack') {
      const index = RELEASE_SET_PACKAGES.findIndex(
        (releasePackage) => `${releasePackage.name}@${version}` === args[1],
      );
      const releasePackage = RELEASE_SET_PACKAGES[index]!;
      const filename = `${releasePackage.artifactPrefix}-${version}.tgz`;
      await writeFile(join(input.cwd, filename), await readFile(registryArtifactPaths[index]!));
      return { exitCode: 0, stdout: JSON.stringify([{ filename }]), stderr: '' };
    }

    return { exitCode: 1, stdout: '', stderr: `Unexpected npm command: ${args.join(' ')}` };
  });
  const publicationState = options.publicationState ?? 'draft';
  const githubRelease = {
    tag_name: `v${version}`,
    target_commitish: sourceSha,
    draft: publicationState === 'draft',
    prerelease: isReleaseCandidate,
    published_at: publicationState === 'published' ? '2026-07-20T10:00:00.000Z' : null,
    html_url: `https://github.com/brilliantinsane/tenkit/releases/tag/v${version}`,
    ...options.githubReleaseOverrides,
  };
  const runCommand = vi.fn(
    async (input: { command: string; args: readonly string[]; cwd: string }) => {
      if (input.command === 'git' && input.args[0] === 'rev-parse') {
        return { stdout: `${sourceSha}\n`, stderr: '' };
      }

      if (input.command === 'git' && input.args[0] === 'tag') {
        return {
          stdout: [`v${previousStableVersion}`, `v${previousReleaseCandidateVersion}`].join('\n'),
          stderr: '',
        };
      }

      if (input.command === 'gh') {
        const releases = [
          githubRelease,
          ...(options.duplicateGithubRelease ? [githubRelease] : []),
        ];
        return { stdout: JSON.stringify([releases]), stderr: '' };
      }

      if (input.command === 'git' && input.args[0] === 'ls-remote') {
        const remoteTagSha =
          options.remoteTagSha === undefined
            ? publicationState === 'published'
              ? sourceSha
              : null
            : options.remoteTagSha;
        return {
          stdout: remoteTagSha ? `${remoteTagSha}\trefs/tags/v${version}\n` : '',
          stderr: '',
        };
      }

      if (input.command === 'pnpm') {
        return {
          stdout: `${options.createEntrypointVersion ?? version}\n`,
          stderr: '',
        };
      }

      throw new Error(`Unexpected command: ${input.command} ${input.args.join(' ')}`);
    },
  );
  let output = '';
  const wait = vi.fn(async () => {});
  const reproduceReleaseSet = vi.fn(async () => ({
    sourceSha,
    version,
    artifactPaths: local.artifactPaths,
    packages: local.packages,
  }));
  const execute = (args: readonly string[] = ['--source-sha', sourceSha, '--version', version]) =>
    runReleaseVerificationCommand({
      args,
      workspaceRoot,
      write(message) {
        output += message;
      },
      runNpmCommand,
      runCommand,
      wait,
      reproduceReleaseSet,
    });

  return {
    execute,
    getOutput: () => output,
    runNpmCommand,
    runCommand,
    wait,
    reproduceReleaseSet,
  };
}

function nextActions(output: string): string[] {
  return output.split('\n').filter((line) => line.startsWith('Next action:'));
}

describe('release:verify command', () => {
  test.each([
    ['Stable', '0.4.0', 'latest'],
    ['RC', '0.4.0-rc.3', 'next'],
  ] as const)(
    'derives the %s channel and verifies a fully private Release Set',
    async (channel, version, finalTag) => {
      const harness = await createVerificationHarness(['private', 'private', 'private'], {
        version,
      });

      await expect(harness.execute()).resolves.toBe(0);

      const output = harness.getOutput();
      expect(output).toContain(`Channel: ${channel}`);
      expect(output).toContain(`Final npm tag: ${finalTag}`);
      expect(output).toContain('State: fully private');
      expect(nextActions(output)).toEqual([
        `Next action: Approve @tenkit/template-generator@${version} with npm 2FA, then rerun this command.`,
      ]);
      expect(harness.reproduceReleaseSet).toHaveBeenCalledWith(
        expect.objectContaining({ sourceSha, version }),
      );
    },
  );

  test.each([
    ['0.4.0', ['private', 'private', 'private'], '@tenkit/template-generator'],
    ['0.4.0', ['public', 'private', 'private'], '@tenkit/cli'],
    ['0.4.0', ['public', 'public', 'private'], 'create-tenkit'],
    ['0.4.0-rc.3', ['private', 'private', 'private'], '@tenkit/template-generator'],
    ['0.4.0-rc.3', ['public', 'private', 'private'], '@tenkit/cli'],
    ['0.4.0-rc.3', ['public', 'public', 'private'], 'create-tenkit'],
  ] as const)(
    'accepts %s dependency prefix %j and names only %s',
    async (version, states, nextPackage) => {
      const harness = await createVerificationHarness(states, { version });

      await expect(harness.execute()).resolves.toBe(0);
      expect(nextActions(harness.getOutput())).toEqual([
        `Next action: Approve ${nextPackage}@${version} with npm 2FA, then rerun this command.`,
      ]);
    },
  );

  test.each([
    ['0.4.0', 'latest', false],
    ['0.4.0-rc.3', 'next', true],
  ] as const)(
    'verifies complete public %s and points only to the matching GitHub draft',
    async (version, finalTag, prerelease) => {
      const harness = await createVerificationHarness(['public', 'public', 'public'], { version });

      await expect(harness.execute()).resolves.toBe(0);

      const output = harness.getOutput();
      expect(output).toContain('State: complete public');
      expect(output).toContain(`Final npm tag: ${finalTag}`);
      expect(output).toContain(
        `GitHub Release: matching ${prerelease ? 'prerelease' : 'normal'} draft`,
      );
      expect(nextActions(output)).toEqual([
        `Next action: Publish the existing GitHub draft v${version}, then rerun this command.`,
      ]);
      expect(harness.runCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'pnpm',
          args: expect.arrayContaining([`tenkit@${version}`, '--version']),
        }),
      );
    },
  );

  test.each([
    ['0.4.0', 'Run pnpm create tenkit@latest --version outside this workspace'],
    ['0.4.0-rc.3', 'Release Set publication is complete; no release mutation remains'],
  ] as const)(
    'verifies published %s npm and Git/GitHub identity',
    async (version, expectedNextAction) => {
      const harness = await createVerificationHarness(['public', 'public', 'public'], {
        version,
        publicationState: 'published',
      });

      await expect(harness.execute()).resolves.toBe(0);

      const output = harness.getOutput();
      expect(output).toContain('State: published');
      expect(output).toContain(`Git tag: v${version} -> ${sourceSha}`);
      expect(nextActions(output)).toEqual([`Next action: ${expectedNextAction}.`]);
    },
  );

  test.each([
    ['private', 'public', 'private'],
    ['private', 'private', 'public'],
    ['public', 'private', 'public'],
  ] as const)('rejects out-of-order public graph %j without approval advice', async (...states) => {
    const harness = await createVerificationHarness(states);

    await expect(harness.execute()).rejects.toThrow(/approval order/i);
    expect(nextActions(harness.getOutput())).toEqual([]);
  });

  test.each([
    [
      'wrong final stage tag',
      ['private', 'private', 'private'] as const,
      { stageOverrides: { '@tenkit/template-generator': { tag: 'next' } } },
      /stage expected tag latest, found next/,
    ],
    [
      'mixed selected final tags',
      ['public', 'public', 'public'] as const,
      { distTagOverrides: { '@tenkit/cli': { latest: '0.3.0' } } },
      /@tenkit\/cli latest tag expected 0\.4\.0, found 0\.3\.0/,
    ],
    [
      'moved untouched channel',
      ['public', 'public', 'public'] as const,
      { distTagOverrides: { '@tenkit/cli': { next: '0.4.0-rc.1' } } },
      /@tenkit\/cli next tag expected 0\.4\.0-rc\.2, found 0\.4\.0-rc\.1/,
    ],
    [
      'Stable version under next',
      ['public', 'public', 'public'] as const,
      { distTagOverrides: { '@tenkit/template-generator': { next: '0.4.0' } } },
      /next tag must point to a genuine RC version/,
    ],
    [
      'next equal to latest',
      ['public', 'public', 'public'] as const,
      { distTagOverrides: { '@tenkit/template-generator': { next: '0.4.0' } } },
      /next tag must point to a genuine RC version|next and latest must differ/,
    ],
    [
      'unexpected stage actor',
      ['private', 'private', 'private'] as const,
      { stageOverrides: { '@tenkit/template-generator': { actor: 'other-automation' } } },
      /unexpected actor/,
    ],
    [
      'duplicate same-version stages',
      ['private', 'private', 'private'] as const,
      { duplicateStageFor: '@tenkit/template-generator' },
      /Found 2 private stages/,
    ],
    [
      'same-version stage beside a public package',
      ['public', 'private', 'private'] as const,
      { unexpectedPublicStageFor: '@tenkit/template-generator' },
      /Unexpected same-version npm stage/,
    ],
  ] as const)('stops on %s', async (_label, states, options, expectedMessage) => {
    const harness = await createVerificationHarness(states, options);

    await expect(harness.execute()).rejects.toThrow(expectedMessage);
    expect(nextActions(harness.getOutput())).toEqual([]);
  });

  test.each([
    [
      'changed reproduced bytes',
      {
        reproductionArtifactMutations: {
          '@tenkit/template-generator': { content: 'bytes from a different source\n' },
        },
      },
      /local integrity mismatch/,
    ],
    [
      'changed npm-hosted bytes',
      {
        registryArtifactMutations: {
          '@tenkit/template-generator': { content: 'changed registry bytes\n' },
        },
      },
      /local integrity mismatch/,
    ],
    [
      'changed npm-hosted package identity',
      { registryArtifactMutations: { '@tenkit/cli': { name: '@tenkit/not-cli' } } },
      /expected @tenkit\/cli/,
    ],
    [
      'changed npm-hosted package version',
      { registryArtifactMutations: { '@tenkit/cli': { version: '0.4.1' } } },
      /expected version 0\.4\.0/,
    ],
    [
      'changed npm-hosted dependency pin',
      {
        registryArtifactMutations: {
          '@tenkit/cli': { internalDependencyVersion: '0.4.1' },
        },
      },
      /@tenkit\/template-generator expected 0\.4\.0/,
    ],
    [
      'changed public metadata dependency pin',
      {
        publicMetadataOverrides: {
          '@tenkit/cli': { dependencies: { '@tenkit/template-generator': '0.4.1' } },
        },
      },
      /@tenkit\/template-generator expected 0\.4\.0/,
    ],
    [
      'wrong embedded Public CLI version',
      {
        sharedArtifactMutations: {
          '@tenkit/cli': { embeddedCliVersion: '0.4.1' },
        },
      },
      /embedded Public CLI version expected 0\.4\.0, found 0\.4\.1/,
    ],
    [
      'forged public integrity',
      {
        publicDigestOverrides: {
          '@tenkit/template-generator': {
            integrity: `sha512-${Buffer.alloc(64, 1).toString('base64')}`,
          },
        },
      },
      /public integrity mismatch/,
    ],
    [
      'forged public shasum',
      {
        publicDigestOverrides: {
          '@tenkit/template-generator': {
            shasum: '0000000000000000000000000000000000000000',
          },
        },
      },
      /public shasum mismatch/,
    ],
  ] as const)('stops on %s', async (_label, options, expectedMessage) => {
    const harness = await createVerificationHarness(['public', 'public', 'public'], options);

    await expect(harness.execute()).rejects.toThrow(expectedMessage);
  });

  test('stops on a forged private-stage shasum', async () => {
    const harness = await createVerificationHarness(['private', 'private', 'private'], {
      stageOverrides: {
        '@tenkit/template-generator': { shasum: '0000000000000000000000000000000000000000' },
      },
    });

    await expect(harness.execute()).rejects.toThrow(/npm stage shasum mismatch/);
  });

  test.each([
    [
      'mismatched source',
      { githubReleaseOverrides: { target_commitish: 'f'.repeat(40) } },
      undefined,
    ],
    ['wrong release type', { githubReleaseOverrides: { prerelease: true } }, undefined],
    ['duplicate releases', { duplicateGithubRelease: true }, undefined],
    [
      'wrong remote tag',
      { publicationState: 'published', remoteTagSha: 'f'.repeat(40) },
      undefined,
    ],
    ['tag beside a draft', { remoteTagSha: sourceSha }, undefined],
    [
      'published release before npm completion',
      { publicationState: 'published' },
      ['public', 'private', 'private'] as const,
    ],
  ] as const)('stops on mismatched GitHub state: %s', async (_label, options, states) => {
    const harness = await createVerificationHarness(
      states ?? (['public', 'public', 'public'] as const),
      options,
    );

    await expect(harness.execute()).rejects.toThrow(/GitHub|Git tag|published release/i);
    expect(nextActions(harness.getOutput())).toEqual([]);
  });

  test('rejects an exact-version create entrypoint that reports another version', async () => {
    const harness = await createVerificationHarness(['public', 'public', 'public'], {
      createEntrypointVersion: '0.4.1',
    });

    await expect(harness.execute()).rejects.toThrow(
      /create-tenkit did not report exact version 0\.4\.0/,
    );
  });

  test('retries a transient public-package visibility gap within the bounded read window', async () => {
    const harness = await createVerificationHarness(['public', 'public', 'public'], {
      transientMissingReads: { '@tenkit/template-generator': 1 },
    });

    await expect(harness.execute()).resolves.toBe(0);
    expect(harness.wait).toHaveBeenCalledTimes(1);
  });

  test.each(['0.4.0', '0.4.0-rc.3'])(
    'retries when %s public metadata becomes visible before its final dist-tag',
    async (version) => {
      const harness = await createVerificationHarness(['public', 'public', 'public'], {
        version,
        transientSelectedTagReads: { '@tenkit/template-generator': 1 },
      });

      await expect(harness.execute()).resolves.toBe(0);
      expect(harness.wait).toHaveBeenCalledTimes(1);
    },
  );

  test('stops with recovery evidence after the bounded read window is exhausted', async () => {
    const harness = await createVerificationHarness(['missing', 'private', 'private']);

    await expect(harness.execute()).rejects.toThrow(
      /after 4 read attempts.*Stop and inspect npm public, staged, and dist-tag state/i,
    );
    expect(harness.wait).toHaveBeenCalledTimes(3);
    expect(nextActions(harness.getOutput())).toEqual([]);
  });

  test.each([
    [
      'a channel argument',
      ['--source-sha', sourceSha, '--version', '0.4.0', '--channel', 'stable'],
    ],
    ['an invalid prerelease', ['--source-sha', sourceSha, '--version', '0.4.0-beta.1']],
    ['RC zero', ['--source-sha', sourceSha, '--version', '0.4.0-rc.0']],
    ['a short SHA', ['--source-sha', '041f79e', '--version', '0.4.0']],
  ] as const)('rejects %s', async (_label, args) => {
    await expect(
      runReleaseVerificationCommand({
        args,
        workspaceRoot,
        write() {},
      }),
    ).rejects.toThrow(/Usage: pnpm release:verify|exact Stable or RC|full lowercase source SHA/);
  });

  test('uses only read-only npm, GitHub, and Git commands', async () => {
    const harness = await createVerificationHarness(['public', 'public', 'public']);

    await expect(harness.execute()).resolves.toBe(0);

    const npmArgs = harness.runNpmCommand.mock.calls.map(([input]) => [...input.args]);
    expect(npmArgs).not.toEqual(
      expect.arrayContaining([
        expect.arrayContaining(['publish']),
        expect.arrayContaining(['approve']),
        expect.arrayContaining(['reject']),
        expect.arrayContaining(['dist-tag']),
      ]),
    );
    const commands = harness.runCommand.mock.calls.map(([input]) =>
      [input.command, ...input.args].join(' '),
    );
    expect(commands.join('\n')).not.toMatch(
      /\b(?:release create|release edit|stage approve|dist-tag add|git push|git tag -[as])\b/,
    );
  });

  test('queries npmjs regardless of inherited npm registry configuration', async () => {
    const harness = await createVerificationHarness(['private', 'private', 'private']);

    await expect(harness.execute()).resolves.toBe(0);

    for (const [input] of harness.runNpmCommand.mock.calls) {
      if (input.args[0] !== '--version') {
        expect(input.args).toContain('https://registry.npmjs.org/');
      }
    }
  });
});
