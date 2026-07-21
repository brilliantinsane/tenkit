import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { promisify } from 'node:util';

import {
  getReleaseSetPackage,
  RELEASE_SET_PACKAGES,
  type ReleaseSetPackageName,
} from './release-set.ts';

const execFileAsync = promisify(execFile);

type InternalReleaseDependency = {
  name: ReleaseSetPackageName;
  version: string;
};

export type ReleaseArtifact = {
  name: ReleaseSetPackageName;
  version: string;
  artifactFilename: string;
  integrity: string;
  shasum: string;
  internalDependencies: InternalReleaseDependency[];
};

type InspectReleaseArtifactInput = {
  artifactPath: string;
  expectedName: ReleaseSetPackageName;
  expectedVersion: string;
};

function metadataRecord(value: unknown, description: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${description} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function dependencyRecord(value: unknown, description: string): Record<string, string> {
  const dependencies = metadataRecord(value, description);

  for (const [name, dependencyVersion] of Object.entries(dependencies)) {
    if (typeof dependencyVersion !== 'string') {
      throw new Error(`${description} entry ${name} must be a string.`);
    }
  }

  return dependencies as Record<string, string>;
}

function readInternalDependencies(
  metadata: Record<string, unknown>,
  packageName: ReleaseSetPackageName,
  expectedVersion: string,
): InternalReleaseDependency[] {
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
      if (RELEASE_SET_PACKAGES.some((candidate) => candidate.name === name)) {
        actualDependencies.push({
          section,
          name: name as ReleaseSetPackageName,
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

export async function inspectReleaseArtifact(
  input: InspectReleaseArtifactInput,
): Promise<ReleaseArtifact> {
  const releasePackage = getReleaseSetPackage(input.expectedName);
  const expectedFilename = `${releasePackage.artifactPrefix}-${input.expectedVersion}.tgz`;
  const artifactFilename = basename(input.artifactPath);

  if (artifactFilename !== expectedFilename) {
    throw new Error(`${input.expectedName} artifact expected ${expectedFilename}.`);
  }

  let packageJsonContents: string;

  try {
    const result = await execFileAsync(
      'tar',
      ['-xOzf', input.artifactPath, 'package/package.json'],
      { encoding: 'utf8', maxBuffer: 1024 * 1024 },
    );
    packageJsonContents = result.stdout;
  } catch (error) {
    throw new Error(`Unable to read package identity from ${artifactFilename}.`, { cause: error });
  }

  let metadataValue: unknown;

  try {
    metadataValue = JSON.parse(packageJsonContents);
  } catch (error) {
    throw new Error(`${artifactFilename} contains invalid package metadata.`, { cause: error });
  }

  const metadata = metadataRecord(metadataValue, `${artifactFilename} package metadata`);

  if (metadata.name !== input.expectedName) {
    throw new Error(
      `${artifactFilename} expected ${input.expectedName}, found ${String(metadata.name)}.`,
    );
  }

  if (metadata.version !== input.expectedVersion) {
    throw new Error(
      `${input.expectedName} expected version ${input.expectedVersion}, found ${String(metadata.version)}.`,
    );
  }

  const bytes = await readFile(input.artifactPath);

  return {
    name: input.expectedName,
    version: input.expectedVersion,
    artifactFilename,
    integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
    shasum: createHash('sha1').update(bytes).digest('hex'),
    internalDependencies: readInternalDependencies(
      metadata,
      input.expectedName,
      input.expectedVersion,
    ),
  };
}
