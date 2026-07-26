import { execFile } from 'node:child_process';
import { copyFile, lstat, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';

import {
  parseExactReleaseSetVersion,
  type ExactReleaseSetVersion,
} from './exact-release-set-version';
import { compareExactStableVersions } from './exact-stable-version';
import { inspectReleaseArtifact, type ReleaseArtifact } from './release-artifacts';
import { readPinnedNpmVersion } from './npm-version-pin';
import {
  readExactInternalReleaseSetDependencies,
  type InternalReleaseSetDependency,
} from './release-set-dependencies';
import { reproduceReleaseSet as reproduceCanonicalReleaseSet } from './reproduce-release-set';
import { runReleaseCommand, type RunReleaseCommand } from './run-release-command';
import { RELEASE_SET_PACKAGES, type ReleaseSetPackageName } from './release-set';

const execFileAsync = promisify(execFile);
const PUBLIC_REGISTRY = 'https://registry.npmjs.org/';
const GITHUB_REPOSITORY = 'brilliantinsane/tenkit';
const EXPECTED_STAGE_ACTOR = 'GitHub Actions';
const EXPECTED_STAGE_ACTOR_TYPE = 'trusted automation';
const READ_ATTEMPTS = 4;
const READ_RETRY_DELAY_MS = 2_500;

type NpmCommandInput = {
  args: readonly string[];
  cwd: string;
};

type NpmCommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type RunReleaseVerificationNpmCommand = (
  input: NpmCommandInput,
) => Promise<NpmCommandResult>;

type RunReleaseVerificationCommandInput = {
  args: readonly string[];
  workspaceRoot: string;
  write(message: string): void;
  runNpmCommand?: RunReleaseVerificationNpmCommand;
  runCommand?: RunReleaseCommand;
  wait?: (milliseconds: number) => Promise<void>;
  reproduceReleaseSet?: typeof reproduceCanonicalReleaseSet;
};

type ReleaseVerificationIdentity = ExactReleaseSetVersion & {
  sourceSha: string;
  finalTag: 'latest' | 'next';
  untouchedTag: 'latest' | 'next';
  githubReleaseType: 'normal' | 'prerelease';
  gitTag: string;
};

type StageMetadata = {
  id: string;
  packageName: ReleaseSetPackageName;
  version: string;
  tag: 'latest' | 'next';
  createdAt: string;
  actor: string;
  actorType: string;
  access: 'public';
  shasum: string;
};

type StagedReleasePackage = StageMetadata & { integrity: string };

type PublicReleasePackage = {
  packageName: ReleaseSetPackageName;
  version: string;
  integrity: string;
  shasum: string;
};

type ReleaseChannelBaseline = {
  latest: string;
  next?: string;
};

type NpmDistTags = {
  latest?: string;
  next?: string;
};

type RegistryObservation = {
  packageName: ReleaseSetPackageName;
  publicMetadata?: Record<string, unknown>;
  matchingStages: unknown[];
  distTags: NpmDistTags;
};

type GithubReleaseState = {
  publication: 'draft' | 'published';
  url: string;
  tagSha?: string;
};

class RetryableReadError extends Error {}

async function readWithBoundedRetry<T>(input: {
  read(): Promise<T>;
  wait(milliseconds: number): Promise<void>;
  terminalMessage: string;
}): Promise<T> {
  let lastError: RetryableReadError | undefined;

  for (let attempt = 1; attempt <= READ_ATTEMPTS; attempt += 1) {
    try {
      return await input.read();
    } catch (error) {
      if (!(error instanceof RetryableReadError)) {
        throw error;
      }

      lastError = error;

      if (attempt < READ_ATTEMPTS) {
        await input.wait(READ_RETRY_DELAY_MS);
      }
    }
  }

  throw new Error(
    `${lastError?.message ?? 'Read state remained ambiguous.'} ${input.terminalMessage}`,
    {
      cause: lastError,
    },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseJson(output: string, description: string): unknown {
  try {
    return JSON.parse(output) as unknown;
  } catch (error) {
    throw new Error(`Command returned invalid JSON for ${description}.`, { cause: error });
  }
}

function parseArguments(args: readonly string[]): ReleaseVerificationIdentity {
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

export const runReleaseVerificationNpmCommand: RunReleaseVerificationNpmCommand = async (input) => {
  try {
    const command = await execFileAsync('npm', [...input.args], {
      cwd: input.cwd,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });

    return { exitCode: 0, stdout: command.stdout, stderr: command.stderr };
  } catch (error) {
    if (error && typeof error === 'object') {
      const stdout = 'stdout' in error && typeof error.stdout === 'string' ? error.stdout : '';
      const stderr = 'stderr' in error && typeof error.stderr === 'string' ? error.stderr : '';
      const exitCode = 'code' in error && typeof error.code === 'number' ? error.code : 1;
      return { exitCode, stdout, stderr };
    }

    throw new Error('Unable to start npm for read-only Release Verification.', { cause: error });
  }
};

function parseStage(
  value: unknown,
  expectedPackageName: ReleaseSetPackageName,
  expectedVersion: string,
  expectedTag: 'latest' | 'next',
): StageMetadata {
  if (!isRecord(value)) {
    throw new Error(`npm returned an invalid stage for ${expectedPackageName}@${expectedVersion}.`);
  }

  if (value.packageName !== expectedPackageName || value.version !== expectedVersion) {
    throw new Error(`npm stage identity mismatch for ${expectedPackageName}@${expectedVersion}.`);
  }

  if (
    typeof value.id !== 'string' ||
    !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value.id)
  ) {
    throw new Error(
      `npm returned an invalid stage ID for ${expectedPackageName}@${expectedVersion}.`,
    );
  }

  if (value.tag !== expectedTag) {
    throw new Error(
      `${expectedPackageName}@${expectedVersion} stage expected tag ${expectedTag}, found ${String(value.tag)}.`,
    );
  }

  if (value.actor !== EXPECTED_STAGE_ACTOR || value.actorType !== EXPECTED_STAGE_ACTOR_TYPE) {
    throw new Error(
      `${expectedPackageName}@${expectedVersion} stage has unexpected actor ${String(value.actor)} (${String(value.actorType)}).`,
    );
  }

  if (
    typeof value.createdAt !== 'string' ||
    Number.isNaN(Date.parse(value.createdAt)) ||
    value.access !== 'public' ||
    typeof value.shasum !== 'string' ||
    !/^[0-9a-f]{40}$/.test(value.shasum)
  ) {
    throw new Error(
      `npm returned invalid stage metadata for ${expectedPackageName}@${expectedVersion}.`,
    );
  }

  return {
    id: value.id,
    packageName: expectedPackageName,
    version: expectedVersion,
    tag: expectedTag,
    createdAt: value.createdAt,
    actor: EXPECTED_STAGE_ACTOR,
    actorType: EXPECTED_STAGE_ACTOR_TYPE,
    access: 'public',
    shasum: value.shasum,
  };
}

function stageDownloadFilename(stage: StageMetadata): string {
  return `${stage.packageName.replace('@', '').replace('/', '-')}-${stage.version}-${stage.id}.tgz`;
}

function readDownloadedFilename(output: string, expectedFilename: string): string {
  const filename = output.trim();

  if (
    filename === '' ||
    filename !== expectedFilename ||
    filename !== basename(filename) ||
    !filename.endsWith('.tgz')
  ) {
    throw new Error(`npm stage download did not return ${expectedFilename}.`);
  }

  return filename;
}

function readPackedFilename(output: string, expectedFilename: string): string {
  const packResult = parseJson(output, `${expectedFilename} npm pack result`);

  if (
    !Array.isArray(packResult) ||
    packResult.length !== 1 ||
    !isRecord(packResult[0]) ||
    packResult[0].filename !== expectedFilename ||
    packResult[0].filename !== basename(packResult[0].filename)
  ) {
    throw new Error(`npm pack did not return one exact tarball named ${expectedFilename}.`);
  }

  return expectedFilename;
}

async function verifyRegistryArtifact(input: {
  packageIndex: number;
  version: string;
  downloadedArtifactPath: string;
  registryArtifactRoot: string;
  localArtifactPath: string;
  localIntegrity: string;
  localShasum: string;
  registryIntegrity?: string;
  registryShasum: string;
  registryDigestSource: 'npm stage' | 'public';
}): Promise<ReleaseArtifact> {
  const releasePackage = RELEASE_SET_PACKAGES[input.packageIndex]!;
  const canonicalRegistryArtifactPath = join(
    input.registryArtifactRoot,
    `${releasePackage.artifactPrefix}-${input.version}.tgz`,
  );

  if (input.downloadedArtifactPath !== canonicalRegistryArtifactPath) {
    await copyFile(input.downloadedArtifactPath, canonicalRegistryArtifactPath);
  }

  const registryArtifact = await inspectReleaseArtifact({
    artifactPath: canonicalRegistryArtifactPath,
    expectedName: releasePackage.name,
    expectedVersion: input.version,
  });

  if (
    input.registryIntegrity !== undefined &&
    registryArtifact.integrity !== input.registryIntegrity
  ) {
    throw new Error(
      `${releasePackage.name}@${input.version} ${input.registryDigestSource} integrity mismatch.`,
    );
  }

  if (registryArtifact.shasum !== input.registryShasum) {
    throw new Error(
      `${releasePackage.name}@${input.version} ${input.registryDigestSource} shasum mismatch.`,
    );
  }

  if (registryArtifact.integrity !== input.localIntegrity) {
    throw new Error(`${releasePackage.name}@${input.version} local integrity mismatch.`);
  }

  if (registryArtifact.shasum !== input.localShasum) {
    throw new Error(`${releasePackage.name}@${input.version} local shasum mismatch.`);
  }

  const [localBytes, registryBytes] = await Promise.all([
    readFile(input.localArtifactPath),
    readFile(canonicalRegistryArtifactPath),
  ]);

  if (!localBytes.equals(registryBytes)) {
    throw new Error(`${releasePackage.name}@${input.version} npm-hosted tarball bytes mismatch.`);
  }

  return registryArtifact;
}

function assertInternalDependenciesMatch(
  expected: readonly InternalReleaseSetDependency[],
  actual: readonly InternalReleaseSetDependency[],
  packageName: ReleaseSetPackageName,
): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${packageName} public metadata dependency pins differ from its artifact.`);
  }
}

async function verifyPrivateStage(input: {
  packageIndex: number;
  identity: ReleaseVerificationIdentity;
  workspaceRoot: string;
  registryArtifactRoot: string;
  localArtifact: ReleaseArtifact;
  localArtifactPath: string;
  matchingStages: unknown[];
  runNpmCommand: RunReleaseVerificationNpmCommand;
}): Promise<StagedReleasePackage> {
  const releasePackage = RELEASE_SET_PACKAGES[input.packageIndex]!;

  if (input.matchingStages.length !== 1) {
    throw new Error(
      `Found ${input.matchingStages.length} private stages for ${releasePackage.name}@${input.identity.version}; expected exactly one.`,
    );
  }

  const listedStage = parseStage(
    input.matchingStages[0],
    releasePackage.name,
    input.identity.version,
    input.identity.finalTag,
  );
  const viewResult = await input.runNpmCommand({
    args: ['stage', 'view', listedStage.id, '--json'],
    cwd: input.workspaceRoot,
  });

  if (viewResult.exitCode !== 0) {
    throw new Error(`Unable to view npm stage ${listedStage.id} for ${releasePackage.name}.`);
  }

  const viewedStage = parseStage(
    parseJson(viewResult.stdout, `${releasePackage.name} stage view`),
    releasePackage.name,
    input.identity.version,
    input.identity.finalTag,
  );

  if (JSON.stringify(viewedStage) !== JSON.stringify(listedStage)) {
    throw new Error(
      `${releasePackage.name}@${input.identity.version} stage identity changed between npm stage list and stage view.`,
    );
  }

  const downloadResult = await input.runNpmCommand({
    args: ['stage', 'download', viewedStage.id, '--json=false'],
    cwd: input.registryArtifactRoot,
  });

  if (downloadResult.exitCode !== 0) {
    throw new Error(`Unable to download npm stage ${viewedStage.id} for ${releasePackage.name}.`);
  }

  const expectedDownloadFilename = stageDownloadFilename(viewedStage);
  const downloadedFilename = readDownloadedFilename(
    downloadResult.stdout,
    expectedDownloadFilename,
  );
  const registryArtifact = await verifyRegistryArtifact({
    packageIndex: input.packageIndex,
    version: input.identity.version,
    downloadedArtifactPath: join(input.registryArtifactRoot, downloadedFilename),
    registryArtifactRoot: input.registryArtifactRoot,
    localArtifactPath: input.localArtifactPath,
    localIntegrity: input.localArtifact.integrity,
    localShasum: input.localArtifact.shasum,
    registryShasum: viewedStage.shasum,
    registryDigestSource: 'npm stage',
  });

  return { ...viewedStage, integrity: registryArtifact.integrity };
}

function readPublicPackageMetadata(
  value: Record<string, unknown>,
  packageName: ReleaseSetPackageName,
  version: string,
): {
  integrity: string;
  shasum: string;
  internalDependencies: InternalReleaseSetDependency[];
} {
  if (value.name !== packageName || value.version !== version) {
    throw new Error(`npm public package identity mismatch for ${packageName}@${version}.`);
  }

  const dist = value.dist;

  if (
    !isRecord(dist) ||
    typeof dist.integrity !== 'string' ||
    !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(dist.integrity) ||
    typeof dist.shasum !== 'string' ||
    !/^[0-9a-f]{40}$/.test(dist.shasum)
  ) {
    throw new Error(`npm returned invalid public digests for ${packageName}@${version}.`);
  }

  return {
    integrity: dist.integrity,
    shasum: dist.shasum,
    internalDependencies: readExactInternalReleaseSetDependencies(value, packageName, version),
  };
}

async function verifyPublicPackage(input: {
  packageIndex: number;
  identity: ReleaseVerificationIdentity;
  registryArtifactRoot: string;
  localArtifact: ReleaseArtifact;
  localArtifactPath: string;
  publicMetadata: Record<string, unknown>;
  matchingStages: unknown[];
  runNpmCommand: RunReleaseVerificationNpmCommand;
}): Promise<PublicReleasePackage> {
  const releasePackage = RELEASE_SET_PACKAGES[input.packageIndex]!;

  if (input.matchingStages.length > 0) {
    throw new Error(
      `Unexpected same-version npm stage exists for public ${releasePackage.name}@${input.identity.version}.`,
    );
  }

  const publicMetadata = readPublicPackageMetadata(
    input.publicMetadata,
    releasePackage.name,
    input.identity.version,
  );
  assertInternalDependenciesMatch(
    input.localArtifact.internalDependencies,
    publicMetadata.internalDependencies,
    releasePackage.name,
  );

  const expectedArtifactFilename = `${releasePackage.artifactPrefix}-${input.identity.version}.tgz`;
  const packResult = await input.runNpmCommand({
    args: [
      'pack',
      `${releasePackage.name}@${input.identity.version}`,
      '--ignore-scripts',
      '--json',
    ],
    cwd: input.registryArtifactRoot,
  });

  if (packResult.exitCode !== 0) {
    throw new Error(
      `Unable to fetch public ${releasePackage.name}@${input.identity.version} from npm.`,
    );
  }

  const downloadedFilename = readPackedFilename(packResult.stdout, expectedArtifactFilename);
  const registryArtifact = await verifyRegistryArtifact({
    packageIndex: input.packageIndex,
    version: input.identity.version,
    downloadedArtifactPath: join(input.registryArtifactRoot, downloadedFilename),
    registryArtifactRoot: input.registryArtifactRoot,
    localArtifactPath: input.localArtifactPath,
    localIntegrity: input.localArtifact.integrity,
    localShasum: input.localArtifact.shasum,
    registryIntegrity: publicMetadata.integrity,
    registryShasum: publicMetadata.shasum,
    registryDigestSource: 'public',
  });

  return {
    packageName: releasePackage.name,
    version: input.identity.version,
    integrity: registryArtifact.integrity,
    shasum: registryArtifact.shasum,
  };
}

function readDistTags(value: unknown, packageName: ReleaseSetPackageName): NpmDistTags {
  if (!isRecord(value)) {
    throw new RetryableReadError(`npm returned invalid dist-tags for ${packageName}.`);
  }

  for (const tag of ['latest', 'next'] as const) {
    if (value[tag] !== undefined && typeof value[tag] !== 'string') {
      throw new RetryableReadError(`npm returned an invalid ${tag} tag for ${packageName}.`);
    }
  }

  return {
    ...(typeof value.latest === 'string' ? { latest: value.latest } : {}),
    ...(typeof value.next === 'string' ? { next: value.next } : {}),
  };
}

async function readRegistryObservation(input: {
  packageName: ReleaseSetPackageName;
  version: string;
  workspaceRoot: string;
  runNpmCommand: RunReleaseVerificationNpmCommand;
}): Promise<RegistryObservation> {
  const publicResult = await input.runNpmCommand({
    args: [
      'view',
      `${input.packageName}@${input.version}`,
      'name',
      'version',
      'dist',
      'dependencies',
      '--json',
    ],
    cwd: input.workspaceRoot,
  });
  const listResult = await input.runNpmCommand({
    args: ['stage', 'list', input.packageName, '--json'],
    cwd: input.workspaceRoot,
  });
  const distTagsResult = await input.runNpmCommand({
    args: ['view', input.packageName, 'dist-tags', '--json'],
    cwd: input.workspaceRoot,
  });

  if (listResult.exitCode !== 0) {
    throw new RetryableReadError(
      `Unable to inspect private stages for ${input.packageName}; authenticated npm access is required.`,
    );
  }

  if (distTagsResult.exitCode !== 0) {
    throw new RetryableReadError(`Unable to inspect npm dist-tags for ${input.packageName}.`);
  }

  const listValue = parseJson(listResult.stdout, `${input.packageName} stage list`);

  if (!Array.isArray(listValue)) {
    throw new RetryableReadError(`npm returned invalid stage-list JSON for ${input.packageName}.`);
  }

  const matchingStages = listValue.filter(
    (value) => isRecord(value) && value.version === input.version,
  );
  let publicMetadata: Record<string, unknown> | undefined;

  if (publicResult.exitCode === 0) {
    const publicValue = parseJson(publicResult.stdout, `${input.packageName} public metadata`);

    if (!isRecord(publicValue)) {
      throw new RetryableReadError(
        `npm returned invalid public metadata for ${input.packageName}.`,
      );
    }

    publicMetadata = publicValue;
  } else if (!/\bE404\b/.test(`${publicResult.stdout}\n${publicResult.stderr}`)) {
    throw new RetryableReadError(`Unable to inspect public ${input.packageName}@${input.version}.`);
  }

  if (!publicMetadata && matchingStages.length === 0) {
    throw new RetryableReadError(
      `${input.packageName}@${input.version} is neither publicly visible nor present as a private stage.`,
    );
  }

  if (publicMetadata && matchingStages.length > 0) {
    throw new RetryableReadError(
      `Unexpected same-version npm stage exists for public ${input.packageName}@${input.version}.`,
    );
  }

  return {
    packageName: input.packageName,
    ...(publicMetadata ? { publicMetadata } : {}),
    matchingStages,
    distTags: readDistTags(
      parseJson(distTagsResult.stdout, `${input.packageName} dist-tags`),
      input.packageName,
    ),
  };
}

async function readRegistryObservationWithRetry(input: {
  packageName: ReleaseSetPackageName;
  version: string;
  identity: ReleaseVerificationIdentity;
  baseline: ReleaseChannelBaseline;
  workspaceRoot: string;
  runNpmCommand: RunReleaseVerificationNpmCommand;
  wait: (milliseconds: number) => Promise<void>;
}): Promise<RegistryObservation> {
  return readWithBoundedRetry({
    async read() {
      const observation = await readRegistryObservation(input);
      assertDistTags(observation, input.identity, input.baseline);
      return observation;
    },
    wait: input.wait,
    terminalMessage: `State remained ambiguous after ${READ_ATTEMPTS} read attempts over ${(READ_ATTEMPTS - 1) * READ_RETRY_DELAY_MS}ms. Stop and inspect npm public, staged, and dist-tag state; do not approve or repeat a mutation.`,
  });
}

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

async function readReleaseChannelBaseline(input: {
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

  const tagResult = await input.runCommand({
    command: 'git',
    args: ['tag', '--merged', input.sourceSha, '--list', 'v*'],
    cwd: input.workspaceRoot,
  });
  const versions = tagResult.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((tag) => ({ tag, version: tag.startsWith('v') ? tag.slice(1) : '' }));
  const stableVersions = versions
    .filter(({ version }) => parseExactReleaseSetVersion(version)?.channel === 'stable')
    .map(({ version }) => version)
    .sort((left, right) => compareExactStableVersions(right, left));
  const releaseCandidateVersions = versions
    .filter(({ version }) => parseExactReleaseSetVersion(version)?.channel === 'rc')
    .map(({ version }) => version)
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

function expectedTagVersion(
  tag: 'latest' | 'next',
  observation: RegistryObservation,
  identity: ReleaseVerificationIdentity,
  baseline: ReleaseChannelBaseline,
): string | undefined {
  if (tag === identity.finalTag && observation.publicMetadata) {
    return identity.version;
  }

  return baseline[tag];
}

function assertDistTags(
  observation: RegistryObservation,
  identity: ReleaseVerificationIdentity,
  baseline: ReleaseChannelBaseline,
): void {
  const { latest, next } = observation.distTags;

  if (next !== undefined && parseExactReleaseSetVersion(next)?.channel !== 'rc') {
    throw new Error(
      `${observation.packageName} next tag must point to a genuine RC version, found ${next}.`,
    );
  }

  if (next !== undefined && next === latest) {
    throw new Error(
      `${observation.packageName} next and latest must differ, but both point to ${next}.`,
    );
  }

  for (const tag of ['latest', 'next'] as const) {
    const expected = expectedTagVersion(tag, observation, identity, baseline);
    const actual = observation.distTags[tag];

    if (actual !== expected) {
      throw new RetryableReadError(
        `${observation.packageName} ${tag} tag expected ${expected ?? 'not set'}, found ${actual ?? 'not set'}.`,
      );
    }
  }
}

function assertDependencyOrder(observations: readonly RegistryObservation[]): number {
  let privatePackageSeen = false;
  let publicCount = 0;

  for (const observation of observations) {
    if (!observation.publicMetadata) {
      privatePackageSeen = true;
      continue;
    }

    publicCount += 1;

    if (privatePackageSeen) {
      throw new Error(
        `Release Set approval order mismatch: ${observation.packageName} is public while an earlier dependency remains private.`,
      );
    }
  }

  return publicCount;
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
  const releasesResult = await input.runCommand({
    command: 'gh',
    args: ['api', '--paginate', '--slurp', `repos/${GITHUB_REPOSITORY}/releases?per_page=100`],
    cwd: input.workspaceRoot,
    errorDetail: 'none',
  });
  const matchingReleases = flattenGithubReleasePages(
    parseJson(releasesResult.stdout, 'GitHub Releases'),
  ).filter((release) => release.tag_name === input.identity.gitTag);

  if (matchingReleases.length !== 1) {
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
  const tagSha = readRemoteTagSha(remoteTagResult.stdout, input.identity.gitTag);

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

async function readGithubReleaseStateWithRetry(input: {
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

function hasExactVersionLine(output: string, version: string): boolean {
  return output.split(/\r?\n/).some((line) => line.trim() === version);
}

async function verifyExactVersionCreateEntrypoint(input: {
  version: string;
  operationRoot: string;
  runCommand: RunReleaseCommand;
}): Promise<void> {
  const result = await input.runCommand({
    command: 'pnpm',
    args: ['--config.minimumReleaseAge=0', 'create', `tenkit@${input.version}`, '--version'],
    cwd: input.operationRoot,
    env: {
      npm_config_registry: PUBLIC_REGISTRY,
      npm_config_cache: join(input.operationRoot, '.npm-cache'),
    },
    errorDetail: 'none',
  });

  if (!hasExactVersionLine(result.stdout, input.version)) {
    throw new Error(`Exact-version create-tenkit did not report exact version ${input.version}.`);
  }
}

async function assertPathIsDirectory(path: string): Promise<void> {
  const stats = await lstat(path);

  if (!stats.isDirectory()) {
    throw new Error('Release Verification workspace root is not a directory.');
  }
}

function defaultWait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function runReleaseVerificationCommand(
  input: RunReleaseVerificationCommandInput,
): Promise<number> {
  const identity = parseArguments(input.args);
  await assertPathIsDirectory(input.workspaceRoot);
  const executeNpmCommand = input.runNpmCommand ?? runReleaseVerificationNpmCommand;
  const runNpmCommand: RunReleaseVerificationNpmCommand = (command) =>
    executeNpmCommand({
      ...command,
      args:
        command.args[0] === '--version'
          ? command.args
          : [...command.args, '--registry', PUBLIC_REGISTRY],
    });
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
  const reproductionRoot = join(operationRoot, 'reproduction');
  const registryArtifactRoot = join(operationRoot, 'registry');

  try {
    await mkdir(registryArtifactRoot);
    const reproduction = await (input.reproduceReleaseSet ?? reproduceCanonicalReleaseSet)({
      repositoryRoot: input.workspaceRoot,
      outputRoot: reproductionRoot,
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

    const observations: RegistryObservation[] = [];

    for (const releasePackage of RELEASE_SET_PACKAGES) {
      const observation = await readRegistryObservationWithRetry({
        packageName: releasePackage.name,
        version: identity.version,
        identity,
        baseline,
        workspaceRoot: input.workspaceRoot,
        runNpmCommand,
        wait,
      });
      observations.push(observation);
    }

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
      const localArtifact = reproduction.packages[packageIndex]!;
      const localArtifactPath = reproduction.artifactPaths[packageIndex]!;

      registryPackages.push(
        observation.publicMetadata
          ? await verifyPublicPackage({
              packageIndex,
              identity,
              registryArtifactRoot,
              localArtifact,
              localArtifactPath,
              publicMetadata: observation.publicMetadata,
              matchingStages: observation.matchingStages,
              runNpmCommand,
            })
          : await verifyPrivateStage({
              packageIndex,
              identity,
              workspaceRoot: input.workspaceRoot,
              registryArtifactRoot,
              localArtifact,
              localArtifactPath,
              matchingStages: observation.matchingStages,
              runNpmCommand,
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

    const stages = registryPackages.filter(
      (registryPackage): registryPackage is StagedReleasePackage => 'id' in registryPackage,
    );
    const state =
      publicCount === 0
        ? 'fully private'
        : publicCount < RELEASE_SET_PACKAGES.length
          ? `partial public (${publicCount}/${RELEASE_SET_PACKAGES.length})`
          : githubState.publication === 'draft'
            ? 'complete public'
            : 'published';
    const nextStage = stages[0];
    const nextAction = nextStage
      ? `Approve ${nextStage.packageName}@${identity.version} with npm 2FA, then rerun this command.`
      : githubState.publication === 'draft'
        ? `Publish the existing GitHub draft ${identity.gitTag}, then rerun this command.`
        : identity.channel === 'stable'
          ? 'Run pnpm create tenkit@latest --version outside this workspace.'
          : 'Release Set publication is complete; no release mutation remains.';

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
