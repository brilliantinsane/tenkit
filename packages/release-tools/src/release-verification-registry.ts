import { copyFile, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { parseExactReleaseSetVersion } from './exact-release-set-version';
import { inspectReleaseArtifact, type ReleaseArtifact } from './release-artifacts';
import {
  readExactInternalReleaseSetDependencies,
  type InternalReleaseSetDependency,
} from './release-set-dependencies';
import { RELEASE_SET_PACKAGES, type ReleaseSetPackageName } from './release-set';
import { isRecord, parseJson } from './release-verification-json';
import type { RunReleaseVerificationNpmCommand } from './release-verification-npm';
import type { ReleaseVerificationIdentity } from './release-verification-policy';
import type { ReleaseChannelBaseline } from './release-verification-repository';
import {
  READ_ATTEMPTS,
  READ_RETRY_DELAY_MS,
  RetryableReadError,
  readWithBoundedRetry,
} from './release-verification-retry';

const EXPECTED_STAGE_ACTOR = 'GitHub Actions';
const EXPECTED_STAGE_ACTOR_TYPE = 'trusted automation';

function parseRegistryReadJson(output: string, description: string): unknown {
  try {
    return parseJson(output, description);
  } catch (error) {
    throw new RetryableReadError(`npm returned unreadable ${description}.`, { cause: error });
  }
}

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

export type StagedReleasePackage = StageMetadata & { integrity: string };

export type PublicReleasePackage = {
  packageName: ReleaseSetPackageName;
  version: string;
  integrity: string;
  shasum: string;
};

type NpmDistTags = {
  latest?: string;
  next?: string;
};

export type RegistryObservation = {
  packageName: ReleaseSetPackageName;
  publicMetadata?: Record<string, unknown>;
  matchingStages: unknown[];
  distTags: NpmDistTags;
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
  wait: (milliseconds: number) => Promise<void>;
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
  const viewedStageValue = await readWithBoundedRetry({
    async read() {
      const viewResult = await input.runNpmCommand({
        args: ['stage', 'view', listedStage.id, '--json'],
        cwd: input.workspaceRoot,
      });

      if (viewResult.exitCode !== 0) {
        throw new RetryableReadError(
          `Unable to view npm stage ${listedStage.id} for ${releasePackage.name}.`,
        );
      }

      return parseRegistryReadJson(viewResult.stdout, `${releasePackage.name} stage view`);
    },
    wait: input.wait,
    terminalMessage: `Stage ${listedStage.id} remained unreadable after ${READ_ATTEMPTS} attempts. Stop and inspect the private stage; do not approve or repeat a mutation.`,
  });
  const viewedStage = parseStage(
    viewedStageValue,
    releasePackage.name,
    input.identity.version,
    input.identity.finalTag,
  );

  if (JSON.stringify(viewedStage) !== JSON.stringify(listedStage)) {
    throw new Error(
      `${releasePackage.name}@${input.identity.version} stage identity changed between npm stage list and stage view.`,
    );
  }

  const expectedDownloadFilename = stageDownloadFilename(viewedStage);
  const downloadedFilename = await readWithBoundedRetry({
    async read() {
      const downloadResult = await input.runNpmCommand({
        args: ['stage', 'download', viewedStage.id, '--json=false'],
        cwd: input.registryArtifactRoot,
      });

      if (downloadResult.exitCode !== 0) {
        throw new RetryableReadError(
          `Unable to download npm stage ${viewedStage.id} for ${releasePackage.name}.`,
        );
      }

      try {
        return readDownloadedFilename(downloadResult.stdout, expectedDownloadFilename);
      } catch (error) {
        throw new RetryableReadError(
          `npm returned an unreadable stage download for ${releasePackage.name}.`,
          { cause: error },
        );
      }
    },
    wait: input.wait,
    terminalMessage: `Stage ${viewedStage.id} could not be downloaded after ${READ_ATTEMPTS} attempts. Stop and inspect the private stage; do not approve or repeat a mutation.`,
  });
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
  wait: (milliseconds: number) => Promise<void>;
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
  const downloadedFilename = await readWithBoundedRetry({
    async read() {
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
        throw new RetryableReadError(
          `Unable to fetch public ${releasePackage.name}@${input.identity.version} from npm.`,
        );
      }

      try {
        return readPackedFilename(packResult.stdout, expectedArtifactFilename);
      } catch (error) {
        throw new RetryableReadError(
          `npm returned an unreadable pack result for ${releasePackage.name}@${input.identity.version}.`,
          { cause: error },
        );
      }
    },
    wait: input.wait,
    terminalMessage: `Public ${releasePackage.name}@${input.identity.version} could not be fetched after ${READ_ATTEMPTS} attempts. Stop and inspect npm; do not repeat a mutation.`,
  });
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

  const listValue = parseRegistryReadJson(
    listResult.stdout,
    `${input.packageName} stage-list JSON`,
  );

  if (!Array.isArray(listValue)) {
    throw new RetryableReadError(`npm returned invalid stage-list JSON for ${input.packageName}.`);
  }

  const matchingStages = listValue.filter(
    (value) => isRecord(value) && value.version === input.version,
  );
  let publicMetadata: Record<string, unknown> | undefined;

  if (publicResult.exitCode === 0) {
    const publicValue = parseRegistryReadJson(
      publicResult.stdout,
      `${input.packageName} public metadata`,
    );

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
      parseRegistryReadJson(distTagsResult.stdout, `${input.packageName} dist-tags`),
      input.packageName,
    ),
  };
}

export async function readRegistryObservationWithRetry(input: {
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

export function assertDependencyOrder(observations: readonly RegistryObservation[]): number {
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

export async function verifyRegistryPackage(input: {
  packageIndex: number;
  identity: ReleaseVerificationIdentity;
  workspaceRoot: string;
  registryArtifactRoot: string;
  localArtifact: ReleaseArtifact;
  localArtifactPath: string;
  observation: RegistryObservation;
  runNpmCommand: RunReleaseVerificationNpmCommand;
  wait: (milliseconds: number) => Promise<void>;
}): Promise<StagedReleasePackage | PublicReleasePackage> {
  return input.observation.publicMetadata
    ? verifyPublicPackage({
        packageIndex: input.packageIndex,
        identity: input.identity,
        registryArtifactRoot: input.registryArtifactRoot,
        localArtifact: input.localArtifact,
        localArtifactPath: input.localArtifactPath,
        publicMetadata: input.observation.publicMetadata,
        matchingStages: input.observation.matchingStages,
        runNpmCommand: input.runNpmCommand,
        wait: input.wait,
      })
    : verifyPrivateStage({
        packageIndex: input.packageIndex,
        identity: input.identity,
        workspaceRoot: input.workspaceRoot,
        registryArtifactRoot: input.registryArtifactRoot,
        localArtifact: input.localArtifact,
        localArtifactPath: input.localArtifactPath,
        matchingStages: input.observation.matchingStages,
        runNpmCommand: input.runNpmCommand,
        wait: input.wait,
      });
}
