import {
  getReleaseSetPackage,
  RELEASE_SET_PACKAGES,
  type ReleaseSetPackageName,
} from './release-set';

export type InternalReleaseSetDependency = {
  name: ReleaseSetPackageName;
  version: string;
};

function dependencyRecord(value: unknown, description: string): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${description} must be an object.`);
  }

  for (const [name, dependencyVersion] of Object.entries(value)) {
    if (typeof dependencyVersion !== 'string') {
      throw new Error(`${description} entry ${name} must be a string.`);
    }
  }

  return value as Record<string, string>;
}

export function readExactInternalReleaseSetDependencies(
  metadata: Record<string, unknown>,
  packageName: ReleaseSetPackageName,
  expectedVersion: string,
): InternalReleaseSetDependency[] {
  const releasePackage = getReleaseSetPackage(packageName);
  const actualDependencies: Array<{
    section: 'dependencies' | 'optionalDependencies' | 'peerDependencies';
    name: ReleaseSetPackageName;
    version: string;
  }> = [];

  for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies'] as const) {
    if (metadata[section] === undefined) {
      continue;
    }

    for (const [name, dependencyVersion] of Object.entries(
      dependencyRecord(metadata[section], `${packageName} ${section}`),
    )) {
      const releaseDependency = RELEASE_SET_PACKAGES.find((candidate) => candidate.name === name);

      if (releaseDependency) {
        actualDependencies.push({
          section,
          name: releaseDependency.name,
          version: dependencyVersion,
        });
      }
    }
  }

  const expectedDependencies =
    'internalDependency' in releasePackage
      ? [{ name: releasePackage.internalDependency, version: expectedVersion }]
      : [];

  if (actualDependencies.length !== expectedDependencies.length) {
    throw new Error(
      `${packageName} expected ${expectedDependencies.length} internal Release Set dependencies, found ${actualDependencies.length}.`,
    );
  }

  for (const expectedDependency of expectedDependencies) {
    const actualDependency = actualDependencies[0];

    if (
      actualDependency?.section !== 'dependencies' ||
      actualDependency.name !== expectedDependency.name
    ) {
      throw new Error(
        `${packageName} must declare one direct dependency ${expectedDependency.name}.`,
      );
    }

    if (actualDependency.version !== expectedVersion) {
      throw new Error(
        `${packageName} dependency ${expectedDependency.name} expected ${expectedVersion}, found ${actualDependency.version}.`,
      );
    }
  }

  return expectedDependencies;
}
