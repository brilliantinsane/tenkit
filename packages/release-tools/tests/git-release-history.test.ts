import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { readReleaseHistory } from '../src/git-release-history';
import { planReleaseSetFromRepository } from '../src/plan-release-set-from-repository';
import { planReleaseSet } from '../src/release-plan';

const workspaceRoot = resolve(import.meta.dirname, '../../..');
const acceptanceSourceSha = '3a10d24d0de14a4a0b175b58e046ecbc00a996f3';
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((tempRoot) => rm(tempRoot, { recursive: true })));
});

function git(repositoryRoot: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

async function createReleaseRepository(): Promise<string> {
  const repositoryRoot = await mkdtemp(join(tmpdir(), 'tenkit-release-history-'));
  tempRoots.push(repositoryRoot);
  git(repositoryRoot, 'init', '--quiet');
  git(repositoryRoot, 'config', 'user.name', 'Release Test');
  git(repositoryRoot, 'config', 'user.email', 'release-test@example.com');
  await writeFile(join(repositoryRoot, 'README.md'), 'initial\n');
  git(repositoryRoot, 'add', 'README.md');
  git(repositoryRoot, 'commit', '--quiet', '-m', 'chore: initial');
  git(repositoryRoot, 'tag', 'v1.2.3');
  await mkdir(join(repositoryRoot, 'packages/cli/src'), { recursive: true });
  await writeFile(join(repositoryRoot, 'packages/cli/src/cli.ts'), 'export {};\n');
  git(repositoryRoot, 'add', 'packages/cli/src/cli.ts');
  git(repositoryRoot, 'commit', '--quiet', '-m', 'feat(cli): add release behavior');
  return repositoryRoot;
}

describe('Git Release Set history', () => {
  test('plans immutable source fixture 3a10d24 as 0.3.0 after main moves', () => {
    const history = readReleaseHistory({
      channel: 'stable',
      workspaceRoot,
      sourceRevision: '3a10d24',
    });
    const plan = planReleaseSet({
      channel: 'stable',
      ...history,
    });

    expect(history.sourceSha).toBe(acceptanceSourceSha);
    expect(history.previousStableTag.name).toBe('v0.2.0');
    expect(history.releaseCandidateTags).toEqual([]);
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

  test('derives the next RC ordinal from exact target Git tags', async () => {
    const repositoryRoot = await createReleaseRepository();
    git(repositoryRoot, 'tag', 'v1.3.0-rc.1');
    git(repositoryRoot, 'tag', 'v1.3.0-rc.3');
    git(repositoryRoot, 'tag', 'v2.0.0-rc.8');

    expect(
      planReleaseSetFromRepository({
        channel: 'rc',
        workspaceRoot: repositoryRoot,
        sourceRevision: 'HEAD',
      }),
    ).toEqual(
      expect.objectContaining({
        channel: 'rc',
        version: '1.3.0-rc.4',
        gitTag: 'v1.3.0-rc.4',
      }),
    );
  });

  test('rejects malformed RC Git tags instead of ignoring release state', async () => {
    const repositoryRoot = await createReleaseRepository();
    git(repositoryRoot, 'tag', 'v1.3.0-rc.0');

    expect(() =>
      planReleaseSetFromRepository({
        channel: 'rc',
        workspaceRoot: repositoryRoot,
        sourceRevision: 'HEAD',
      }),
    ).toThrow(/invalid Release Candidate tag/);
  });

  test('keeps Stable planning isolated from prerelease tag state', async () => {
    const repositoryRoot = await createReleaseRepository();
    git(repositoryRoot, 'tag', 'v1.3.0-rc.0');

    expect(
      planReleaseSetFromRepository({
        channel: 'stable',
        workspaceRoot: repositoryRoot,
        sourceRevision: 'HEAD',
      }),
    ).toEqual(expect.objectContaining({ channel: 'stable', version: '1.3.0' }));
  });
});
