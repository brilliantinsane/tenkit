import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, test, vi } from 'vitest';

import {
  runCandidateSmokeCommand,
  type RunCandidateSmokeExternalCommand,
} from '../src/candidate-smoke-command';
import { RELEASE_SET_PACKAGES, type ReleaseSetPackageName } from '../src/release-set';

const version = '0.3.0';
const previousVersion = '0.2.0';
const workspaceRoot = resolve(import.meta.dirname, '../../..');

type HarnessOptions = {
  candidateVersions?: Partial<Record<ReleaseSetPackageName, string | undefined>>;
  dependencyVersions?: Partial<Record<ReleaseSetPackageName, string>>;
  failCommand?: 'npm launcher' | 'pnpm launcher' | 'bun launcher' | 'generation';
  latestVersions?: Partial<Record<ReleaseSetPackageName, string | undefined>>;
  publishedAt?: Partial<Record<ReleaseSetPackageName, string | undefined>>;
};

function createHarness(options: HarnessOptions = {}) {
  const calls: Array<Parameters<RunCandidateSmokeExternalCommand>[0]> = [];
  const runCommand = vi.fn<RunCandidateSmokeExternalCommand>(async (input) => {
    calls.push(input);

    if (input.command === 'npm' && input.args[0] === 'view') {
      const packageName = input.args[1]!.slice(0, -`@${version}`.length) as ReleaseSetPackageName;
      const releasePackage = RELEASE_SET_PACKAGES.find(({ name }) => name === packageName)!;
      const candidateVersion = Object.hasOwn(options.candidateVersions ?? {}, packageName)
        ? options.candidateVersions?.[packageName]
        : version;
      const latestVersion = Object.hasOwn(options.latestVersions ?? {}, packageName)
        ? options.latestVersions?.[packageName]
        : previousVersion;
      const publishedAt = Object.hasOwn(options.publishedAt ?? {}, packageName)
        ? options.publishedAt?.[packageName]
        : '2026-07-21T10:00:00.000Z';

      return {
        stdout: JSON.stringify({
          name: packageName,
          version,
          'dist-tags': {
            ...(candidateVersion === undefined ? {} : { candidate: candidateVersion }),
            ...(latestVersion === undefined ? {} : { latest: latestVersion }),
          },
          ...('internalDependency' in releasePackage
            ? {
                dependencies: {
                  [releasePackage.internalDependency]:
                    options.dependencyVersions?.[packageName] ?? version,
                },
              }
            : {}),
          time: publishedAt === undefined ? {} : { [version]: publishedAt },
        }),
        stderr: '',
      };
    }

    const isVersionLauncher = input.args.at(-1) === '--version';
    const launcherName = `${input.command} launcher` as HarnessOptions['failCommand'];

    if (isVersionLauncher) {
      if (options.failCommand === launcherName) {
        throw new Error(`${input.command} could not resolve the package`);
      }

      return { stdout: `${version}\n`, stderr: '' };
    }

    if (options.failCommand === 'generation') {
      throw new Error('create flow exited before writing the project');
    }

    const projectNameIndex = input.args.indexOf('--name');
    const projectName = input.args[projectNameIndex + 1]!;
    const targetDir = join(input.cwd, projectName);
    await mkdir(targetDir);
    await writeFile(
      join(targetDir, 'package.json'),
      `${JSON.stringify({ name: projectName, version: '1.0.0', private: true }, null, 2)}\n`,
    );
    return { stdout: `Created ${projectName}\n`, stderr: '' };
  });
  let output = '';

  return {
    calls,
    execute: () =>
      runCandidateSmokeCommand({
        args: ['--version', version],
        workspaceRoot,
        write(message) {
          output += message;
        },
        runCommand,
        now: () => new Date('2026-07-21T12:00:00.000Z'),
      }),
    getOutput: () => output,
  };
}

describe('release:smoke command', () => {
  test('proves one complete public Candidate through isolated exact-version launchers and generation', async () => {
    const harness = createHarness();

    await expect(harness.execute()).resolves.toBe(0);

    expect(harness.getOutput()).toContain('Candidate Smoke: PASS');
    expect(harness.getOutput()).toContain('Candidate tags: complete at 0.3.0');
    expect(harness.getOutput()).toContain('Internal dependencies: exact at 0.3.0');
    expect(harness.getOutput()).toContain('npm launcher: create-tenkit@0.3.0');
    expect(harness.getOutput()).toContain('pnpm launcher: create-tenkit@0.3.0');
    expect(harness.getOutput()).toContain('Bun launcher: create-tenkit@0.3.0');
    expect(harness.getOutput()).toContain(
      'Representative project: Runtime Tenant App with Bare Styling',
    );
    expect(harness.getOutput()).toContain('Package-age visibility: DELAYED');
    expect(harness.getOutput()).toContain('Waiting is optional');

    const launcherAndGenerationCalls = harness.calls.filter(
      ({ command, args }) => !(command === 'npm' && args[0] === 'view'),
    );
    expect(launcherAndGenerationCalls.map(({ command, args }) => [command, args])).toEqual([
      ['npm', ['create', 'tenkit@0.3.0', '--', '--version']],
      ['pnpm', ['--config.minimumReleaseAge=0', 'create', 'tenkit@0.3.0', '--version']],
      ['bun', ['x', 'create-tenkit@0.3.0', '--version']],
      [
        'npm',
        [
          'create',
          'tenkit@0.3.0',
          '--',
          '--name',
          'tenkit-candidate-smoke',
          '--setup',
          'runtime-tenants',
          '--styling',
          'bare',
          '--package-manager',
          'npm',
          '--yes',
          '--no-install',
          '--no-git',
        ],
      ],
    ]);
    expect(new Set(launcherAndGenerationCalls.map(({ cwd }) => cwd))).toHaveLength(4);

    for (const { cwd, env } of launcherAndGenerationCalls) {
      expect(cwd.startsWith(`${tmpdir()}/tenkit-candidate-smoke-`)).toBe(true);
      expect(cwd.startsWith(workspaceRoot)).toBe(false);
      expect(env?.INIT_CWD).toBe(cwd);
      expect(env?.npm_config_registry).toBe('https://registry.npmjs.org/');
    }

    expect(
      harness.calls.some(({ args }) =>
        args.some((arg) => ['publish', 'dist-tag', 'stage', 'release', 'tag'].includes(arg)),
      ),
    ).toBe(false);
  });

  test.each([
    ['missing', undefined],
    ['mismatched', previousVersion],
  ])('stops on a %s Candidate tag', async (_description, candidateVersion) => {
    const harness = createHarness({
      candidateVersions: { '@tenkit/cli': candidateVersion },
    });

    await expect(harness.execute()).rejects.toThrow(
      /Candidate tags: incomplete for @tenkit\/cli@0\.3\.0/,
    );
  });

  test('stops when public package metadata has dependency drift', async () => {
    const harness = createHarness({
      dependencyVersions: { '@tenkit/cli': previousVersion },
    });

    await expect(harness.execute()).rejects.toThrow(
      'Dependency drift: @tenkit/cli@0.3.0 must depend on @tenkit/template-generator@0.3.0, found 0.2.0.',
    );
  });

  test.each([
    [
      'Promotion already moved latest',
      { '@tenkit/template-generator': version, '@tenkit/cli': version, 'create-tenkit': version },
      /latest already points to 0\.3\.0/,
    ],
    [
      'latest tags do not identify one previous Release Set',
      { '@tenkit/cli': '0.1.0' },
      /latest does not identify one coherent previous Release Set/,
    ],
  ] as const)('stops when %s', async (_description, latestVersions, expectedError) => {
    const harness = createHarness({ latestVersions });

    await expect(harness.execute()).rejects.toThrow(expectedError);
  });

  test.each(['npm launcher', 'pnpm launcher', 'bun launcher'] as const)(
    'distinguishes %s resolution failure',
    async (failCommand) => {
      const harness = createHarness({ failCommand });

      await expect(harness.execute()).rejects.toThrow(/Launcher resolution \((?:npm|pnpm|Bun)\):/);
    },
  );

  test('distinguishes representative generation failure', async () => {
    const harness = createHarness({ failCommand: 'generation' });

    await expect(harness.execute()).rejects.toThrow(
      /Generated output: representative Candidate create flow failed/,
    );
  });

  test('distinguishes unavailable package-age visibility metadata', async () => {
    const harness = createHarness({
      publishedAt: { 'create-tenkit': undefined },
    });

    await expect(harness.execute()).rejects.toThrow(
      /Package-age visibility: create-tenkit@0\.3\.0 has no valid public publication timestamp/,
    );
  });
});
