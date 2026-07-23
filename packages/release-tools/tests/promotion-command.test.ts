import { resolve } from 'node:path';

import { describe, expect, test, vi } from 'vitest';

import { runPromotionCommand } from '../src/promotion-command';
import { RELEASE_SET_PACKAGES, type ReleaseSetPackageName } from '../src/release-set';
import type { RunReleaseCommandInput } from '../src/run-release-command';

const version = '0.3.0';
const previousVersion = '0.2.0';
const workspaceRoot = resolve(import.meta.dirname, '../../..');

type HarnessOptions = {
  apply?: boolean;
  candidateVersions?: Partial<Record<ReleaseSetPackageName, string>>;
  dependencyVersions?: Partial<Record<ReleaseSetPackageName, string>>;
  extraInternalDependencies?: Partial<Record<ReleaseSetPackageName, ReleaseSetPackageName>>;
  internalDependencySections?: Partial<
    Record<ReleaseSetPackageName, 'dependencies' | 'optionalDependencies' | 'peerDependencies'>
  >;
  latestVersions?: Partial<Record<ReleaseSetPackageName, string>>;
  mutateUnexpectedlyAfter?: ReleaseSetPackageName;
  mutateUnexpectedlyDuringConfirmation?: boolean;
};

function createHarness(options: HarnessOptions = {}) {
  const latestVersions: Record<ReleaseSetPackageName, string> = Object.fromEntries(
    RELEASE_SET_PACKAGES.map(({ name }) => [
      name,
      options.latestVersions?.[name] ?? previousVersion,
    ]),
  ) as Record<ReleaseSetPackageName, string>;
  const calls: Array<{ kind: 'read' | 'mutation'; input: RunReleaseCommandInput }> = [];
  let output = '';

  const runNpmCommand = vi.fn(async (input: RunReleaseCommandInput) => {
    calls.push({ kind: 'read', input });
    const packageName = input.args[1]!.slice(
      0,
      input.args[1]!.lastIndexOf('@'),
    ) as ReleaseSetPackageName;
    const releasePackage = RELEASE_SET_PACKAGES.find(({ name }) => name === packageName)!;
    const internalDependencySection =
      options.internalDependencySections?.[packageName] ?? 'dependencies';
    const extraInternalDependency = options.extraInternalDependencies?.[packageName];

    return {
      stdout: JSON.stringify({
        name: packageName,
        version,
        'dist-tags': {
          candidate: options.candidateVersions?.[packageName] ?? version,
          latest: latestVersions[packageName],
        },
        ...('internalDependency' in releasePackage
          ? {
              [internalDependencySection]: {
                [releasePackage.internalDependency]:
                  options.dependencyVersions?.[packageName] ?? version,
                ...(extraInternalDependency ? { [extraInternalDependency]: version } : {}),
              },
            }
          : {}),
      }),
      stderr: '',
    };
  });
  const runAuthenticatedNpmCommand = vi.fn(async (input: RunReleaseCommandInput) => {
    calls.push({ kind: 'mutation', input });
    const packageName = input.args[2]!.slice(
      0,
      input.args[2]!.lastIndexOf('@'),
    ) as ReleaseSetPackageName;
    latestVersions[packageName] = version;

    if (options.mutateUnexpectedlyAfter === packageName) {
      latestVersions['create-tenkit'] = '0.1.0';
    }

    return { stdout: '', stderr: '' };
  });
  const confirmApply = vi.fn(async () => {
    if (options.mutateUnexpectedlyDuringConfirmation) {
      latestVersions['create-tenkit'] = '0.1.0';
    }

    return true;
  });

  return {
    calls,
    confirmApply,
    execute: () =>
      runPromotionCommand({
        args: ['--version', version, ...(options.apply === true ? (['--apply'] as const) : [])],
        workspaceRoot,
        write(message) {
          output += message;
        },
        runNpmCommand,
        runAuthenticatedNpmCommand,
        confirmApply,
      }),
    getOutput: () => output,
  };
}

describe('release:promote command', () => {
  test('previews exact forward latest mutations without changing registry state', async () => {
    const harness = createHarness();

    await expect(harness.execute()).resolves.toBe(0);

    expect(harness.calls.every(({ kind }) => kind === 'read')).toBe(true);
    expect(harness.getOutput()).toContain('Promotion preview: PASS');
    expect(harness.getOutput()).toContain('Candidate tags: complete at 0.3.0');
    expect(harness.getOutput()).toContain('Internal dependencies: exact at 0.3.0');
    expect(harness.getOutput()).toContain('1. @tenkit/template-generator latest: 0.2.0 -> 0.3.0');
    expect(harness.getOutput()).toContain('2. @tenkit/cli latest: 0.2.0 -> 0.3.0');
    expect(harness.getOutput()).toContain('3. create-tenkit latest: 0.2.0 -> 0.3.0');
    expect(harness.getOutput()).toContain('Apply: pnpm release:promote -- --version 0.3.0 --apply');
  });

  test('applies and verifies latest mutations in dependency order without uploading bytes', async () => {
    const harness = createHarness({ apply: true });

    await expect(harness.execute()).resolves.toBe(0);

    const mutationCalls = harness.calls.filter(({ kind }) => kind === 'mutation');
    expect(harness.confirmApply).toHaveBeenCalledExactlyOnceWith(version);
    expect(mutationCalls.map(({ input }) => input.args)).toEqual(
      RELEASE_SET_PACKAGES.map(({ name }) => ['dist-tag', 'add', `${name}@${version}`, 'latest']),
    );

    for (const mutationCall of mutationCalls) {
      const mutationIndex = harness.calls.indexOf(mutationCall);
      const nextMutationIndex = harness.calls.findIndex(
        ({ kind }, index) => index > mutationIndex && kind === 'mutation',
      );
      const verificationWindow = harness.calls.slice(
        mutationIndex + 1,
        nextMutationIndex === -1 ? undefined : nextMutationIndex,
      );
      expect(verificationWindow.some(({ kind }) => kind === 'read')).toBe(true);
    }

    expect(
      harness.calls.some(({ input }) =>
        input.args.some((arg) => ['publish', 'pack', 'stage'].includes(arg)),
      ),
    ).toBe(false);
    expect(harness.getOutput()).toContain('Promotion apply: PASS');
    expect(harness.getOutput()).toContain('Manual Finalize:');
    expect(harness.getOutput()).toContain('Publish release');
  });

  test('resumes forward after an interrupted dependency-order prefix', async () => {
    const harness = createHarness({
      apply: true,
      latestVersions: { '@tenkit/template-generator': version },
    });

    await expect(harness.execute()).resolves.toBe(0);

    expect(
      harness.calls.filter(({ kind }) => kind === 'mutation').map(({ input }) => input.args[2]),
    ).toEqual(['@tenkit/cli@0.3.0', 'create-tenkit@0.3.0']);
    expect(harness.getOutput()).toContain('@tenkit/template-generator latest: already 0.3.0');
  });

  test.each([
    [
      'a mismatched Candidate tag',
      { candidateVersions: { '@tenkit/cli': previousVersion } },
      /candidate tag expected 0\.3\.0, found 0\.2\.0/,
    ],
    [
      'dependency drift',
      { dependencyVersions: { '@tenkit/cli': previousVersion } },
      /dependency @tenkit\/template-generator expected 0\.3\.0, found 0\.2\.0/,
    ],
    [
      'a misplaced internal dependency',
      { internalDependencySections: { '@tenkit/cli': 'peerDependencies' } },
      /must declare one direct dependency @tenkit\/template-generator/,
    ],
    [
      'an extra internal dependency',
      { extraInternalDependencies: { '@tenkit/cli': 'create-tenkit' } },
      /expected 1 internal Release Set dependencies, found 2/,
    ],
    [
      'an out-of-order latest state',
      { latestVersions: { '@tenkit/cli': version } },
      /latest state is not a dependency-order prefix/,
    ],
    [
      'a backward latest move',
      {
        latestVersions: {
          '@tenkit/template-generator': '0.4.0',
          '@tenkit/cli': '0.4.0',
          'create-tenkit': '0.4.0',
        },
      },
      /cannot move latest backward from 0\.4\.0 to 0\.3\.0/,
    ],
  ] as const)('stops before mutation on %s', async (_description, options, expectedError) => {
    const harness = createHarness({ apply: true, ...options });

    await expect(harness.execute()).rejects.toThrow(expectedError);
    expect(harness.calls.some(({ kind }) => kind === 'mutation')).toBe(false);
  });

  test('stops after a verified mutation exposes unexpected remaining latest state', async () => {
    const harness = createHarness({
      apply: true,
      mutateUnexpectedlyAfter: '@tenkit/template-generator',
    });

    await expect(harness.execute()).rejects.toThrow(/latest versions disagree/);
    expect(
      harness.calls.filter(({ kind }) => kind === 'mutation').map(({ input }) => input.args[2]),
    ).toEqual(['@tenkit/template-generator@0.3.0']);
  });

  test('revalidates registry state after confirmation before the first mutation', async () => {
    const harness = createHarness({
      apply: true,
      mutateUnexpectedlyDuringConfirmation: true,
    });

    await expect(harness.execute()).rejects.toThrow(/latest versions disagree/);
    expect(harness.calls.some(({ kind }) => kind === 'mutation')).toBe(false);
  });

  test('refuses environment token authentication before applying', async () => {
    vi.stubEnv('NPM_TOKEN', 'not-a-real-token');
    const harness = createHarness({ apply: true });

    try {
      await expect(harness.execute()).rejects.toThrow(
        /refuses automation authentication from NPM_TOKEN/,
      );
      expect(harness.calls.some(({ kind }) => kind === 'mutation')).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  test('requires an explicit exact version and apply flag shape', async () => {
    await expect(
      runPromotionCommand({
        args: ['--apply', '--version', version],
        workspaceRoot,
        write() {},
      }),
    ).rejects.toThrow(/Usage: pnpm release:promote/);
  });
});
