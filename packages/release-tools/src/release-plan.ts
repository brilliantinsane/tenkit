import { RELEASE_SET_PACKAGES } from './release-set.ts';

export type ReleaseImpact = 'patch' | 'minor' | 'major';

export type StableTag = {
  name: string;
  version: string;
  sha: string;
};

export type ReleaseCommitInput = {
  sha: string;
  message: string;
  paths: readonly string[];
};

export type ContributingReleaseCommit = {
  sha: string;
  title: string;
  paths: readonly string[];
  impact: ReleaseImpact;
};

export type ReleaseSetPlan =
  | {
      kind: 'no-release';
      sourceSha: string;
      previousStableTag: StableTag;
    }
  | {
      kind: 'release';
      sourceSha: string;
      previousStableTag: StableTag;
      version: string;
      contributingCommits: readonly ContributingReleaseCommit[];
    };

type PlanReleaseSetInput = {
  sourceSha: string;
  previousStableTag: StableTag;
  commits: readonly ReleaseCommitInput[];
};

function releaseImpact(message: string): ReleaseImpact | undefined {
  const title = message.split('\n', 1)[0] ?? '';

  if (/^[a-z]+(?:\([^\n)]+\))?!:/.test(title) || /^BREAKING(?: CHANGE|-CHANGE):/m.test(message)) {
    return 'major';
  }

  if (/^feat(?:\([^\n)]+\))?:/.test(title)) {
    return 'minor';
  }

  if (/^fix(?:\([^\n)]+\))?:/.test(title)) {
    return 'patch';
  }

  return undefined;
}

function isReleaseRelevant(paths: readonly string[]): boolean {
  return paths.some((path) =>
    RELEASE_SET_PACKAGES.some((releasePackage) => path.startsWith(`${releasePackage.root}/`)),
  );
}

function bumpVersion(version: string, impact: ReleaseImpact): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);

  if (!match) {
    throw new Error(`Stable version ${JSON.stringify(version)} must use major.minor.patch format.`);
  }

  const [, majorText, minorText, patchText] = match;
  const major = Number(majorText);
  const minor = Number(minorText);
  const patch = Number(patchText);

  if (impact === 'major') {
    return `${major + 1}.0.0`;
  }

  if (impact === 'minor') {
    return `${major}.${minor + 1}.0`;
  }

  return `${major}.${minor}.${patch + 1}`;
}

export function planReleaseSet(input: PlanReleaseSetInput): ReleaseSetPlan {
  const contributingCommits = input.commits.flatMap((commit) => {
    const impact = releaseImpact(commit.message);

    if (!impact || !isReleaseRelevant(commit.paths)) {
      return [];
    }

    return [
      {
        sha: commit.sha,
        title: commit.message.split('\n', 1)[0] ?? '',
        paths: commit.paths,
        impact,
      },
    ];
  });

  if (contributingCommits.length === 0) {
    return {
      kind: 'no-release',
      sourceSha: input.sourceSha,
      previousStableTag: input.previousStableTag,
    };
  }

  const impactRank: Record<ReleaseImpact, number> = { patch: 0, minor: 1, major: 2 };
  const highestImpact = contributingCommits.reduce<ReleaseImpact>(
    (highest, commit) =>
      impactRank[commit.impact] > impactRank[highest] ? commit.impact : highest,
    'patch',
  );
  const version = bumpVersion(input.previousStableTag.version, highestImpact);

  return {
    kind: 'release',
    sourceSha: input.sourceSha,
    previousStableTag: input.previousStableTag,
    version,
    contributingCommits,
  };
}
