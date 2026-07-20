import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { RELEASE_SET_PACKAGES } from './release-set.ts';
import type { ReleaseSetPlan } from './release-plan';

type InjectReleaseSetVersionInput = {
  isolatedWorkspaceRoot: string;
  plan: Extract<ReleaseSetPlan, { kind: 'release' }>;
};

function validateVersion(version: string): void {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(
      `Release Set version ${JSON.stringify(version)} must use major.minor.patch format.`,
    );
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

export async function injectReleaseSetVersion(input: InjectReleaseSetVersionInput): Promise<void> {
  validateVersion(input.plan.version);

  const manifests = await Promise.all(
    RELEASE_SET_PACKAGES.map(async (releasePackage) => {
      const path = join(input.isolatedWorkspaceRoot, releasePackage.root, 'package.json');
      const packageMetadata = parsePackageMetadata(
        await readFile(path, 'utf8'),
        releasePackage.name,
      );

      return {
        path,
        contents: `${JSON.stringify({ ...packageMetadata, version: input.plan.version }, null, 2)}\n`,
      };
    }),
  );

  await Promise.all(manifests.map((manifest) => writeFile(manifest.path, manifest.contents)));
}
