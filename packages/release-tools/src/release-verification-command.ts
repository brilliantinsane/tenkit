import { execFile } from 'node:child_process';
import { copyFile, lstat, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';

import { inspectReleaseArtifact, type ReleaseArtifact } from './release-artifacts';
import { readPinnedNpmVersion } from './npm-version-pin';
import { reproduceReleaseSet as reproduceCanonicalReleaseSet } from './reproduce-release-set';
import { RELEASE_SET_PACKAGES, type ReleaseSetPackageName } from './release-set';

const execFileAsync = promisify(execFile);
const PUBLIC_REGISTRY = 'https://registry.npmjs.org/';
const EXPECTED_STAGE_ACTOR = 'tenkit-release';
const EXPECTED_STAGE_ACTOR_TYPE = 'trusted automation';
const EXPECTED_STAGE_TAG = 'candidate';

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
  reproduceReleaseSet?: typeof reproduceCanonicalReleaseSet;
};

type StageMetadata = {
  id: string;
  packageName: ReleaseSetPackageName;
  version: string;
  tag: string;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseJson(output: string, description: string): unknown {
  try {
    return JSON.parse(output) as unknown;
  } catch (error) {
    throw new Error(`npm returned invalid JSON for ${description}.`, { cause: error });
  }
}

function parseArguments(args: readonly string[]): { sourceSha: string; version: string } {
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

  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error('Release Verification requires one exact stable major.minor.patch version.');
  }

  return { sourceSha, version };
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

  if (value.tag !== EXPECTED_STAGE_TAG) {
    throw new Error(
      `${expectedPackageName}@${expectedVersion} stage expected tag ${EXPECTED_STAGE_TAG}, found ${String(value.tag)}.`,
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
    tag: EXPECTED_STAGE_TAG,
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

  if (filename === '' || filename !== basename(filename) || !filename.endsWith('.tgz')) {
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
    typeof packResult[0].filename !== 'string' ||
    packResult[0].filename !== basename(packResult[0].filename) ||
    !packResult[0].filename.endsWith('.tgz')
  ) {
    throw new Error(`npm pack did not return one tarball for ${expectedFilename}.`);
  }

  return packResult[0].filename;
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

async function verifyPrivateStage(input: {
  packageIndex: number;
  version: string;
  workspaceRoot: string;
  registryArtifactRoot: string;
  localArtifactPath: string;
  localIntegrity: string;
  localShasum: string;
  matchingStages: unknown[];
  runNpmCommand: RunReleaseVerificationNpmCommand;
}): Promise<StagedReleasePackage> {
  const releasePackage = RELEASE_SET_PACKAGES[input.packageIndex]!;
  if (input.matchingStages.length === 0) {
    throw new Error(
      `No pending npm stage or public Candidate found for ${releasePackage.name}@${input.version}; it may be missing, rejected, or replaced.`,
    );
  }

  if (input.matchingStages.length !== 1) {
    throw new Error(
      `Found ${input.matchingStages.length} private stages for ${releasePackage.name}@${input.version}; expected exactly one.`,
    );
  }

  const listedStage = parseStage(input.matchingStages[0], releasePackage.name, input.version);
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
    input.version,
  );

  if (JSON.stringify(viewedStage) !== JSON.stringify(listedStage)) {
    throw new Error(
      `${releasePackage.name}@${input.version} stage identity changed between npm stage list and stage view.`,
    );
  }

  const downloadResult = await input.runNpmCommand({
    args: ['stage', 'download', viewedStage.id],
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
    version: input.version,
    downloadedArtifactPath: join(input.registryArtifactRoot, downloadedFilename),
    registryArtifactRoot: input.registryArtifactRoot,
    localArtifactPath: input.localArtifactPath,
    localIntegrity: input.localIntegrity,
    localShasum: input.localShasum,
    registryShasum: viewedStage.shasum,
    registryDigestSource: 'npm stage',
  });

  return { ...viewedStage, integrity: registryArtifact.integrity };
}

async function listStagesForVersion(input: {
  packageName: ReleaseSetPackageName;
  version: string;
  workspaceRoot: string;
  runNpmCommand: RunReleaseVerificationNpmCommand;
}): Promise<unknown[]> {
  const listResult = await input.runNpmCommand({
    args: ['stage', 'list', input.packageName, '--json'],
    cwd: input.workspaceRoot,
  });

  if (listResult.exitCode !== 0) {
    throw new Error(
      `Unable to inspect private stages for ${input.packageName}. npm stage list requires authenticated maintainer access.`,
    );
  }

  const listValue = parseJson(listResult.stdout, `${input.packageName} stage list`);

  if (!Array.isArray(listValue)) {
    throw new Error(`npm returned invalid stage-list JSON for ${input.packageName}.`);
  }

  return listValue.filter((value) => isRecord(value) && value.version === input.version);
}

function readPublicDigests(
  value: unknown,
  packageName: ReleaseSetPackageName,
  version: string,
): { integrity: string; shasum: string } {
  if (!isRecord(value) || value.name !== packageName || value.version !== version) {
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

  return { integrity: dist.integrity, shasum: dist.shasum };
}

async function verifyPublicCandidate(input: {
  packageIndex: number;
  version: string;
  workspaceRoot: string;
  registryArtifactRoot: string;
  localArtifactPath: string;
  localIntegrity: string;
  localShasum: string;
  publicMetadata: unknown;
  matchingStages: unknown[];
  runNpmCommand: RunReleaseVerificationNpmCommand;
}): Promise<PublicReleasePackage> {
  const releasePackage = RELEASE_SET_PACKAGES[input.packageIndex]!;

  if (input.matchingStages.length > 0) {
    throw new Error(
      `Unexpected same-version npm stage exists for public ${releasePackage.name}@${input.version}.`,
    );
  }

  const publicDigests = readPublicDigests(input.publicMetadata, releasePackage.name, input.version);
  const candidateResult = await input.runNpmCommand({
    args: ['view', releasePackage.name, 'dist-tags.candidate', '--json'],
    cwd: input.workspaceRoot,
  });

  if (candidateResult.exitCode !== 0) {
    throw new Error(`Unable to inspect ${releasePackage.name} candidate tag.`);
  }

  const candidateVersion = parseJson(
    candidateResult.stdout,
    `${releasePackage.name} candidate tag`,
  );

  if (candidateVersion !== input.version) {
    throw new Error(
      `${releasePackage.name} candidate tag expected ${input.version}, found ${String(candidateVersion)}.`,
    );
  }

  const packResult = await input.runNpmCommand({
    args: ['pack', `${releasePackage.name}@${input.version}`, '--ignore-scripts', '--json'],
    cwd: input.registryArtifactRoot,
  });

  if (packResult.exitCode !== 0) {
    throw new Error(`Unable to fetch public ${releasePackage.name}@${input.version} from npm.`);
  }

  const expectedArtifactFilename = `${releasePackage.artifactPrefix}-${input.version}.tgz`;
  const downloadedFilename = readPackedFilename(packResult.stdout, expectedArtifactFilename);
  const registryArtifact = await verifyRegistryArtifact({
    packageIndex: input.packageIndex,
    version: input.version,
    downloadedArtifactPath: join(input.registryArtifactRoot, downloadedFilename),
    registryArtifactRoot: input.registryArtifactRoot,
    localArtifactPath: input.localArtifactPath,
    localIntegrity: input.localIntegrity,
    localShasum: input.localShasum,
    registryIntegrity: publicDigests.integrity,
    registryShasum: publicDigests.shasum,
    registryDigestSource: 'public',
  });

  return {
    packageName: releasePackage.name,
    version: input.version,
    integrity: registryArtifact.integrity,
    shasum: registryArtifact.shasum,
  };
}

async function assertPathIsDirectory(path: string): Promise<void> {
  const stats = await lstat(path);

  if (!stats.isDirectory()) {
    throw new Error('Release Verification workspace root is not a directory.');
  }
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
  const pinnedNpmVersion = await readPinnedNpmVersion(input.workspaceRoot);
  const npmVersion = await runNpmCommand({ args: ['--version'], cwd: input.workspaceRoot });

  if (npmVersion.exitCode !== 0 || npmVersion.stdout.trim() !== pinnedNpmVersion) {
    throw new Error(
      `Release Verification requires npm ${pinnedNpmVersion}, but found ${npmVersion.stdout.trim() || 'an unavailable npm CLI'} on PATH.`,
    );
  }

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
    const registryPackages: Array<StagedReleasePackage | PublicReleasePackage> = [];

    for (const [packageIndex, releasePackage] of RELEASE_SET_PACKAGES.entries()) {
      const publicResult = await runNpmCommand({
        args: [
          'view',
          `${releasePackage.name}@${identity.version}`,
          'name',
          'version',
          'dist',
          'dependencies',
          '--json',
        ],
        cwd: input.workspaceRoot,
      });
      const matchingStages = await listStagesForVersion({
        packageName: releasePackage.name,
        version: identity.version,
        workspaceRoot: input.workspaceRoot,
        runNpmCommand,
      });

      if (publicResult.exitCode === 0) {
        registryPackages.push(
          await verifyPublicCandidate({
            packageIndex,
            version: identity.version,
            workspaceRoot: input.workspaceRoot,
            registryArtifactRoot,
            localArtifactPath: reproduction.artifactPaths[packageIndex]!,
            localIntegrity: reproduction.packages[packageIndex]!.integrity,
            localShasum: reproduction.packages[packageIndex]!.shasum,
            publicMetadata: parseJson(
              publicResult.stdout,
              `${releasePackage.name} public metadata`,
            ),
            matchingStages,
            runNpmCommand,
          }),
        );
        continue;
      }

      if (!/\bE404\b/.test(`${publicResult.stdout}\n${publicResult.stderr}`)) {
        throw new Error(`Unable to inspect public ${releasePackage.name}@${identity.version}.`);
      }

      registryPackages.push(
        await verifyPrivateStage({
          packageIndex,
          version: identity.version,
          workspaceRoot: input.workspaceRoot,
          registryArtifactRoot,
          localArtifactPath: reproduction.artifactPaths[packageIndex]!,
          localIntegrity: reproduction.packages[packageIndex]!.integrity,
          localShasum: reproduction.packages[packageIndex]!.shasum,
          matchingStages,
          runNpmCommand,
        }),
      );
    }

    const publicCount = registryPackages.filter(
      (registryPackage) => !('id' in registryPackage),
    ).length;
    let privatePackageSeen = false;

    for (const registryPackage of registryPackages) {
      if ('id' in registryPackage) {
        privatePackageSeen = true;
      } else if (privatePackageSeen) {
        throw new Error(
          `Release Set approval order mismatch: ${registryPackage.packageName} is public while an earlier dependency remains private.`,
        );
      }
    }

    const stages = registryPackages.filter(
      (registryPackage): registryPackage is StagedReleasePackage => 'id' in registryPackage,
    );
    const state =
      publicCount === 0
        ? 'fully private'
        : publicCount === RELEASE_SET_PACKAGES.length
          ? 'complete Candidate'
          : 'partial Candidate';
    const nextStage = stages[0];

    input.write(
      [
        'Release Verification: PASS',
        `Source SHA: ${identity.sourceSha}`,
        `Version: ${identity.version}`,
        `State: ${state}`,
        ...registryPackages.flatMap((registryPackage) => [
          'id' in registryPackage
            ? `${registryPackage.packageName}: private stage ${registryPackage.id} by ${registryPackage.actor} (${registryPackage.actorType})`
            : `${registryPackage.packageName}: public Candidate`,
          `  integrity: ${registryPackage.integrity}`,
          `  shasum: ${registryPackage.shasum}`,
        ]),
        ...(nextStage
          ? [`Next approval: ${nextStage.packageName}`, `npm stage approve ${nextStage.id}`]
          : [`Next action: pnpm release:smoke -- --version ${identity.version}`]),
        '',
      ].join('\n'),
    );
    return 0;
  } finally {
    await rm(operationRoot, { recursive: true });
  }
}
