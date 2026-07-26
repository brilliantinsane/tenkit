import { compareExactStableVersions, parseExactStableVersion } from './exact-stable-version';
import { parseExactReleaseSetVersion } from './exact-release-set-version';
import { RELEASE_SET_PACKAGES, type ReleaseSetPackageName } from './release-set.ts';

export type ReleaseImpact = 'patch' | 'minor' | 'major';
export type ReleaseChannel = 'stable' | 'rc';

export type StableTag = {
  name: string;
  version: string;
  sha: string;
};

export type ReleaseCandidateTag = {
  name: string;
  version: string;
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
      channel: ReleaseChannel;
      npmDistTag: 'latest' | 'next';
      gitTag: string;
      githubReleaseType: 'release' | 'prerelease';
      dependencyApprovalOrder: readonly ReleaseSetPackageName[];
      fixForwardFromVersion?: string;
      contributingCommits: readonly ContributingReleaseCommit[];
    };

export type PlanReleaseSetInput = {
  channel: ReleaseChannel;
  sourceSha: string;
  previousStableTag: StableTag;
  releaseCandidateTags: readonly ReleaseCandidateTag[];
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
  const versionParts = parseExactStableVersion(version);

  if (!versionParts) {
    throw new Error(`Stable version ${JSON.stringify(version)} must use major.minor.patch format.`);
  }

  const [majorText, minorText, patchText] = versionParts;
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

type CommitTrailer = {
  readonly token: string;
  readonly value: string;
};

function readTerminalTrailers(message: string): readonly CommitTrailer[] {
  const lines = message.trimEnd().split('\n');
  let terminalParagraphStart = lines.length - 1;

  while (terminalParagraphStart > 0 && lines[terminalParagraphStart - 1]!.trim() !== '') {
    terminalParagraphStart -= 1;
  }

  if (terminalParagraphStart === 0) {
    return [];
  }

  const terminalParagraph = lines.slice(terminalParagraphStart);
  const trailers: CommitTrailer[] = [];

  for (const line of terminalParagraph) {
    const trailerMatch = /^([A-Za-z0-9][A-Za-z0-9 _-]*):[ \t]*(.*)$/.exec(line);

    if (trailerMatch) {
      trailers.push({
        token: trailerMatch[1]!,
        value: trailerMatch[2]!,
      });
      continue;
    }

    if (!/^[ \t]+\S/.test(line) || trailers.length === 0) {
      return [];
    }

    const previousTrailer = trailers[trailers.length - 1]!;
    trailers[trailers.length - 1] = {
      ...previousTrailer,
      value: `${previousTrailer.value}\n${line.trim()}`,
    };
  }

  return trailers;
}

function readFixForwardVersion(message: string): string | undefined {
  const matchingLines = message
    .split('\n')
    .filter((line) => line.startsWith('Release-Fix-Forward:'));
  const fixForwardTrailers = readTerminalTrailers(message).filter(
    (trailer) => trailer.token === 'Release-Fix-Forward',
  );

  if (matchingLines.length !== fixForwardTrailers.length) {
    throw new Error('Release-Fix-Forward must appear in the final commit trailer block.');
  }

  if (fixForwardTrailers.length === 0) {
    return undefined;
  }

  if (fixForwardTrailers.length !== 1) {
    throw new Error('A release commit may contain only one Release-Fix-Forward trailer.');
  }

  const version = fixForwardTrailers[0]!.value.trim();

  if (!parseExactStableVersion(version)) {
    throw new Error('Release-Fix-Forward must name one exact stable version.');
  }

  return version;
}

export function planReleaseSet(input: PlanReleaseSetInput): ReleaseSetPlan {
  if (input.channel !== 'stable' && input.channel !== 'rc') {
    throw new Error('Release channel must be stable or rc.');
  }

  const plannedCommits = input.commits.flatMap((commit) => {
    const impact = releaseImpact(commit.message);
    const releaseRelevant = isReleaseRelevant(commit.paths);
    const fixForwardFromVersion = readFixForwardVersion(commit.message);

    if (fixForwardFromVersion && (!impact || !releaseRelevant)) {
      throw new Error(
        'Release-Fix-Forward is valid only on a release-relevant Conventional Commit.',
      );
    }

    if (!impact || !releaseRelevant) {
      return [];
    }

    if (fixForwardFromVersion && input.channel === 'rc') {
      throw new Error('Release-Fix-Forward is valid only for Stable planning.');
    }

    return [
      {
        sha: commit.sha,
        title: commit.message.split('\n', 1)[0] ?? '',
        paths: commit.paths,
        impact,
        fixForwardFromVersion,
      },
    ];
  });
  const contributingCommits = plannedCommits.map(
    ({ fixForwardFromVersion: _fixForwardFromVersion, ...commit }) => commit,
  );

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
  const normalVersion = bumpVersion(input.previousStableTag.version, highestImpact);
  let fixForwardFromVersion: string | undefined;

  for (const plannedCommit of plannedCommits) {
    const nextFixForwardVersion = plannedCommit.fixForwardFromVersion;

    if (!nextFixForwardVersion) {
      continue;
    }

    const previousVersion = fixForwardFromVersion ?? input.previousStableTag.version;

    if (compareExactStableVersions(nextFixForwardVersion, previousVersion) <= 0) {
      throw new Error(
        `Release-Fix-Forward version ${nextFixForwardVersion} must be newer than ${previousVersion}.`,
      );
    }

    fixForwardFromVersion = nextFixForwardVersion;
  }

  const fixForwardVersion = fixForwardFromVersion
    ? bumpVersion(fixForwardFromVersion, 'patch')
    : undefined;
  const targetVersion =
    fixForwardVersion && compareExactStableVersions(fixForwardVersion, normalVersion) > 0
      ? fixForwardVersion
      : normalVersion;
  const version =
    input.channel === 'stable'
      ? targetVersion
      : `${targetVersion}-rc.${nextReleaseCandidateOrdinal(
          input.releaseCandidateTags,
          targetVersion,
        )}`;

  return {
    kind: 'release',
    channel: input.channel,
    sourceSha: input.sourceSha,
    previousStableTag: input.previousStableTag,
    version,
    npmDistTag: input.channel === 'stable' ? 'latest' : 'next',
    gitTag: `v${version}`,
    githubReleaseType: input.channel === 'stable' ? 'release' : 'prerelease',
    dependencyApprovalOrder: RELEASE_SET_PACKAGES.map((releasePackage) => releasePackage.name),
    ...(fixForwardFromVersion ? { fixForwardFromVersion } : {}),
    contributingCommits,
  };
}

function nextReleaseCandidateOrdinal(
  releaseCandidateTags: readonly ReleaseCandidateTag[],
  targetVersion: string,
): number {
  let greatestOrdinal = 0;

  for (const tag of releaseCandidateTags) {
    const parsedVersion = parseExactReleaseSetVersion(tag.version);

    if (parsedVersion?.channel !== 'rc' || tag.name !== `v${tag.version}`) {
      throw new Error(
        `Release Candidate Git tag ${JSON.stringify(tag.name)} has invalid identity metadata.`,
      );
    }

    if (parsedVersion.targetVersion === targetVersion) {
      greatestOrdinal = Math.max(greatestOrdinal, parsedVersion.ordinal);
    }
  }

  if (greatestOrdinal === Number.MAX_SAFE_INTEGER) {
    throw new Error(
      `Release Candidate ordinal for target ${targetVersion} exceeds the supported range.`,
    );
  }

  return greatestOrdinal + 1;
}
