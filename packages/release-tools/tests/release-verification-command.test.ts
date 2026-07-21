import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

import { afterEach, describe, expect, test, vi } from 'vitest';

import { inspectReleaseArtifact } from '../src/release-artifacts';
import { runReleaseVerificationCommand } from '../src/release-verification-command';
import { RELEASE_SET_PACKAGES } from '../src/release-set';

const sourceSha = '041f79e50ff5e84f5883be026201bde10f77f93e';
const version = '0.3.0';
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
  content?: string;
};

async function writeReleaseArtifacts(
  mutations: Partial<Record<(typeof RELEASE_SET_PACKAGES)[number]['name'], ArtifactMutation>> = {},
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
    const fixedTime = new Date('2026-01-01T00:00:00.000Z');
    await utimes(join(packageRoot, 'package.json'), fixedTime, fixedTime);
    await utimes(join(packageRoot, 'README.md'), fixedTime, fixedTime);
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
  mutations: Partial<Record<(typeof RELEASE_SET_PACKAGES)[number]['name'], ArtifactMutation>> = {},
): Promise<{
  artifactPaths: string[];
  packages: Awaited<ReturnType<typeof inspectReleaseArtifact>>[];
}> {
  const artifactPaths = await writeReleaseArtifacts(mutations);

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
type ReleasePackageName = (typeof RELEASE_SET_PACKAGES)[number]['name'];

type VerificationHarnessOptions = {
  stageOverrides?: Partial<Record<ReleasePackageName, Record<string, unknown>>>;
  viewedStageOverrides?: Partial<Record<ReleasePackageName, Record<string, unknown>>>;
  duplicateStageFor?: ReleasePackageName;
  unexpectedPublicStageFor?: ReleasePackageName;
  publicMetadataOverrides?: Partial<Record<ReleasePackageName, Record<string, unknown>>>;
  publicDigestOverrides?: Partial<
    Record<ReleasePackageName, Partial<{ integrity: string; shasum: string }>>
  >;
  candidateVersions?: Partial<Record<ReleasePackageName, string>>;
  reproductionArtifactMutations?: Partial<Record<ReleasePackageName, ArtifactMutation>>;
  registryArtifactMutations?: Partial<Record<ReleasePackageName, ArtifactMutation>>;
};

async function createVerificationHarness(
  states: readonly [RegistryState, RegistryState, RegistryState],
  options: VerificationHarnessOptions = {},
) {
  const local = await createReleaseArtifacts(options.reproductionArtifactMutations);
  const registryArtifactPaths =
    options.registryArtifactMutations || options.reproductionArtifactMutations
      ? await writeReleaseArtifacts(options.registryArtifactMutations)
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
                  tag: 'candidate',
                  createdAt: '2026-07-20T09:00:00.000Z',
                  actor: 'tenkit-release',
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
                        tag: 'candidate',
                        createdAt: '2026-07-20T09:01:00.000Z',
                        actor: 'tenkit-release',
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
  const runNpmCommand = vi.fn(async (input: { args: readonly string[]; cwd: string }) => {
    const args = [...input.args];

    if (args[0] === '--version') {
      return { exitCode: 0, stdout: '11.17.0\n', stderr: '' };
    }

    if (args[0] === 'view' && args[1]?.includes(`@${version}`)) {
      const index = RELEASE_SET_PACKAGES.findIndex(
        (releasePackage) => `${releasePackage.name}@${version}` === args[1],
      );

      if (index >= 0 && states[index] === 'public') {
        const releasePackage = RELEASE_SET_PACKAGES[index]!;
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            name: releasePackage.name,
            version,
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

      return { exitCode: 1, stdout: '', stderr: 'npm error code E404' };
    }

    if (args[0] === 'view' && args[2] === 'dist-tags.candidate') {
      const packageName = args[1] as ReleasePackageName;
      return {
        exitCode: 0,
        stdout: JSON.stringify(options.candidateVersions?.[packageName] ?? version),
        stderr: '',
      };
    }

    if (args[0] === 'stage' && args[1] === 'list') {
      return {
        exitCode: 0,
        stdout: JSON.stringify(stages.get(args[2] as ReleasePackageName) ?? []),
        stderr: '',
      };
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
  let output = '';
  const execute = () =>
    runReleaseVerificationCommand({
      args: ['--source-sha', sourceSha, '--version', version],
      workspaceRoot,
      write(message) {
        output += message;
      },
      runNpmCommand,
      reproduceReleaseSet: vi.fn(async () => ({
        sourceSha,
        version,
        artifactPaths: local.artifactPaths,
        packages: local.packages,
      })),
    });

  return { execute, getOutput: () => output, runNpmCommand };
}

describe('release:verify command', () => {
  test('verifies a fully private Release Set and prints the first safe approval', async () => {
    const local = await createReleaseArtifacts();
    const stages = new Map(
      RELEASE_SET_PACKAGES.map((releasePackage, index) => [
        releasePackage.name,
        {
          id: stageId(index),
          packageName: releasePackage.name,
          version,
          tag: 'candidate',
          createdAt: '2026-07-20T09:00:00.000Z',
          actor: 'tenkit-release',
          actorType: 'trusted automation',
          access: 'public',
          shasum: local.packages[index]!.shasum,
        },
      ]),
    );
    const runNpmCommand = vi.fn(async (input: { args: readonly string[]; cwd: string }) => {
      const args = [...input.args];

      if (args[0] === '--version') {
        return { exitCode: 0, stdout: '11.17.0\n', stderr: '' };
      }

      if (args[0] === 'view') {
        return { exitCode: 1, stdout: '', stderr: 'npm error code E404' };
      }

      if (args[0] === 'stage' && args[1] === 'list') {
        return {
          exitCode: 0,
          stdout: JSON.stringify([
            stages.get(args[2] as (typeof RELEASE_SET_PACKAGES)[number]['name']),
          ]),
          stderr: '',
        };
      }

      if (args[0] === 'stage' && args[1] === 'view') {
        return {
          exitCode: 0,
          stdout: JSON.stringify([...stages.values()].find((stage) => stage.id === args[2])),
          stderr: '',
        };
      }

      if (args[0] === 'stage' && args[1] === 'download') {
        const index = RELEASE_SET_PACKAGES.findIndex(
          (releasePackage) => stages.get(releasePackage.name)?.id === args[2],
        );
        const releasePackage = RELEASE_SET_PACKAGES[index]!;
        const filename = `${releasePackage.name.replace('@', '').replace('/', '-')}-${version}-${args[2]}.tgz`;
        await writeFile(join(input.cwd, filename), await readFile(local.artifactPaths[index]!));
        return { exitCode: 0, stdout: `${filename}\n`, stderr: '' };
      }

      return { exitCode: 1, stdout: '', stderr: `Unexpected npm command: ${args.join(' ')}` };
    });
    let output = '';

    await expect(
      runReleaseVerificationCommand({
        args: ['--', '--source-sha', sourceSha, '--version', version],
        workspaceRoot,
        write(message) {
          output += message;
        },
        runNpmCommand,
        reproduceReleaseSet: vi.fn(async () => ({
          sourceSha,
          version,
          artifactPaths: local.artifactPaths,
          packages: local.packages,
        })),
      }),
    ).resolves.toBe(0);

    expect(output).toContain('Release Verification: PASS');
    expect(output).toContain('State: fully private');
    expect(output).toContain('Next approval: @tenkit/template-generator');
    expect(output).toContain(`npm stage approve ${stageId(0)}`);
    expect(output).toContain(`integrity: ${local.packages[0]!.integrity}`);
    expect(output).toContain(`shasum: ${local.packages[0]!.shasum}`);
    expect(runNpmCommand.mock.calls.map(([input]) => input.args.slice(0, 2))).not.toContainEqual([
      'stage',
      'approve',
    ]);
  });

  test('revalidates a partial Candidate and prints the next private approval', async () => {
    const local = await createReleaseArtifacts();
    const privateStages = new Map(
      RELEASE_SET_PACKAGES.slice(1).map((releasePackage, offset) => {
        const index = offset + 1;
        return [
          releasePackage.name,
          {
            id: stageId(index),
            packageName: releasePackage.name,
            version,
            tag: 'candidate',
            createdAt: '2026-07-20T09:00:00.000Z',
            actor: 'tenkit-release',
            actorType: 'trusted automation',
            access: 'public',
            shasum: local.packages[index]!.shasum,
          },
        ] as const;
      }),
    );
    const runNpmCommand = vi.fn(async (input: { args: readonly string[]; cwd: string }) => {
      const args = [...input.args];

      if (args[0] === '--version') {
        return { exitCode: 0, stdout: '11.17.0\n', stderr: '' };
      }

      if (args[0] === 'view' && args[1] === `@tenkit/template-generator@${version}`) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            name: '@tenkit/template-generator',
            version,
            dependencies: {},
            dist: {
              integrity: local.packages[0]!.integrity,
              shasum: local.packages[0]!.shasum,
            },
          }),
          stderr: '',
        };
      }

      if (
        args[0] === 'view' &&
        args[1] === '@tenkit/template-generator' &&
        args[2] === 'dist-tags.candidate'
      ) {
        return { exitCode: 0, stdout: JSON.stringify(version), stderr: '' };
      }

      if (args[0] === 'view') {
        return { exitCode: 1, stdout: '', stderr: 'npm error code E404' };
      }

      if (args[0] === 'pack') {
        await writeFile(
          join(input.cwd, `tenkit-template-generator-${version}.tgz`),
          await readFile(local.artifactPaths[0]!),
        );
        return {
          exitCode: 0,
          stdout: JSON.stringify([{ filename: `tenkit-template-generator-${version}.tgz` }]),
          stderr: '',
        };
      }

      if (args[0] === 'stage' && args[1] === 'list') {
        const stage = privateStages.get(args[2] as (typeof RELEASE_SET_PACKAGES)[number]['name']);
        return { exitCode: 0, stdout: JSON.stringify(stage ? [stage] : []), stderr: '' };
      }

      if (args[0] === 'stage' && args[1] === 'view') {
        return {
          exitCode: 0,
          stdout: JSON.stringify([...privateStages.values()].find((stage) => stage.id === args[2])),
          stderr: '',
        };
      }

      if (args[0] === 'stage' && args[1] === 'download') {
        const index = RELEASE_SET_PACKAGES.findIndex(
          (releasePackage) => privateStages.get(releasePackage.name)?.id === args[2],
        );
        const releasePackage = RELEASE_SET_PACKAGES[index]!;
        const filename = `${releasePackage.name.replace('@', '').replace('/', '-')}-${version}-${args[2]}.tgz`;
        await writeFile(join(input.cwd, filename), await readFile(local.artifactPaths[index]!));
        return { exitCode: 0, stdout: `${filename}\n`, stderr: '' };
      }

      return { exitCode: 1, stdout: '', stderr: `Unexpected npm command: ${args.join(' ')}` };
    });
    let output = '';

    await expect(
      runReleaseVerificationCommand({
        args: ['--source-sha', sourceSha, '--version', version],
        workspaceRoot,
        write(message) {
          output += message;
        },
        runNpmCommand,
        reproduceReleaseSet: vi.fn(async () => ({
          sourceSha,
          version,
          artifactPaths: local.artifactPaths,
          packages: local.packages,
        })),
      }),
    ).resolves.toBe(0);

    expect(output).toContain('Release Verification: PASS');
    expect(output).toContain('State: partial Candidate');
    expect(output).toContain('@tenkit/template-generator: public Candidate');
    expect(output).toContain('Next approval: @tenkit/cli');
    expect(output).toContain(`npm stage approve ${stageId(1)}`);
  });

  test('stops when public Candidate state violates dependency approval order', async () => {
    const harness = await createVerificationHarness(['private', 'public', 'private']);

    await expect(harness.execute()).rejects.toThrow(/approval order/i);
  });

  test.each([
    [
      'wrong immutable stage tag',
      ['private', 'private', 'private'] as const,
      { stageOverrides: { '@tenkit/template-generator': { tag: 'latest' } } },
      /expected tag candidate, found latest/,
    ],
    [
      'unexpected stage actor',
      ['private', 'private', 'private'] as const,
      { stageOverrides: { '@tenkit/template-generator': { actor: 'other-automation' } } },
      /unexpected actor/,
    ],
    [
      'unexpected stage actor type',
      ['private', 'private', 'private'] as const,
      { stageOverrides: { '@tenkit/template-generator': { actorType: 'user' } } },
      /unexpected actor/,
    ],
    [
      'missing Release Set member',
      ['private', 'missing', 'private'] as const,
      {},
      /@tenkit\/cli@0\.3\.0.*missing, rejected, or replaced/,
    ],
    [
      'duplicate same-version stages',
      ['private', 'private', 'private'] as const,
      { duplicateStageFor: '@tenkit/template-generator' },
      /Found 2 private stages/,
    ],
    [
      'stage identity drift between list and view',
      ['private', 'private', 'private'] as const,
      {
        viewedStageOverrides: {
          '@tenkit/template-generator': { createdAt: '2026-07-20T09:02:00.000Z' },
        },
      },
      /stage identity changed/,
    ],
    [
      'unexpected stage beside a public Candidate',
      ['public', 'private', 'private'] as const,
      { unexpectedPublicStageFor: '@tenkit/template-generator' },
      /Unexpected same-version npm stage/,
    ],
    [
      'moved public candidate tag',
      ['public', 'private', 'private'] as const,
      { candidateVersions: { '@tenkit/template-generator': '0.2.0' } },
      /candidate tag expected 0\.3\.0, found 0\.2\.0/,
    ],
    [
      'forged public integrity',
      ['public', 'private', 'private'] as const,
      {
        publicMetadataOverrides: {
          '@tenkit/template-generator': {
            dist: {
              integrity: `sha512-${Buffer.alloc(64, 1).toString('base64')}`,
              shasum: '4f7f5f1d5bcf2f72f6e4d6c4f3b2812d8a2f6c19',
            },
          },
        },
      },
      /public integrity mismatch/,
    ],
    [
      'forged private shasum',
      ['private', 'private', 'private'] as const,
      {
        stageOverrides: {
          '@tenkit/template-generator': { shasum: '0000000000000000000000000000000000000000' },
        },
      },
      /npm stage shasum mismatch/,
    ],
    [
      'forged public shasum',
      ['public', 'private', 'private'] as const,
      {
        publicDigestOverrides: {
          '@tenkit/template-generator': {
            shasum: '0000000000000000000000000000000000000000',
          },
        },
      },
      /public shasum mismatch/,
    ],
  ] as const)('stops on %s', async (_label, states, options, expectedMessage) => {
    const harness = await createVerificationHarness(states, options);

    await expect(harness.execute()).rejects.toThrow(expectedMessage);
  });

  test('verifies a complete public Candidate and points to Candidate Smoke', async () => {
    const harness = await createVerificationHarness(['public', 'public', 'public']);

    await expect(harness.execute()).resolves.toBe(0);
    expect(harness.getOutput()).toContain('State: complete Candidate');
    expect(harness.getOutput()).toContain('Next action: pnpm release:smoke -- --version 0.3.0');
    expect(harness.getOutput()).not.toContain('npm stage approve');
  });

  test.each([
    [
      'a forged Draft source SHA that reproduces different bytes',
      {
        reproductionArtifactMutations: {
          '@tenkit/template-generator': { content: 'bytes from the forged source\n' },
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
      {
        registryArtifactMutations: {
          '@tenkit/cli': { name: '@tenkit/not-cli' },
        },
      },
      /expected @tenkit\/cli/,
    ],
    [
      'changed npm-hosted package version',
      {
        registryArtifactMutations: {
          '@tenkit/cli': { version: '0.3.1' },
        },
      },
      /expected version 0\.3\.0/,
    ],
    [
      'changed npm-hosted internal dependency',
      {
        registryArtifactMutations: {
          '@tenkit/cli': { internalDependencyVersion: '0.3.1' },
        },
      },
      /@tenkit\/template-generator expected 0\.3\.0/,
    ],
  ] as const)('stops on %s', async (_label, options, expectedMessage) => {
    const harness = await createVerificationHarness(['private', 'private', 'private'], options);

    await expect(harness.execute()).rejects.toThrow(expectedMessage);
  });

  test.each([
    ['stage ID', ['--stage-id', stageId(0)]],
    ['integrity', ['--integrity', 'sha512-forged']],
    ['shasum', ['--shasum', 'forged']],
  ] as const)('rejects Draft-reported %s as command input', async (_label, draftArgs) => {
    await expect(
      runReleaseVerificationCommand({
        args: ['--source-sha', sourceSha, '--version', version, ...draftArgs],
        workspaceRoot,
        write() {},
      }),
    ).rejects.toThrow(/Usage: pnpm release:verify/);
  });

  test('downloads every private stage using only read-only npm commands', async () => {
    const harness = await createVerificationHarness(['private', 'private', 'private']);

    await expect(harness.execute()).resolves.toBe(0);
    const npmArgs = harness.runNpmCommand.mock.calls.map(([input]) => [...input.args]);
    const downloadArgs = npmArgs.filter((args) => args[0] === 'stage' && args[1] === 'download');
    expect(downloadArgs).toHaveLength(3);
    expect(downloadArgs.every((args) => args.includes('--json=false'))).toBe(true);
    expect(npmArgs).not.toEqual(
      expect.arrayContaining([
        expect.arrayContaining(['publish']),
        expect.arrayContaining(['approve']),
        expect.arrayContaining(['reject']),
        expect.arrayContaining(['dist-tag']),
      ]),
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
