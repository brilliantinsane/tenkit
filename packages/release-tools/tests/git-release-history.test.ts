import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

import { readReleaseHistory } from '../src/git-release-history';
import { planReleaseSet } from '../src/release-plan';

const workspaceRoot = resolve(import.meta.dirname, '../../..');
const acceptanceSourceSha = '3a10d24d0de14a4a0b175b58e046ecbc00a996f3';

describe('Git Release Set history', () => {
  test('plans immutable source fixture 3a10d24 as 0.3.0 after main moves', () => {
    const history = readReleaseHistory({
      workspaceRoot,
      sourceRevision: '3a10d24',
    });
    const plan = planReleaseSet(history);

    expect(history.sourceSha).toBe(acceptanceSourceSha);
    expect(history.previousStableTag.name).toBe('v0.2.0');
    expect(history.commits.map((commit) => commit.sha)).toEqual([acceptanceSourceSha]);
    expect(history.commits).toContainEqual(
      expect.objectContaining({
        sha: acceptanceSourceSha,
        message: expect.stringContaining('feat(playground): upgrade to Expo SDK 57 (#29)'),
        paths: expect.arrayContaining([
          'apps/playground/package.json',
          'packages/template-generator/tests/generator.test.ts',
        ]),
      }),
    );
    expect(plan.kind).toBe('release');
    expect(plan.kind === 'release' ? plan.version : undefined).toBe('0.3.0');
    expect(plan.kind === 'release' ? plan.sourceSha : undefined).toBe(acceptanceSourceSha);
    expect(
      plan.kind === 'release'
        ? plan.contributingCommits.find((commit) => commit.sha === acceptanceSourceSha)?.impact
        : undefined,
    ).toBe('minor');
  });
});
