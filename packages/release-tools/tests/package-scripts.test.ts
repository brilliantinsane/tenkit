import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

const packageJsonPath = resolve(import.meta.dirname, '../package.json');

async function readPackageScripts(): Promise<Record<string, unknown>> {
  const packageMetadata: unknown = JSON.parse(await readFile(packageJsonPath, 'utf8'));

  if (
    !packageMetadata ||
    typeof packageMetadata !== 'object' ||
    Array.isArray(packageMetadata) ||
    !('scripts' in packageMetadata) ||
    !packageMetadata.scripts ||
    typeof packageMetadata.scripts !== 'object' ||
    Array.isArray(packageMetadata.scripts)
  ) {
    throw new Error('release-tools package scripts must be an object.');
  }

  return packageMetadata.scripts as Record<string, unknown>;
}

describe('release-tools package commands', () => {
  test('build workspace package exports before direct tests and typechecking', async () => {
    const scripts = await readPackageScripts();

    expect(scripts.test).toBe('pnpm -F @tenkit/template-generator build && vitest run');
    expect(scripts.typecheck).toBe(
      'pnpm -F @tenkit/template-generator build && tsc --noEmit --pretty false',
    );
  });
});
