import { describe, expect, test } from 'vitest';

import { planReleaseSet } from '../src/release-plan';

describe('Release Set planning', () => {
  test('treats commit 3a10d24 as a minor signal because it changed a public package root', () => {
    expect(
      planReleaseSet({
        sourceSha: '3a10d24d0de14a4a0b175b58e046ecbc00a996f3',
        previousStableTag: {
          name: 'v0.2.0',
          version: '0.2.0',
          sha: 'a7d7a733e82d33f3a75f567756c96b247c54b155',
        },
        commits: [
          {
            sha: '3a10d24d0de14a4a0b175b58e046ecbc00a996f3',
            message: 'feat(playground): upgrade to Expo SDK 57 (#29)',
            paths: [
              'apps/playground/package.json',
              'apps/web/components/proof-section.tsx',
              'packages/template-generator/tests/generator.test.ts',
              'pnpm-lock.yaml',
            ],
          },
        ],
      }),
    ).toEqual({
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
          paths: [
            'apps/playground/package.json',
            'apps/web/components/proof-section.tsx',
            'packages/template-generator/tests/generator.test.ts',
            'pnpm-lock.yaml',
          ],
          impact: 'minor',
        },
      ],
    });
  });

  test.each([
    'packages/template-generator/README.md',
    'packages/cli/src/cli.ts',
    'packages/create-tenkit/package.json',
  ])('treats %s as release-relevant', (path) => {
    const plan = planReleaseSet({
      sourceSha: '2222222222222222222222222222222222222222',
      previousStableTag: {
        name: 'v1.2.3',
        version: '1.2.3',
        sha: '1111111111111111111111111111111111111111',
      },
      commits: [
        {
          sha: '2222222222222222222222222222222222222222',
          message: 'fix(release-set): preserve public behavior',
          paths: [path],
        },
      ],
    });

    expect(plan.kind).toBe('release');
    expect(plan.kind === 'release' ? plan.version : undefined).toBe('1.2.4');
  });

  test.each([
    { paths: ['apps/web/app/page.tsx'] },
    { paths: ['packages/release-tools/src/release-plan.ts'] },
    { paths: ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.nvmrc'] },
  ])('returns no release for excluded paths: $paths', ({ paths }) => {
    expect(
      planReleaseSet({
        sourceSha: '2222222222222222222222222222222222222222',
        previousStableTag: {
          name: 'v1.2.3',
          version: '1.2.3',
          sha: '1111111111111111111111111111111111111111',
        },
        commits: [
          {
            sha: '2222222222222222222222222222222222222222',
            message: 'feat(workspace): change excluded behavior',
            paths,
          },
        ],
      }),
    ).toEqual({
      kind: 'no-release',
      sourceSha: '2222222222222222222222222222222222222222',
      previousStableTag: {
        name: 'v1.2.3',
        version: '1.2.3',
        sha: '1111111111111111111111111111111111111111',
      },
    });
  });

  test('keeps a mixed commit relevant and lets the highest semantic impact win', () => {
    const plan = planReleaseSet({
      sourceSha: '4444444444444444444444444444444444444444',
      previousStableTag: {
        name: 'v1.2.3',
        version: '1.2.3',
        sha: '1111111111111111111111111111111111111111',
      },
      commits: [
        {
          sha: '2222222222222222222222222222222222222222',
          message: 'fix(cli): repair creation',
          paths: ['packages/cli/src/cli.ts'],
        },
        {
          sha: '3333333333333333333333333333333333333333',
          message: 'feat(web): add UI and generated capability',
          paths: ['apps/web/app/page.tsx', 'packages/template-generator/src/generator.ts'],
        },
        {
          sha: '4444444444444444444444444444444444444444',
          message: 'chore(workspace): refresh lockfile',
          paths: ['pnpm-lock.yaml'],
        },
      ],
    });

    expect(plan.kind).toBe('release');
    expect(plan.kind === 'release' ? plan.version : undefined).toBe('1.3.0');
    expect(plan.kind === 'release' ? plan.contributingCommits : []).toHaveLength(2);
  });

  test('fixes forward from a partially public version through reviewed Git history', () => {
    const plan = planReleaseSet({
      sourceSha: '3333333333333333333333333333333333333333',
      previousStableTag: {
        name: 'v0.2.0',
        version: '0.2.0',
        sha: '1111111111111111111111111111111111111111',
      },
      commits: [
        {
          sha: '2222222222222222222222222222222222222222',
          message: 'feat(cli): add generated choices',
          paths: ['packages/cli/src/cli.ts'],
        },
        {
          sha: '3333333333333333333333333333333333333333',
          message: 'fix(cli): repair generated choices\n\nRelease-Fix-Forward: 0.3.0',
          paths: ['packages/cli/src/cli.ts'],
        },
      ],
    });

    expect(plan).toEqual(
      expect.objectContaining({
        kind: 'release',
        version: '0.3.1',
        fixForwardFromVersion: '0.3.0',
      }),
    );
  });

  test('accepts fix-forward alongside another terminal commit trailer', () => {
    const plan = planReleaseSet({
      sourceSha: '3333333333333333333333333333333333333333',
      previousStableTag: {
        name: 'v0.2.0',
        version: '0.2.0',
        sha: '1111111111111111111111111111111111111111',
      },
      commits: [
        {
          sha: '2222222222222222222222222222222222222222',
          message: 'feat(cli): add generated choices',
          paths: ['packages/cli/src/cli.ts'],
        },
        {
          sha: '3333333333333333333333333333333333333333',
          message:
            'fix(cli): repair generated choices\n\nRelease-Fix-Forward: 0.3.0\nSigned-off-by: Maintainer <maintainer@example.com>',
          paths: ['packages/cli/src/cli.ts'],
        },
      ],
    });

    expect(plan).toEqual(
      expect.objectContaining({
        kind: 'release',
        version: '0.3.1',
        fixForwardFromVersion: '0.3.0',
      }),
    );
  });

  test('continues fix-forward versioning after another partially public attempt', () => {
    const plan = planReleaseSet({
      sourceSha: '4444444444444444444444444444444444444444',
      previousStableTag: {
        name: 'v0.2.0',
        version: '0.2.0',
        sha: '1111111111111111111111111111111111111111',
      },
      commits: [
        {
          sha: '2222222222222222222222222222222222222222',
          message: 'feat(cli): add generated choices',
          paths: ['packages/cli/src/cli.ts'],
        },
        {
          sha: '3333333333333333333333333333333333333333',
          message: 'fix(cli): repair generated choices\n\nRelease-Fix-Forward: 0.3.0',
          paths: ['packages/cli/src/cli.ts'],
        },
        {
          sha: '4444444444444444444444444444444444444444',
          message: 'fix(cli): repair the recovery\n\nRelease-Fix-Forward: 0.3.1',
          paths: ['packages/cli/src/cli.ts'],
        },
      ],
    });

    expect(plan).toEqual(
      expect.objectContaining({
        kind: 'release',
        version: '0.3.2',
        fixForwardFromVersion: '0.3.1',
      }),
    );
  });

  test.each([
    ['Release-Fix-Forward: next', /exact stable version/],
    ['Release-Fix-Forward: 0.1.9', /newer than 0\.2\.0/],
  ])('rejects invalid fix-forward trailer %s', (trailer, expectedMessage) => {
    expect(() =>
      planReleaseSet({
        sourceSha: '2222222222222222222222222222222222222222',
        previousStableTag: {
          name: 'v0.2.0',
          version: '0.2.0',
          sha: '1111111111111111111111111111111111111111',
        },
        commits: [
          {
            sha: '2222222222222222222222222222222222222222',
            message: `fix(cli): repair release\n\n${trailer}`,
            paths: ['packages/cli/src/cli.ts'],
          },
        ],
      }),
    ).toThrow(expectedMessage);
  });

  test('rejects fix-forward text outside the final commit trailer block', () => {
    expect(() =>
      planReleaseSet({
        sourceSha: '2222222222222222222222222222222222222222',
        previousStableTag: {
          name: 'v0.2.0',
          version: '0.2.0',
          sha: '1111111111111111111111111111111111111111',
        },
        commits: [
          {
            sha: '2222222222222222222222222222222222222222',
            message:
              'fix(cli): repair release\n\nRelease-Fix-Forward: 0.3.0\n\nThis paragraph continues the commit body.',
            paths: ['packages/cli/src/cli.ts'],
          },
        ],
      }),
    ).toThrow(/final commit trailer block/);
  });

  test('rejects fix-forward without a blank separator before the trailer block', () => {
    expect(() =>
      planReleaseSet({
        sourceSha: '2222222222222222222222222222222222222222',
        previousStableTag: {
          name: 'v0.2.0',
          version: '0.2.0',
          sha: '1111111111111111111111111111111111111111',
        },
        commits: [
          {
            sha: '2222222222222222222222222222222222222222',
            message: 'fix: repair release\nRelease-Fix-Forward: 0.3.0',
            paths: ['packages/cli/src/cli.ts'],
          },
        ],
      }),
    ).toThrow(/final commit trailer block/);
  });

  test('rejects a multiline fix-forward trailer value', () => {
    expect(() =>
      planReleaseSet({
        sourceSha: '2222222222222222222222222222222222222222',
        previousStableTag: {
          name: 'v0.2.0',
          version: '0.2.0',
          sha: '1111111111111111111111111111111111111111',
        },
        commits: [
          {
            sha: '2222222222222222222222222222222222222222',
            message:
              'fix(cli): repair release\n\nRelease-Fix-Forward: 0.3.0\n invalid continuation',
            paths: ['packages/cli/src/cli.ts'],
          },
        ],
      }),
    ).toThrow(/exact stable version/);
  });

  test('rejects an orphan continuation before the fix-forward trailer', () => {
    expect(() =>
      planReleaseSet({
        sourceSha: '2222222222222222222222222222222222222222',
        previousStableTag: {
          name: 'v0.2.0',
          version: '0.2.0',
          sha: '1111111111111111111111111111111111111111',
        },
        commits: [
          {
            sha: '2222222222222222222222222222222222222222',
            message: 'fix(cli): repair release\n\n orphan continuation\nRelease-Fix-Forward: 0.3.0',
            paths: ['packages/cli/src/cli.ts'],
          },
        ],
      }),
    ).toThrow(/final commit trailer block/);
  });

  test.each([
    {
      sha: '2222222222222222222222222222222222222222',
      message: 'chore(cli): document recovery\n\nRelease-Fix-Forward: 0.3.0',
      paths: ['packages/cli/README.md'],
    },
    {
      sha: '2222222222222222222222222222222222222222',
      message: 'fix(web): document recovery\n\nRelease-Fix-Forward: 0.3.0',
      paths: ['apps/web/app/page.tsx'],
    },
  ])('rejects a fix-forward trailer on an ineligible commit', (commit) => {
    expect(() =>
      planReleaseSet({
        sourceSha: '3333333333333333333333333333333333333333',
        previousStableTag: {
          name: 'v0.2.0',
          version: '0.2.0',
          sha: '1111111111111111111111111111111111111111',
        },
        commits: [
          commit,
          {
            sha: '3333333333333333333333333333333333333333',
            message: 'fix(cli): repair release',
            paths: ['packages/cli/src/cli.ts'],
          },
        ],
      }),
    ).toThrow(/valid only on a release-relevant Conventional Commit/);
  });

  test.each([
    ['0.1.9', '0.3.0'],
    ['0.3.1', '0.3.0'],
    ['0.3.0', '0.3.0'],
  ])(
    'rejects a stale or non-monotonic fix-forward sequence from %s to %s',
    (firstVersion, secondVersion) => {
      expect(() =>
        planReleaseSet({
          sourceSha: '3333333333333333333333333333333333333333',
          previousStableTag: {
            name: 'v0.2.0',
            version: '0.2.0',
            sha: '1111111111111111111111111111111111111111',
          },
          commits: [
            {
              sha: '2222222222222222222222222222222222222222',
              message: `fix(cli): first repair\n\nRelease-Fix-Forward: ${firstVersion}`,
              paths: ['packages/cli/src/cli.ts'],
            },
            {
              sha: '3333333333333333333333333333333333333333',
              message: `fix(cli): second repair\n\nRelease-Fix-Forward: ${secondVersion}`,
              paths: ['packages/cli/src/cli.ts'],
            },
          ],
        }),
      ).toThrow(/must be newer than/);
    },
  );

  test.each([
    ['feat(api)!: remove legacy input', '2.0.0'],
    ['fix(api): change input\n\nBREAKING CHANGE: legacy input was removed', '2.0.0'],
    ['fix(api): change input\n\nBREAKING-CHANGE: legacy input was removed', '2.0.0'],
    ['fix(api): preserve input', '1.2.4'],
  ])('maps %s to %s', (message, version) => {
    const plan = planReleaseSet({
      sourceSha: '2222222222222222222222222222222222222222',
      previousStableTag: {
        name: 'v1.2.3',
        version: '1.2.3',
        sha: '1111111111111111111111111111111111111111',
      },
      commits: [
        {
          sha: '2222222222222222222222222222222222222222',
          message,
          paths: ['packages/create-tenkit/src/index.ts'],
        },
      ],
    });

    expect(plan.kind).toBe('release');
    expect(plan.kind === 'release' ? plan.version : undefined).toBe(version);
  });
});
