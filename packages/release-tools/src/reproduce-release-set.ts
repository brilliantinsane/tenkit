import { lstat, mkdir, mkdtemp, readdir, rename, rm, unlink } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import { parseExactStableVersion } from './exact-stable-version';
import { inspectReleaseArtifact, type ReleaseArtifact } from './release-artifacts';
import { runReleaseCommand, type RunReleaseCommand } from './run-release-command';
import { RELEASE_SET_PACKAGES } from './release-set.ts';
import { runReleaseContainer, type RunReleaseContainer } from './run-release-container';

type ExtractReleaseSourceInput = {
  repositoryRoot: string;
  sourceRoot: string;
  sourceSha: string;
  runCommand?: RunReleaseCommand;
};

type ExtractReleaseSource = (input: ExtractReleaseSourceInput) => Promise<void>;

type ReproduceReleaseSetInput = {
  repositoryRoot: string;
  outputRoot: string;
  sourceSha: string;
  version: string;
  extractSource?: ExtractReleaseSource;
  runContainer?: RunReleaseContainer;
  runCommand?: RunReleaseCommand;
};

type ReleaseSetReproduction = {
  sourceSha: string;
  version: string;
  artifactPaths: string[];
  packages: ReleaseArtifact[];
};

type AssertReleaseSetArtifactsMatchInput = {
  expectedPackages: readonly ReleaseArtifact[];
  artifactPaths: readonly string[];
  expectedVersion: string;
};

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

function validateIdentity(sourceSha: string, version: string): void {
  if (!/^[0-9a-f]{40}$/.test(sourceSha)) {
    throw new Error('Release Set reproduction requires one full lowercase source SHA.');
  }

  if (!parseExactStableVersion(version)) {
    throw new Error('Release Set reproduction requires one exact major.minor.patch version.');
  }
}

async function extractReleaseSource(input: ExtractReleaseSourceInput): Promise<void> {
  const runCommand = input.runCommand ?? runReleaseCommand;
  const archivePath = `${input.sourceRoot}.tar`;
  await mkdir(input.sourceRoot, { recursive: true });

  try {
    const resolvedSource = await runCommand({
      command: 'git',
      args: ['rev-parse', `${input.sourceSha}^{commit}`],
      cwd: input.repositoryRoot,
    });

    if (resolvedSource.stdout.trim() !== input.sourceSha) {
      throw new Error(
        `Reviewed Release Set source ${input.sourceSha} resolved to ${resolvedSource.stdout.trim()}.`,
      );
    }

    await runCommand({
      command: 'git',
      args: ['archive', '--format=tar', `--output=${archivePath}`, input.sourceSha],
      cwd: input.repositoryRoot,
    });
    await runCommand({
      command: 'tar',
      args: ['-xf', archivePath, '-C', input.sourceRoot],
      cwd: input.repositoryRoot,
    });
  } finally {
    if (await pathExists(archivePath)) {
      await unlink(archivePath);
    }
  }
}

function artifactPaths(artifactRoot: string, version: string): string[] {
  return RELEASE_SET_PACKAGES.map((releasePackage) =>
    join(artifactRoot, `${releasePackage.artifactPrefix}-${version}.tgz`),
  );
}

async function inspectReleaseSetArtifacts(
  paths: readonly string[],
  expectedVersion: string,
): Promise<ReleaseArtifact[]> {
  return Promise.all(
    RELEASE_SET_PACKAGES.map((releasePackage, index) =>
      inspectReleaseArtifact({
        artifactPath: paths[index]!,
        expectedName: releasePackage.name,
        expectedVersion,
      }),
    ),
  );
}

export async function reproduceReleaseSet(
  input: ReproduceReleaseSetInput,
): Promise<ReleaseSetReproduction> {
  validateIdentity(input.sourceSha, input.version);

  if (await pathExists(input.outputRoot)) {
    throw new Error('Release Set reproduction output directory already exists.');
  }

  const outputParent = dirname(input.outputRoot);
  const outputParentStats = await lstat(outputParent);

  if (!outputParentStats.isDirectory()) {
    throw new Error('Release Set reproduction output parent is not a directory.');
  }

  const operationRoot = await mkdtemp(join(outputParent, '.tenkit-release-reproduction-'));
  const sourceRoot = join(operationRoot, 'source');
  const artifactRoot = join(operationRoot, 'artifacts');

  try {
    await (input.extractSource ?? extractReleaseSource)({
      repositoryRoot: input.repositoryRoot,
      sourceRoot,
      sourceSha: input.sourceSha,
      runCommand: input.runCommand,
    });
    await mkdir(artifactRoot);
    await (input.runContainer ?? runReleaseContainer)({
      sourceRoot,
      artifactRoot,
      version: input.version,
      runCommand: input.runCommand,
    });
    const temporaryArtifactPaths = artifactPaths(artifactRoot, input.version);
    const expectedFilenames = temporaryArtifactPaths.map((path) => basename(path)).sort();
    const actualFilenames = (await readdir(artifactRoot)).sort();

    if (JSON.stringify(actualFilenames) !== JSON.stringify(expectedFilenames)) {
      throw new Error(`Release Set reproduction expected exactly ${expectedFilenames.join(', ')}.`);
    }

    const packages = await inspectReleaseSetArtifacts(temporaryArtifactPaths, input.version);
    await rename(artifactRoot, input.outputRoot);

    return {
      sourceSha: input.sourceSha,
      version: input.version,
      artifactPaths: artifactPaths(input.outputRoot, input.version),
      packages,
    };
  } finally {
    await rm(operationRoot, { recursive: true });
  }
}

export async function assertReleaseSetArtifactsMatch(
  input: AssertReleaseSetArtifactsMatchInput,
): Promise<void> {
  if (input.expectedPackages.length !== RELEASE_SET_PACKAGES.length) {
    throw new Error(
      `Release Set comparison requires exactly ${RELEASE_SET_PACKAGES.length} packages.`,
    );
  }

  if (input.artifactPaths.length !== RELEASE_SET_PACKAGES.length) {
    throw new Error(
      `Release Set comparison requires exactly ${RELEASE_SET_PACKAGES.length} artifacts.`,
    );
  }

  const actualPackages = await inspectReleaseSetArtifacts(
    input.artifactPaths,
    input.expectedVersion,
  );

  for (const [index, expectedPackage] of input.expectedPackages.entries()) {
    const releasePackage = RELEASE_SET_PACKAGES[index];
    const actualPackage = actualPackages[index];

    if (
      !releasePackage ||
      expectedPackage.name !== releasePackage.name ||
      expectedPackage.version !== input.expectedVersion ||
      !actualPackage ||
      actualPackage.name !== expectedPackage.name
    ) {
      throw new Error(`Release Set package ${index + 1} identity mismatch.`);
    }

    if (actualPackage.shasum !== expectedPackage.shasum) {
      throw new Error(`${expectedPackage.artifactFilename} shasum mismatch.`);
    }

    if (actualPackage.integrity !== expectedPackage.integrity) {
      throw new Error(`${expectedPackage.artifactFilename} integrity mismatch.`);
    }

    if (JSON.stringify(actualPackage) !== JSON.stringify(expectedPackage)) {
      throw new Error(`${expectedPackage.artifactFilename} package identity mismatch.`);
    }
  }
}
