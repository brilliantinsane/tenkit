/// <reference types="node" />

import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

import fs from 'fs-extra';
import { join, resolve } from 'pathe';
import { afterEach, assert, test } from 'vitest';

const execFileAsync = promisify(execFile);
const packageRoot = resolve(import.meta.dirname, '..');
const proofScript = join(packageRoot, 'scripts/generate-proof.ts');
const verifyScript = join(packageRoot, 'scripts/verify-generated-app.ts');
const tempRoots: string[] = [];

async function runScript(script: string, args: readonly string[]) {
  return execFileAsync(process.execPath, ['--import', 'tsx', script, ...args], {
    cwd: packageRoot,
  });
}

async function expectScriptFailure(script: string, args: readonly string[], expectedError: RegExp) {
  let thrown: unknown;

  try {
    await runScript(script, args);
  } catch (error) {
    thrown = error;
  }

  assert.ok(thrown instanceof Error);
  assert.ok('stderr' in thrown && typeof thrown.stderr === 'string');
  assert.match(thrown.stderr, expectedError);
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((tempRoot) => fs.remove(tempRoot)));
});

test('proof accepts --styling and generates the selected Styling output', async () => {
  const tempRoot = await fs.mkdtemp(join(tmpdir(), 'tenkit-proof-args-'));
  const targetDir = join(tempRoot, 'app');
  tempRoots.push(tempRoot);

  await runScript(proofScript, [
    '--setup-type',
    'white-label',
    '--styling',
    'uniwind',
    '--target',
    targetDir,
    '--no-install',
  ]);

  assert.equal(await fs.pathExists(join(targetDir, 'src/global.css')), true);
  const packageJson = await fs.readFile(join(targetDir, 'package.json'), 'utf8');
  assert.match(packageJson, /"uniwind": "\^1\.10\.0"/);
});

test('verify accepts --styling before validating the Setup Type', async () => {
  await expectScriptFailure(
    verifyScript,
    ['--styling', 'uniwind', '--setup-type', 'unsupported'],
    /Unsupported generated Setup Type "unsupported"/,
  );
});

test('maintainer commands reject the superseded --styling-choice flag', async () => {
  for (const script of [proofScript, verifyScript]) {
    await expectScriptFailure(
      script,
      ['--styling-choice', 'uniwind'],
      /Unknown argument --styling-choice/,
    );
  }
});
