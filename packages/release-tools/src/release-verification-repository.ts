import { parseExactReleaseSetVersion } from './exact-release-set-version';
import { compareExactStableVersions } from './exact-stable-version';
import { isRecord, parseJson } from './release-verification-json';
import type { ReleaseVerificationIdentity } from './release-verification-policy';
import {
  READ_ATTEMPTS,
  RetryableReadError,
  readWithBoundedRetry,
} from './release-verification-retry';
import type { RunReleaseCommand } from './run-release-command';

const GITHUB_REPOSITORY = 'brilliantinsane/tenkit';

export type ReleaseChannelBaseline = {
  latest: string;
  next?: string;
};

export type GithubReleaseState = {
  publication: 'draft' | 'published';
  url: string;
  tagSha?: string;
};

type RemoteReleaseTag = {
  version: string;
  sha: string;
};

function releaseCandidateTagComparison(left: string, right: string): number {
  const leftVersion = parseExactReleaseSetVersion(left);
  const rightVersion = parseExactReleaseSetVersion(right);

  if (leftVersion?.channel !== 'rc' || rightVersion?.channel !== 'rc') {
    throw new Error('Release Candidate tag comparison requires exact RC versions.');
  }

  return (
    compareExactStableVersions(leftVersion.targetVersion, rightVersion.targetVersion) ||
    leftVersion.ordinal - rightVersion.ordinal
  );
}

function readRemoteReleaseTags(output: string): RemoteReleaseTag[] {
  const refs = new Map<string, { direct?: string; peeled?: string }>();

  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const [sha, ref] = line.split(/\s+/, 2);

    if (!sha || !ref || !/^[0-9a-f]{40}$/.test(sha)) {
      throw new Error('Git returned invalid remote release-tag data.');
    }

    const match = /^refs\/tags\/(v[^{}]+)(\^\{\})?$/.exec(ref);

    if (!match?.[1]) {
      continue;
    }

    const current = refs.get(match[1]) ?? {};
    refs.set(match[1], match[2] ? { ...current, peeled: sha } : { ...current, direct: sha });
  }

  return [...refs.entries()].flatMap(([tag, refsForTag]) => {
    const version = tag.slice(1);
    const sha = refsForTag.peeled ?? refsForTag.direct;

    return sha && parseExactReleaseSetVersion(version) ? [{ version, sha }] : [];
  });
}

export async function readReleaseChannelBaseline(input: {
  workspaceRoot: string;
  sourceSha: string;
  runCommand: RunReleaseCommand;
}): Promise<ReleaseChannelBaseline> {
  const resolvedSource = await input.runCommand({
    command: 'git',
    args: ['rev-parse', '--verify', `${input.sourceSha}^{commit}`],
    cwd: input.workspaceRoot,
  });

  if (resolvedSource.stdout.trim() !== input.sourceSha) {
    throw new Error(
      `Reviewed Release Set source ${input.sourceSha} resolved to ${resolvedSource.stdout.trim()}.`,
    );
  }

  const remoteTags = readRemoteReleaseTags(
    (
      await input.runCommand({
        command: 'git',
        args: ['ls-remote', '--tags', 'origin', 'refs/tags/v*'],
        cwd: input.workspaceRoot,
        errorDetail: 'none',
      })
    ).stdout,
  );
  const reachableVersions = (
    await Promise.all(
      remoteTags.map(async ({ version, sha }) => {
        const mergeBase = await input.runCommand({
          command: 'git',
          args: ['merge-base', sha, input.sourceSha],
          cwd: input.workspaceRoot,
        });

        return mergeBase.stdout.trim() === sha ? version : undefined;
      }),
    )
  ).filter((version): version is string => version !== undefined);
  const stableVersions = reachableVersions
    .filter((version) => parseExactReleaseSetVersion(version)?.channel === 'stable')
    .sort((left, right) => compareExactStableVersions(right, left));
  const releaseCandidateVersions = reachableVersions
    .filter((version) => parseExactReleaseSetVersion(version)?.channel === 'rc')
    .sort((left, right) => releaseCandidateTagComparison(right, left));
  const latest = stableVersions[0];

  if (!latest) {
    throw new Error(`No Stable Git tag reaches reviewed source ${input.sourceSha}.`);
  }

  return {
    latest,
    ...(releaseCandidateVersions[0] ? { next: releaseCandidateVersions[0] } : {}),
  };
}

function flattenGithubReleasePages(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new Error('GitHub returned invalid Release-list JSON.');
  }

  const releases = value.flatMap((page) => (Array.isArray(page) ? page : [page]));

  if (!releases.every(isRecord)) {
    throw new Error('GitHub returned an invalid Release record.');
  }

  return releases;
}

function readRemoteTagSha(output: string, gitTag: string): string | undefined {
  const refs = output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split(/\s+/, 2))
    .filter((parts): parts is [string, string] => Boolean(parts[0] && parts[1]));
  const peeled = refs.find(([, ref]) => ref === `refs/tags/${gitTag}^{}`)?.[0];
  const direct = refs.find(([, ref]) => ref === `refs/tags/${gitTag}`)?.[0];
  const sha = peeled ?? direct;

  if (sha !== undefined && !/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error(`Git returned an invalid remote tag SHA for ${gitTag}.`);
  }

  return sha;
}

async function readGithubReleaseState(input: {
  identity: ReleaseVerificationIdentity;
  workspaceRoot: string;
  runCommand: RunReleaseCommand;
}): Promise<GithubReleaseState> {
  let releasesResult;

  try {
    releasesResult = await input.runCommand({
      command: 'gh',
      args: ['api', '--paginate', '--slurp', `repos/${GITHUB_REPOSITORY}/releases?per_page=100`],
      cwd: input.workspaceRoot,
      errorDetail: 'none',
    });
  } catch (error) {
    throw new RetryableReadError('Unable to read GitHub Releases.', { cause: error });
  }

  let releases: Record<string, unknown>[];

  try {
    releases = flattenGithubReleasePages(parseJson(releasesResult.stdout, 'GitHub Releases'));
  } catch (error) {
    throw new RetryableReadError('GitHub returned unreadable Release data.', { cause: error });
  }

  const matchingReleases = releases.filter((release) => release.tag_name === input.identity.gitTag);

  if (matchingReleases.length === 0) {
    throw new RetryableReadError(`GitHub Release ${input.identity.gitTag} is not visible yet.`);
  }

  if (matchingReleases.length > 1) {
    throw new Error(
      `GitHub expected exactly one Release for ${input.identity.gitTag}, found ${matchingReleases.length}. Stop for owner review.`,
    );
  }

  const release = matchingReleases[0]!;
  const expectedPrerelease = input.identity.githubReleaseType === 'prerelease';

  if (
    release.target_commitish !== input.identity.sourceSha ||
    release.prerelease !== expectedPrerelease ||
    typeof release.draft !== 'boolean' ||
    typeof release.html_url !== 'string'
  ) {
    throw new Error(
      `GitHub Release ${input.identity.gitTag} does not match source ${input.identity.sourceSha} and ${input.identity.githubReleaseType} type.`,
    );
  }

  if (
    (!release.draft &&
      (typeof release.published_at !== 'string' ||
        Number.isNaN(Date.parse(release.published_at)))) ||
    (release.draft && release.published_at !== null)
  ) {
    throw new Error(`GitHub Release ${input.identity.gitTag} has inconsistent publication state.`);
  }

  let tagSha: string | undefined;

  try {
    const remoteTagResult = await input.runCommand({
      command: 'git',
      args: [
        'ls-remote',
        '--tags',
        'origin',
        `refs/tags/${input.identity.gitTag}`,
        `refs/tags/${input.identity.gitTag}^{}`,
      ],
      cwd: input.workspaceRoot,
      errorDetail: 'none',
    });
    tagSha = readRemoteTagSha(remoteTagResult.stdout, input.identity.gitTag);
  } catch (error) {
    throw new RetryableReadError(`Unable to read Git tag ${input.identity.gitTag}.`, {
      cause: error,
    });
  }

  if (release.draft && tagSha) {
    throw new RetryableReadError(
      `Git tag ${input.identity.gitTag} exists while its GitHub Release is still a draft.`,
    );
  }

  if (!release.draft && tagSha !== input.identity.sourceSha) {
    throw new RetryableReadError(
      `Git tag ${input.identity.gitTag} expected ${input.identity.sourceSha}, found ${tagSha ?? 'no tag'}.`,
    );
  }

  return {
    publication: release.draft ? 'draft' : 'published',
    url: release.html_url,
    ...(tagSha ? { tagSha } : {}),
  };
}

export function readGithubReleaseStateWithRetry(input: {
  identity: ReleaseVerificationIdentity;
  workspaceRoot: string;
  runCommand: RunReleaseCommand;
  wait: (milliseconds: number) => Promise<void>;
}): Promise<GithubReleaseState> {
  return readWithBoundedRetry({
    read: () => readGithubReleaseState(input),
    wait: input.wait,
    terminalMessage: `GitHub state remained ambiguous after ${READ_ATTEMPTS} read attempts. Stop and inspect the existing Release and Git tag; do not repeat npm mutation.`,
  });
}
