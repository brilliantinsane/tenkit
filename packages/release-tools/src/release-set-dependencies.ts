import {
  getReleaseSetPackage,
  RELEASE_SET_PACKAGES,
  type ReleaseSetPackageName,
} from './release-set';

export type InternalReleaseSetDependency = {
  name: ReleaseSetPackageName;
  version: string;
};

type InternalReleaseSetDependencyDeclaration = InternalReleaseSetDependency & {
  section: 'dependencies' | 'optionalDependencies' | 'peerDependencies';
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
  const internalDependencies = readCanonicalInternalReleaseSetDependencies(metadata, packageName);

  for (const internalDependency of internalDependencies) {
    if (internalDependency.version !== expectedVersion) {
      throw new Error(
        `${packageName} dependency ${internalDependency.name} expected ${expectedVersion}, found ${internalDependency.version}.`,
      );
    }
  }

  return internalDependencies;
}

export function readCanonicalInternalReleaseSetDependencies(
  metadata: Record<string, unknown>,
  packageName: ReleaseSetPackageName,
): InternalReleaseSetDependency[] {
  const releasePackage = getReleaseSetPackage(packageName);
  const actualDependencies: InternalReleaseSetDependencyDeclaration[] = [];

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

  const expectedDependencyNames = releasePackage.internalDependencies;

  if (actualDependencies.length !== expectedDependencyNames.length) {
    throw new Error(
      `${packageName} expected ${expectedDependencyNames.length} internal Release Set dependencies, found ${actualDependencies.length}.`,
    );
  }

  for (const expectedDependencyName of expectedDependencyNames) {
    const actualDependency = actualDependencies.find(
      (dependency) => dependency.name === expectedDependencyName,
    );

    if (
      actualDependency?.section !== 'dependencies' ||
      actualDependency.name !== expectedDependencyName
    ) {
      throw new Error(`${packageName} must declare a direct dependency ${expectedDependencyName}.`);
    }
  }

  return expectedDependencyNames.map((dependencyName) => {
    const dependency = actualDependencies.find(({ name }) => name === dependencyName)!;

    return { name: dependency.name, version: dependency.version };
  });
}
