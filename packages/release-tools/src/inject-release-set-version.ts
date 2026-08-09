import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parseExactReleaseSetVersion } from './exact-release-set-version';
import { RELEASE_SET_PACKAGES } from './release-set.ts';
import { readCanonicalInternalReleaseSetDependencies } from './release-set-dependencies';
import type { ReleaseSetPlan } from './release-plan';

type InjectReleaseSetVersionInput = {
  isolatedWorkspaceRoot: string;
  plan: Extract<ReleaseSetPlan, { kind: 'release' }>;
};

function validatePlan(plan: Extract<ReleaseSetPlan, { kind: 'release' }>): void {
  const parsedVersion = parseExactReleaseSetVersion(plan.version);

  if (!parsedVersion || parsedVersion.channel !== plan.channel) {
    throw new Error(
      `Release Set version ${JSON.stringify(plan.version)} must be one exact Stable or RC version matching its channel.`,
    );
  }

  const expectedNpmDistTag = plan.channel === 'stable' ? 'latest' : 'next';
  const expectedGithubReleaseType = plan.channel === 'stable' ? 'release' : 'prerelease';
  const expectedDependencyApprovalOrder = RELEASE_SET_PACKAGES.map(
    (releasePackage) => releasePackage.name,
  );

  if (
    plan.npmDistTag !== expectedNpmDistTag ||
    plan.gitTag !== `v${plan.version}` ||
    plan.githubReleaseType !== expectedGithubReleaseType ||
    JSON.stringify(plan.dependencyApprovalOrder) !== JSON.stringify(expectedDependencyApprovalOrder)
  ) {
    throw new Error('Release Set plan metadata does not match its channel and version.');
  }
}

function parsePackageMetadata(contents: string, expectedName: string): Record<string, unknown> {
  const metadata: unknown = JSON.parse(contents);

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error(`Package metadata for ${expectedName} must be a JSON object.`);
  }

  const packageMetadata = metadata as Record<string, unknown>;

  if (packageMetadata.name !== expectedName) {
    throw new Error(`Expected package metadata for ${expectedName}.`);
  }

  return packageMetadata;
}

function withExactInternalDependencies(
  packageMetadata: Record<string, unknown>,
  releasePackage: (typeof RELEASE_SET_PACKAGES)[number],
  version: string,
): Record<string, unknown> {
  const internalDependencies = readCanonicalInternalReleaseSetDependencies(
    packageMetadata,
    releasePackage.name,
  );
  if (internalDependencies.length === 0) {
    return packageMetadata;
  }

  const dependencies = packageMetadata.dependencies as Record<string, unknown>;

  return {
    ...packageMetadata,
    dependencies: {
      ...dependencies,
      ...Object.fromEntries(
        internalDependencies.map((internalDependency) => [internalDependency.name, version]),
      ),
    },
  };
}

export async function injectReleaseSetVersion(input: InjectReleaseSetVersionInput): Promise<void> {
  validatePlan(input.plan);

  const manifests = await Promise.all(
    RELEASE_SET_PACKAGES.map(async (releasePackage) => {
      const path = join(input.isolatedWorkspaceRoot, releasePackage.root, 'package.json');
      const packageMetadata = parsePackageMetadata(
        await readFile(path, 'utf8'),
        releasePackage.name,
      );
      const releaseMetadata = withExactInternalDependencies(
        packageMetadata,
        releasePackage,
        input.plan.version,
      );

      return {
        path,
        contents: `${JSON.stringify({ ...releaseMetadata, version: input.plan.version }, null, 2)}\n`,
      };
    }),
  );

  await Promise.all(manifests.map((manifest) => writeFile(manifest.path, manifest.contents)));
}
