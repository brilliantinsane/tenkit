import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parseExactStableVersion } from './exact-stable-version';

export async function readPinnedNpmVersion(workspaceRoot: string): Promise<string> {
  let contents: string;

  try {
    contents = await readFile(join(workspaceRoot, '.npm-version'), 'utf8');
  } catch (error) {
    throw new Error('Unable to read the Release Set npm CLI pin from .npm-version.', {
      cause: error,
    });
  }

  const version = contents.trim().replace(/^v/, '');

  if (!parseExactStableVersion(version)) {
    throw new Error('.npm-version must contain one exact major.minor.patch version.');
  }

  return version;
}
