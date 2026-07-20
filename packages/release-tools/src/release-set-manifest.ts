import type { ReleaseSetPlan } from './release-plan';
import { getReleaseSetPackage, RELEASE_SET_PACKAGES } from './release-set';
import type { ReleaseToolchain } from './release-toolchain';

const PROVENANCE_REPOSITORY = 'https://github.com/brilliantinsane/tenkit';
const STAGED_TAG = 'candidate';

export type InternalReleaseDependency = {
  name: string;
  version: string;
};

export type PackedReleasePackage = {
  name: string;
  root: string;
  version: string;
  artifactFilename: string;
  size: number;
  integrity: string;
  shasum: string;
  internalDependencies: InternalReleaseDependency[];
};

export type ReleaseSetManifestPackage = {
  name: string;
  root: string;
  version: string;
  dependencyOrder: number;
  artifact: {
    filename: string;
    size: number;
    integrity: string;
    shasum: string;
  };
  internalDependencies: InternalReleaseDependency[];
  provenance: {
    repository: string;
    sourceSha: string;
  };
};

export type ReleaseSetManifest = {
  schemaVersion: 1;
  sourceSha: string;
  version: string;
  previousStableTag: {
    name: string;
    version: string;
    sha: string;
  };
  contributingCommits: Array<{
    sha: string;
    title: string;
    paths: string[];
    impact: 'patch' | 'minor' | 'major';
  }>;
  stagedTag: 'candidate';
  toolchain: ReleaseToolchain;
  createdAt: string;
  packages: ReleaseSetManifestPackage[];
};

type CreateReleaseSetManifestInput = {
  plan: Extract<ReleaseSetPlan, { kind: 'release' }>;
  packedPackages: readonly PackedReleasePackage[];
  toolchain: ReleaseToolchain;
  createdAt?: string;
};

function objectRecord(value: unknown, description: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${description} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function exactString(value: unknown, description: string, pattern?: RegExp): string {
  if (typeof value !== 'string' || value.length === 0 || (pattern && !pattern.test(value))) {
    throw new Error(`${description} is invalid.`);
  }

  return value;
}

function exactVersion(value: unknown, description: string): string {
  return exactString(value, description, /^\d+\.\d+\.\d+$/);
}

function exactSha(value: unknown, description: string): string {
  return exactString(value, description, /^[0-9a-f]{40}$/);
}

function parseToolchain(value: unknown): ReleaseToolchain {
  const toolchain = objectRecord(value, 'Release Set manifest toolchain');

  return {
    node: exactVersion(toolchain.node, 'Release Set manifest Node version'),
    npm: exactVersion(toolchain.npm, 'Release Set manifest npm version'),
    pnpm: exactVersion(toolchain.pnpm, 'Release Set manifest pnpm version'),
  };
}

function expectedInternalDependencies(
  packageName: string,
  version: string,
): InternalReleaseDependency[] {
  const releasePackage = getReleaseSetPackage(packageName);
  return 'internalDependency' in releasePackage
    ? [{ name: releasePackage.internalDependency, version }]
    : [];
}

function parseInternalDependencies(
  value: unknown,
  packageName: string,
  releaseVersion: string,
): InternalReleaseDependency[] {
  if (!Array.isArray(value)) {
    throw new Error(
      `Release Set manifest internal dependencies for ${packageName} must be an array.`,
    );
  }

  const dependencies = value.map((entry) => {
    const dependency = objectRecord(entry, `Internal dependency for ${packageName}`);
    return {
      name: exactString(dependency.name, `Internal dependency name for ${packageName}`),
      version: exactVersion(dependency.version, `Internal dependency version for ${packageName}`),
    };
  });
  const expectedDependencies = expectedInternalDependencies(packageName, releaseVersion);

  if (dependencies.length !== expectedDependencies.length) {
    throw new Error(
      `${packageName} must record ${expectedDependencies.length} internal Release Set dependencies.`,
    );
  }

  for (const [index, expectedDependency] of expectedDependencies.entries()) {
    const dependency = dependencies[index];

    if (dependency?.name !== expectedDependency.name || dependency.version !== releaseVersion) {
      throw new Error(
        `${packageName} internal dependency ${expectedDependency.name} expected ${releaseVersion}, found ${dependency?.version ?? 'missing'}.`,
      );
    }
  }

  return dependencies;
}

function parseManifestPackage(
  value: unknown,
  index: number,
  releaseVersion: string,
  sourceSha: string,
): ReleaseSetManifestPackage {
  const releasePackage = RELEASE_SET_PACKAGES[index];

  if (!releasePackage) {
    throw new Error('Release Set manifest contains an unexpected package.');
  }

  const packageEntry = objectRecord(value, `Release Set manifest package ${releasePackage.name}`);
  const name = exactString(packageEntry.name, 'Release Set package name');
  const root = exactString(packageEntry.root, `Release Set package root for ${name}`);
  const version = exactVersion(packageEntry.version, `Release Set package version for ${name}`);

  if (name !== releasePackage.name || root !== releasePackage.root || version !== releaseVersion) {
    throw new Error(
      `Release Set package ${index + 1} must be ${releasePackage.name}@${releaseVersion} from ${releasePackage.root}.`,
    );
  }

  if (packageEntry.dependencyOrder !== index + 1) {
    throw new Error(`${name} must have dependency order ${index + 1}.`);
  }

  const artifact = objectRecord(packageEntry.artifact, `Artifact for ${name}`);
  const provenance = objectRecord(packageEntry.provenance, `Provenance expectation for ${name}`);

  if (provenance.repository !== PROVENANCE_REPOSITORY || provenance.sourceSha !== sourceSha) {
    throw new Error(`${name} provenance must target ${PROVENANCE_REPOSITORY} at ${sourceSha}.`);
  }

  if (!Number.isSafeInteger(artifact.size) || Number(artifact.size) <= 0) {
    throw new Error(`Artifact size for ${name} must be a positive integer.`);
  }

  const artifactFilename = exactString(
    artifact.filename,
    `Artifact filename for ${name}`,
    /^[^/]+\.tgz$/,
  );
  const expectedArtifactFilename = `${releasePackage.artifactPrefix}-${releaseVersion}.tgz`;

  if (artifactFilename !== expectedArtifactFilename) {
    throw new Error(`${name} artifact filename must be ${expectedArtifactFilename}.`);
  }

  return {
    name,
    root,
    version,
    dependencyOrder: index + 1,
    artifact: {
      filename: artifactFilename,
      size: Number(artifact.size),
      integrity: exactString(
        artifact.integrity,
        `Artifact integrity for ${name}`,
        /^sha512-[A-Za-z0-9+/]+={0,2}$/,
      ),
      shasum: exactString(artifact.shasum, `Artifact shasum for ${name}`, /^[0-9a-f]{40}$/),
    },
    internalDependencies: parseInternalDependencies(
      packageEntry.internalDependencies,
      name,
      releaseVersion,
    ),
    provenance: {
      repository: PROVENANCE_REPOSITORY,
      sourceSha,
    },
  };
}

export function parseReleaseSetManifest(value: unknown): ReleaseSetManifest {
  const manifest = objectRecord(value, 'Release Set manifest');

  if (manifest.schemaVersion !== 1) {
    throw new Error('Release Set manifest schemaVersion must be 1.');
  }

  const sourceSha = exactSha(manifest.sourceSha, 'Release Set manifest source SHA');
  const version = exactVersion(manifest.version, 'Release Set manifest version');
  const previousStableTag = objectRecord(
    manifest.previousStableTag,
    'Release Set manifest previous stable tag',
  );

  if (manifest.stagedTag !== STAGED_TAG) {
    throw new Error(`Release Set manifest stagedTag must be ${STAGED_TAG}.`);
  }

  const createdAt = exactString(manifest.createdAt, 'Release Set manifest creation timestamp');
  const createdAtTimestamp = Date.parse(createdAt);

  if (
    !Number.isFinite(createdAtTimestamp) ||
    new Date(createdAtTimestamp).toISOString() !== createdAt
  ) {
    throw new Error('Release Set manifest creation timestamp must be an ISO timestamp.');
  }

  const previousStableTagName = exactString(
    previousStableTag.name,
    'Previous stable tag name',
    /^v\d+\.\d+\.\d+$/,
  );
  const previousStableTagVersion = exactVersion(
    previousStableTag.version,
    'Previous stable tag version',
  );

  if (previousStableTagName !== `v${previousStableTagVersion}`) {
    throw new Error('Previous stable tag name and version must identify the same release.');
  }

  if (!Array.isArray(manifest.contributingCommits)) {
    throw new Error('Release Set manifest contributing commits must be an array.');
  }

  const contributingCommits = manifest.contributingCommits.map((entry) => {
    const commit = objectRecord(entry, 'Release Set manifest contributing commit');

    if (!Array.isArray(commit.paths) || !commit.paths.every((path) => typeof path === 'string')) {
      throw new Error('Release Set manifest contributing commit paths must be strings.');
    }

    if (commit.impact !== 'patch' && commit.impact !== 'minor' && commit.impact !== 'major') {
      throw new Error('Release Set manifest contributing commit impact is invalid.');
    }

    const impact: 'patch' | 'minor' | 'major' = commit.impact;

    return {
      sha: exactSha(commit.sha, 'Contributing commit SHA'),
      title: exactString(commit.title, 'Contributing commit title'),
      paths: [...commit.paths],
      impact,
    };
  });

  if (
    !Array.isArray(manifest.packages) ||
    manifest.packages.length !== RELEASE_SET_PACKAGES.length
  ) {
    throw new Error(`Release Set manifest must contain ${RELEASE_SET_PACKAGES.length} packages.`);
  }

  return {
    schemaVersion: 1,
    sourceSha,
    version,
    previousStableTag: {
      name: previousStableTagName,
      version: previousStableTagVersion,
      sha: exactSha(previousStableTag.sha, 'Previous stable tag SHA'),
    },
    contributingCommits,
    stagedTag: STAGED_TAG,
    toolchain: parseToolchain(manifest.toolchain),
    createdAt,
    packages: manifest.packages.map((entry, index) =>
      parseManifestPackage(entry, index, version, sourceSha),
    ),
  };
}

export function createReleaseSetManifest(input: CreateReleaseSetManifestInput): ReleaseSetManifest {
  const packedPackagesByName = new Map(
    input.packedPackages.map((packedPackage) => [packedPackage.name, packedPackage]),
  );

  return parseReleaseSetManifest({
    schemaVersion: 1,
    sourceSha: input.plan.sourceSha,
    version: input.plan.version,
    previousStableTag: input.plan.previousStableTag,
    contributingCommits: input.plan.contributingCommits,
    stagedTag: STAGED_TAG,
    toolchain: input.toolchain,
    createdAt: input.createdAt ?? new Date().toISOString(),
    packages: RELEASE_SET_PACKAGES.map((releasePackage, index) => {
      const packedPackage = packedPackagesByName.get(releasePackage.name);

      if (
        !packedPackage ||
        packedPackage.root !== releasePackage.root ||
        packedPackage.version !== input.plan.version
      ) {
        throw new Error(`Missing packed artifact metadata for ${releasePackage.name}.`);
      }

      return {
        name: releasePackage.name,
        root: releasePackage.root,
        version: input.plan.version,
        dependencyOrder: index + 1,
        artifact: {
          filename: packedPackage.artifactFilename,
          size: packedPackage.size,
          integrity: packedPackage.integrity,
          shasum: packedPackage.shasum,
        },
        internalDependencies: packedPackage.internalDependencies,
        provenance: {
          repository: PROVENANCE_REPOSITORY,
          sourceSha: input.plan.sourceSha,
        },
      };
    }),
  });
}
