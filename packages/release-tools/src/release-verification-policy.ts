import {
  parseExactReleaseSetVersion,
  type ExactReleaseSetVersion,
} from './exact-release-set-version';
import { RELEASE_SET_PACKAGES, type ReleaseSetPackageName } from './release-set';

export type ReleaseVerificationIdentity = ExactReleaseSetVersion & {
  sourceSha: string;
  finalTag: 'latest' | 'next';
  untouchedTag: 'latest' | 'next';
  githubReleaseType: 'normal' | 'prerelease';
  gitTag: string;
};

export function parseReleaseVerificationIdentity(
  args: readonly string[],
): ReleaseVerificationIdentity {
  const commandArgs = args[0] === '--' ? args.slice(1) : args;

  if (
    commandArgs.length !== 4 ||
    commandArgs[0] !== '--source-sha' ||
    !commandArgs[1] ||
    commandArgs[2] !== '--version' ||
    !commandArgs[3]
  ) {
    throw new Error(
      'Usage: pnpm release:verify -- --source-sha <full-source-sha> --version <version>',
    );
  }

  const sourceSha = commandArgs[1];
  const version = commandArgs[3];

  if (!/^[0-9a-f]{40}$/.test(sourceSha)) {
    throw new Error('Release Verification requires one full lowercase source SHA.');
  }

  const parsedVersion = parseExactReleaseSetVersion(version);

  if (!parsedVersion) {
    throw new Error('Release Verification requires one exact Stable or RC version.');
  }

  return {
    ...parsedVersion,
    sourceSha,
    finalTag: parsedVersion.channel === 'stable' ? 'latest' : 'next',
    untouchedTag: parsedVersion.channel === 'stable' ? 'next' : 'latest',
    githubReleaseType: parsedVersion.channel === 'stable' ? 'normal' : 'prerelease',
    gitTag: `v${version}`,
  };
}

export function classifyReleaseVerification(input: {
  identity: ReleaseVerificationIdentity;
  publicCount: number;
  nextPrivatePackage?: ReleaseSetPackageName;
  githubPublication: 'draft' | 'published';
}): { state: string; nextAction: string } {
  const state =
    input.publicCount === 0
      ? 'fully private'
      : input.publicCount < RELEASE_SET_PACKAGES.length
        ? `partial public (${input.publicCount}/${RELEASE_SET_PACKAGES.length})`
        : input.githubPublication === 'draft'
          ? 'complete public'
          : 'published';

  if (input.nextPrivatePackage) {
    return {
      state,
      nextAction: `Approve ${input.nextPrivatePackage}@${input.identity.version} with npm 2FA, then rerun this command.`,
    };
  }

  if (input.githubPublication === 'draft') {
    return {
      state,
      nextAction: `Publish the existing GitHub draft ${input.identity.gitTag}, then rerun this command.`,
    };
  }

  return {
    state,
    nextAction:
      input.identity.channel === 'stable'
        ? 'Run pnpm create tenkit@latest --version outside this workspace.'
        : 'Release Set publication is complete; no release mutation remains.',
  };
}
