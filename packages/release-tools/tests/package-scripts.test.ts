import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

import { describe, expect, test } from 'vitest';

const workspaceRoot = resolve(import.meta.dirname, '../../..');
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

async function runPnpm(
  args: readonly string[],
): Promise<{ exitCode: number | null; output: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('pnpm', args, {
      cwd: workspaceRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      output += chunk;
    });
    child.once('error', reject);
    child.once('close', (exitCode) => {
      resolvePromise({ exitCode, output });
    });
  });
}

describe('release-tools package commands', () => {
  test('does not expose Candidate Smoke or Promotion scripts', async () => {
    const scripts = await readPackageScripts();

    expect(scripts).not.toHaveProperty('smoke');
    expect(scripts).not.toHaveProperty('promote');
  });

  test.each([
    [['release:smoke'], /Command "release:smoke" not found/],
    [['release:promote'], /Command "release:promote" not found/],
    [['-F', '@tenkit/release-tools', 'smoke'], /has a "smoke" script/],
    [['-F', '@tenkit/release-tools', 'promote'], /has a "promote" script/],
  ] as const)('fails removed script lookup for pnpm %s', async (args, expectedMessage) => {
    const commandResult = await runPnpm(args);

    expect(commandResult.exitCode).toBe(1);
    expect(commandResult.output).toMatch(expectedMessage);
  });

  test('build workspace package exports before direct tests and typechecking', async () => {
    const scripts = await readPackageScripts();

    expect(scripts.test).toBe('pnpm -F @tenkit/template-generator build && vitest run');
    expect(scripts.typecheck).toBe(
      'pnpm -F @tenkit/template-generator build && tsc --noEmit --pretty false',
    );
  });
});
