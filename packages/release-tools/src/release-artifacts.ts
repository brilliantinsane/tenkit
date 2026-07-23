import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { promisify } from 'node:util';

import { getReleaseSetPackage, type ReleaseSetPackageName } from './release-set.ts';
import {
  readExactInternalReleaseSetDependencies,
  type InternalReleaseSetDependency,
} from './release-set-dependencies.ts';

const execFileAsync = promisify(execFile);

export type ReleaseArtifact = {
  name: ReleaseSetPackageName;
  version: string;
  artifactFilename: string;
  integrity: string;
  shasum: string;
  internalDependencies: InternalReleaseSetDependency[];
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
    internalDependencies: readExactInternalReleaseSetDependencies(
      metadata,
      input.expectedName,
      input.expectedVersion,
    ),
  };
}
