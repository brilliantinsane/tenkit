import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type ReleaseToolchain = {
  node: string;
  npm: string;
  pnpm: string;
};

function exactVersion(contents: string, source: string): string {
  const version = contents.trim().replace(/^v/, '');

  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`${source} must specify one exact major.minor.patch version.`);
  }

  return version;
}

async function readRequiredFile(path: string, description: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    throw new Error(`Unable to read ${description}.`, { cause: error });
  }
}

export async function readPinnedReleaseToolchain(workspaceRoot: string): Promise<ReleaseToolchain> {
  const [nodePin, npmPin, rootPackageContents] = await Promise.all([
    readRequiredFile(join(workspaceRoot, '.nvmrc'), 'the Node pin from .nvmrc'),
    readRequiredFile(join(workspaceRoot, '.npm-version'), 'the npm pin from .npm-version'),
    readRequiredFile(join(workspaceRoot, 'package.json'), 'the root package metadata'),
  ]);
  let rootPackageMetadata: unknown;

  try {
    rootPackageMetadata = JSON.parse(rootPackageContents);
  } catch (error) {
    throw new Error('Root package metadata must contain valid JSON.', { cause: error });
  }

  if (
    !rootPackageMetadata ||
    typeof rootPackageMetadata !== 'object' ||
    Array.isArray(rootPackageMetadata)
  ) {
    throw new Error('Root package metadata must be a JSON object.');
  }

  const packageManager = (rootPackageMetadata as Record<string, unknown>).packageManager;
  const pnpmMatch =
    typeof packageManager === 'string' ? /^pnpm@(\d+\.\d+\.\d+)$/.exec(packageManager) : null;

  if (!pnpmMatch?.[1]) {
    throw new Error(
      'package.json#packageManager must pin one exact pnpm major.minor.patch version.',
    );
  }

  return {
    node: exactVersion(nodePin, '.nvmrc'),
    npm: exactVersion(npmPin, '.npm-version'),
    pnpm: pnpmMatch[1],
  };
}
