import { RELEASE_SET_PACKAGES } from './release-set';

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
  occupiedVersions: readonly string[];
};

function planRecord(value: unknown, description: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${description} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function planString(value: unknown, description: string, pattern?: RegExp): string {
  if (typeof value !== 'string' || value.length === 0 || (pattern && !pattern.test(value))) {
    throw new Error(`${description} is invalid.`);
  }

  return value;
}

export function parseReleaseSetPlan(value: unknown): ReleaseSetPlan {
  const plan = planRecord(value, 'Release Set plan');
  const sourceSha = planString(plan.sourceSha, 'Release Set plan source SHA', /^[0-9a-f]{40}$/);
  const previousStableTagValue = planRecord(
    plan.previousStableTag,
    'Release Set plan previous stable tag',
  );
  const previousStableTag = {
    name: planString(previousStableTagValue.name, 'Previous stable tag name', /^v\d+\.\d+\.\d+$/),
    version: planString(
      previousStableTagValue.version,
      'Previous stable tag version',
      /^\d+\.\d+\.\d+$/,
    ),
    sha: planString(previousStableTagValue.sha, 'Previous stable tag SHA', /^[0-9a-f]{40}$/),
  };

  if (plan.kind === 'no-release') {
    return { kind: 'no-release', sourceSha, previousStableTag };
  }

  if (plan.kind !== 'release') {
    throw new Error('Release Set plan kind must be release or no-release.');
  }

  const version = planString(plan.version, 'Release Set plan version', /^\d+\.\d+\.\d+$/);

  if (!Array.isArray(plan.contributingCommits) || plan.contributingCommits.length === 0) {
    throw new Error('An approved Release Set plan must contain contributing commits.');
  }

  const contributingCommits = plan.contributingCommits.map((value) => {
    const commit = planRecord(value, 'Contributing Release Set commit');

    if (!Array.isArray(commit.paths) || !commit.paths.every((path) => typeof path === 'string')) {
      throw new Error('Contributing Release Set commit paths must be strings.');
    }

    if (commit.impact !== 'patch' && commit.impact !== 'minor' && commit.impact !== 'major') {
      throw new Error('Contributing Release Set commit impact is invalid.');
    }

    const impact: ReleaseImpact = commit.impact;

    return {
      sha: planString(commit.sha, 'Contributing Release Set commit SHA', /^[0-9a-f]{40}$/),
      title: planString(commit.title, 'Contributing Release Set commit title'),
      paths: [...commit.paths],
      impact,
    };
  });

  return {
    kind: 'release',
    sourceSha,
    previousStableTag,
    version,
    contributingCommits,
  };
}

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
  const occupiedVersions = new Set(input.occupiedVersions);
  let version = bumpVersion(input.previousStableTag.version, highestImpact);

  while (occupiedVersions.has(version)) {
    version = bumpVersion(version, 'patch');
  }

  return {
    kind: 'release',
    sourceSha: input.sourceSha,
    previousStableTag: input.previousStableTag,
    version,
    contributingCommits,
  };
}
