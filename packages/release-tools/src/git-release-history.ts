import { execFileSync } from 'node:child_process';

import { compareExactStableVersions, parseExactStableVersion } from './exact-stable-version';
import { parseExactReleaseSetVersion } from './exact-release-set-version';
import type {
  ReleaseCandidateTag,
  ReleaseChannel,
  ReleaseCommitInput,
  StableTag,
} from './release-plan';

type ReadReleaseHistoryInput = {
  channel: ReleaseChannel;
  workspaceRoot: string;
  sourceRevision: string;
};

export type ReleaseHistory = {
  sourceSha: string;
  previousStableTag: StableTag;
  releaseCandidateTags: readonly ReleaseCandidateTag[];
  commits: readonly ReleaseCommitInput[];
};

function runGit(workspaceRoot: string, args: readonly string[]): string {
  try {
    return execFileSync('git', args, {
      cwd: workspaceRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    throw new Error(`Git ${args[0] ?? 'command'} failed while reading Release Set history.`, {
      cause: error,
    });
  }
}

function parseStableTag(tagName: string): string | undefined {
  const version = tagName.startsWith('v') ? tagName.slice(1) : undefined;
  return version && parseExactStableVersion(version) ? version : undefined;
}

function latestStableTag(workspaceRoot: string, sourceSha: string): StableTag {
  const stableTags = runGit(workspaceRoot, ['tag', '--merged', sourceSha, '--list', 'v*'])
    .split('\n')
    .filter(Boolean)
    .flatMap((name) => {
      const version = parseStableTag(name);
      return version ? [{ name, version }] : [];
    })
    .sort((left, right) => compareExactStableVersions(right.version, left.version));
  const latest = stableTags[0];

  if (!latest) {
    throw new Error(`No stable v<major>.<minor>.<patch> tag reaches source ${sourceSha}.`);
  }

  return {
    name: latest.name,
    version: latest.name.slice(1),
    sha: runGit(workspaceRoot, ['rev-list', '-n', '1', latest.name]),
  };
}

function changedPaths(workspaceRoot: string, parentSha: string, commitSha: string): string[] {
  let output: Buffer;

  try {
    output = execFileSync(
      'git',
      ['diff-tree', '--no-commit-id', '--name-only', '-r', '-z', parentSha, commitSha],
      {
        cwd: workspaceRoot,
        encoding: 'buffer',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
  } catch (error) {
    throw new Error('Git diff-tree failed while reading Release Set changed paths.', {
      cause: error,
    });
  }

  return output.toString('utf8').split('\0').filter(Boolean).sort();
}

function releaseCandidateTags(workspaceRoot: string, sourceSha: string): ReleaseCandidateTag[] {
  return runGit(workspaceRoot, ['tag', '--merged', sourceSha, '--list', 'v*-rc.*'])
    .split('\n')
    .filter(Boolean)
    .map((name) => {
      const version = name.startsWith('v') ? name.slice(1) : '';
      const parsedVersion = parseExactReleaseSetVersion(version);

      if (parsedVersion?.channel !== 'rc') {
        throw new Error(
          `Git tag ${JSON.stringify(name)} is an invalid Release Candidate tag. Expected vX.Y.Z-rc.N with N starting at 1.`,
        );
      }

      return {
        name,
        version,
      };
    });
}

export function readReleaseHistory(input: ReadReleaseHistoryInput): ReleaseHistory {
  const sourceSha = runGit(input.workspaceRoot, [
    'rev-parse',
    '--verify',
    `${input.sourceRevision}^{commit}`,
  ]);
  const previousStableTag = latestStableTag(input.workspaceRoot, sourceSha);
  const commitShas = runGit(input.workspaceRoot, [
    'rev-list',
    '--reverse',
    '--first-parent',
    `${previousStableTag.sha}..${sourceSha}`,
  ])
    .split('\n')
    .filter(Boolean);
  const commits = commitShas.flatMap((sha) => {
    const parents = runGit(input.workspaceRoot, ['show', '-s', '--format=%P', sha])
      .split(' ')
      .filter(Boolean);

    if (parents.length !== 1) {
      return [];
    }

    return [
      {
        sha,
        message: runGit(input.workspaceRoot, ['show', '-s', '--format=%B', sha]),
        paths: changedPaths(input.workspaceRoot, parents[0], sha),
      },
    ];
  });

  return {
    sourceSha,
    previousStableTag,
    releaseCandidateTags:
      input.channel === 'rc' ? releaseCandidateTags(input.workspaceRoot, sourceSha) : [],
    commits,
  };
}
