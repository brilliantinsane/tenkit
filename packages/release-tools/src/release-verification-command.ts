import { lstat, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readPinnedNpmVersion } from './npm-version-pin';
import { reproduceReleaseSet as reproduceCanonicalReleaseSet } from './reproduce-release-set';
import { runReleaseCommand, type RunReleaseCommand } from './run-release-command';
import { RELEASE_SET_PACKAGES } from './release-set';
import {
  classifyReleaseVerification,
  parseReleaseVerificationIdentity,
} from './release-verification-policy';
import {
  assertDependencyOrder,
  readRegistryObservationWithRetry,
  verifyRegistryPackage,
  type PublicReleasePackage,
  type StagedReleasePackage,
} from './release-verification-registry';
import {
  runReleaseVerificationNpmCommand,
  usePublicNpmRegistry,
  verifyExactVersionCreateEntrypoint,
  type RunReleaseVerificationNpmCommand,
} from './release-verification-npm';
import {
  readGithubReleaseStateWithRetry,
  readReleaseChannelBaseline,
} from './release-verification-repository';
import { READ_ATTEMPTS, READ_RETRY_DELAY_MS } from './release-verification-retry';

type RunReleaseVerificationCommandInput = {
  args: readonly string[];
  workspaceRoot: string;
  write(message: string): void;
  runNpmCommand?: RunReleaseVerificationNpmCommand;
  runCommand?: RunReleaseCommand;
  wait?: (milliseconds: number) => Promise<void>;
  reproduceReleaseSet?: typeof reproduceCanonicalReleaseSet;
};

async function assertWorkspaceRoot(path: string): Promise<void> {
  if (!(await lstat(path)).isDirectory()) {
    throw new Error('Release Verification workspace root is not a directory.');
  }
}

function defaultWait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function runReleaseVerificationCommand(
  input: RunReleaseVerificationCommandInput,
): Promise<number> {
  const identity = parseReleaseVerificationIdentity(input.args);
  await assertWorkspaceRoot(input.workspaceRoot);

  const runNpmCommand = usePublicNpmRegistry(
    input.runNpmCommand ?? runReleaseVerificationNpmCommand,
  );
  const runCommand = input.runCommand ?? runReleaseCommand;
  const wait = input.wait ?? defaultWait;
  const pinnedNpmVersion = await readPinnedNpmVersion(input.workspaceRoot);
  const npmVersion = await runNpmCommand({ args: ['--version'], cwd: input.workspaceRoot });

  if (npmVersion.exitCode !== 0 || npmVersion.stdout.trim() !== pinnedNpmVersion) {
    throw new Error(
      `Release Verification requires npm ${pinnedNpmVersion}, but found ${npmVersion.stdout.trim() || 'an unavailable npm CLI'} on PATH.`,
    );
  }

  const baseline = await readReleaseChannelBaseline({
    workspaceRoot: input.workspaceRoot,
    sourceSha: identity.sourceSha,
    runCommand,
  });
  const operationRoot = await mkdtemp(join(tmpdir(), 'tenkit-release-verification-'));
  const registryArtifactRoot = join(operationRoot, 'registry');

  try {
    await mkdir(registryArtifactRoot);
    const reproduction = await (input.reproduceReleaseSet ?? reproduceCanonicalReleaseSet)({
      repositoryRoot: input.workspaceRoot,
      outputRoot: join(operationRoot, 'reproduction'),
      sourceSha: identity.sourceSha,
      version: identity.version,
    });

    if (
      reproduction.sourceSha !== identity.sourceSha ||
      reproduction.version !== identity.version ||
      reproduction.artifactPaths.length !== RELEASE_SET_PACKAGES.length ||
      reproduction.packages.length !== RELEASE_SET_PACKAGES.length
    ) {
      throw new Error('Release Set reproduction returned a mismatched identity or package set.');
    }

    const observations = await Promise.all(
      RELEASE_SET_PACKAGES.map((releasePackage) =>
        readRegistryObservationWithRetry({
          packageName: releasePackage.name,
          version: identity.version,
          identity,
          baseline,
          workspaceRoot: input.workspaceRoot,
          runNpmCommand,
          wait,
        }),
      ),
    );
    const publicCount = assertDependencyOrder(observations);
    const githubState = await readGithubReleaseStateWithRetry({
      identity,
      workspaceRoot: input.workspaceRoot,
      runCommand,
      wait,
    });

    if (githubState.publication === 'published' && publicCount !== RELEASE_SET_PACKAGES.length) {
      throw new Error(
        `GitHub has a published release for ${identity.gitTag} before the complete npm Release Set is public. Stop for owner review.`,
      );
    }

    const registryPackages: Array<StagedReleasePackage | PublicReleasePackage> = [];

    for (const [packageIndex, observation] of observations.entries()) {
      registryPackages.push(
        await verifyRegistryPackage({
          packageIndex,
          identity,
          workspaceRoot: input.workspaceRoot,
          registryArtifactRoot,
          localArtifact: reproduction.packages[packageIndex]!,
          localArtifactPath: reproduction.artifactPaths[packageIndex]!,
          observation,
          runNpmCommand,
          wait,
        }),
      );
    }

    if (publicCount === RELEASE_SET_PACKAGES.length) {
      await verifyExactVersionCreateEntrypoint({
        version: identity.version,
        operationRoot,
        runCommand,
      });
    }

    const nextPrivatePackage = registryPackages.find(
      (registryPackage) => 'id' in registryPackage,
    )?.packageName;
    const { state, nextAction } = classifyReleaseVerification({
      identity,
      publicCount,
      ...(nextPrivatePackage ? { nextPrivatePackage } : {}),
      githubPublication: githubState.publication,
    });

    input.write(
      [
        'Release Verification: PASS',
        `Source SHA: ${identity.sourceSha}`,
        `Version: ${identity.version}`,
        `Channel: ${identity.channel === 'stable' ? 'Stable' : 'RC'}`,
        `Final npm tag: ${identity.finalTag}`,
        `Untouched npm tag: ${identity.untouchedTag}`,
        `State: ${state}`,
        `Read retry bound: ${READ_ATTEMPTS} attempts over ${(READ_ATTEMPTS - 1) * READ_RETRY_DELAY_MS}ms`,
        ...registryPackages.flatMap((registryPackage) => [
          'id' in registryPackage
            ? `${registryPackage.packageName}: private ${registryPackage.tag} stage ${registryPackage.id} by ${registryPackage.actor} (${registryPackage.actorType})`
            : `${registryPackage.packageName}: public`,
          `  integrity: ${registryPackage.integrity}`,
          `  shasum: ${registryPackage.shasum}`,
        ]),
        `GitHub Release: matching ${identity.githubReleaseType} ${githubState.publication}`,
        `GitHub URL: ${githubState.url}`,
        githubState.tagSha
          ? `Git tag: ${identity.gitTag} -> ${githubState.tagSha}`
          : `Git tag: ${identity.gitTag} not published`,
        `Exact-version create entrypoint: ${publicCount === RELEASE_SET_PACKAGES.length ? identity.version : 'deferred until all packages are public'}`,
        `Next action: ${nextAction}`,
        '',
      ].join('\n'),
    );
    return 0;
  } finally {
    await rm(operationRoot, { recursive: true });
  }
}
