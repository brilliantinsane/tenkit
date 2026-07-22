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
