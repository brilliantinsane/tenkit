import { RELEASE_SET_PACKAGES, type ReleaseSetPackageName } from './release-set';
import { readExactInternalReleaseSetDependencies } from './release-set-dependencies';
import type { RunReleaseCommand } from './run-release-command';

export const PUBLIC_NPM_REGISTRY = 'https://registry.npmjs.org/';

export type PublicCandidatePackageMetadata = {
  packageName: ReleaseSetPackageName;
  latestVersion?: string;
  publishedAt?: Date;
};

type ReadPublicCandidateReleaseSetInput = {
  version: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  runNpmCommand: RunReleaseCommand;
  errorDetail?: 'stderr' | 'none';
  inheritProcessEnv?: boolean;
};

export class PublicCandidatePackageError extends Error {
  readonly packageName: ReleaseSetPackageName;
  readonly kind: 'metadata' | 'dependency';

  constructor(
    packageName: ReleaseSetPackageName,
    version: string,
    kind: 'metadata' | 'dependency',
    cause: unknown,
  ) {
    super(
      `Unable to verify ${packageName}@${version}. ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    );
    this.name = 'PublicCandidatePackageError';
    this.packageName = packageName;
    this.kind = kind;
  }
}

class PublicCandidateDependencyError extends Error {}

function metadataRecord(value: unknown, description: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${description} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function parseJson(output: string, description: string): unknown {
  try {
    return JSON.parse(output) as unknown;
  } catch (error) {
    throw new Error(`npm returned invalid JSON for ${description}.`, { cause: error });
  }
}

function assertExactInternalDependencies(
  metadata: Record<string, unknown>,
  packageName: ReleaseSetPackageName,
  version: string,
): void {
  try {
    readExactInternalReleaseSetDependencies(metadata, packageName, version);
  } catch (error) {
    throw new PublicCandidateDependencyError(
      error instanceof Error ? error.message : String(error),
      { cause: error },
    );
  }
}

function parsePackageMetadata(
  value: unknown,
  packageName: ReleaseSetPackageName,
  version: string,
): PublicCandidatePackageMetadata {
  const metadata = metadataRecord(value, `${packageName} public Candidate metadata`);

  if (metadata.name !== packageName || metadata.version !== version) {
    throw new Error(`public package identity mismatch for ${packageName}@${version}.`);
  }

  const distTags = metadataRecord(metadata['dist-tags'], `${packageName} dist-tags`);

  if (distTags.candidate !== version) {
    throw new Error(
      `${packageName} candidate tag expected ${version}, found ${String(distTags.candidate)}.`,
    );
  }

  assertExactInternalDependencies(metadata, packageName, version);

  const time =
    metadata.time === undefined
      ? {}
      : metadataRecord(metadata.time, `${packageName} publication times`);
  const publishedAtValue = time[version];
  const publishedAt =
    typeof publishedAtValue === 'string' ? new Date(publishedAtValue) : new Date(Number.NaN);
  const latestVersion = distTags.latest;

  return {
    packageName,
    ...(typeof latestVersion === 'string' ? { latestVersion } : {}),
    ...(!Number.isNaN(publishedAt.getTime()) ? { publishedAt } : {}),
  };
}

export async function readPublicCandidateReleaseSet(
  input: ReadPublicCandidateReleaseSetInput,
): Promise<PublicCandidatePackageMetadata[]> {
  const metadata: PublicCandidatePackageMetadata[] = [];

  for (const releasePackage of RELEASE_SET_PACKAGES) {
    try {
      const commandResult = await input.runNpmCommand({
        command: 'npm',
        args: [
          'view',
          `${releasePackage.name}@${input.version}`,
          'name',
          'version',
          'dependencies',
          'optionalDependencies',
          'peerDependencies',
          'dist-tags',
          'time',
          '--json',
        ],
        cwd: input.cwd,
        env: input.env,
        errorDetail: input.errorDetail,
        inheritProcessEnv: input.inheritProcessEnv,
      });
      metadata.push(
        parsePackageMetadata(
          parseJson(commandResult.stdout, `${releasePackage.name} Candidate metadata`),
          releasePackage.name,
          input.version,
        ),
      );
    } catch (error) {
      throw new PublicCandidatePackageError(
        releasePackage.name,
        input.version,
        error instanceof PublicCandidateDependencyError ? 'dependency' : 'metadata',
        error,
      );
    }
  }

  return metadata;
}
