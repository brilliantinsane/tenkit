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

test('proof accepts Unistyles through the existing --styling option', async () => {
  const tempRoot = await fs.mkdtemp(join(tmpdir(), 'tenkit-proof-args-'));
  const targetDir = join(tempRoot, 'app');
  tempRoots.push(tempRoot);

  await runScript(proofScript, [
    '--setup-type',
    'white-label',
    '--styling',
    'unistyles',
    '--target',
    targetDir,
    '--no-install',
  ]);

  assert.equal(await fs.pathExists(join(targetDir, 'unistyles.ts')), true);
  const packageJson = await fs.readFile(join(targetDir, 'package.json'), 'utf8');
  assert.match(packageJson, /"react-native-unistyles": "3\.3\.0"/);
});

test('proof accepts ordered per-App-Variant names and Accents', async () => {
  const tempRoot = await fs.mkdtemp(join(tmpdir(), 'tenkit-proof-args-'));
  const targetDir = join(tempRoot, 'app');
  tempRoots.push(tempRoot);

  await runScript(proofScript, [
    '--setup-type',
    'white-label',
    '--variant-names',
    'North App,South App',
    '--variant-accents',
    '#112233,#445566',
    '--target',
    targetDir,
    '--no-install',
  ]);

  const appVariants = await fs.readFile(join(targetDir, 'src/constants/app-variants.ts'), 'utf8');
  assert.match(appVariants, /slug: 'north-app'/);
  assert.match(appVariants, /slug: 'south-app'/);
  assert.match(appVariants, /accent: "#112233"/);
  assert.match(appVariants, /accent: "#445566"/);
});

test('proof accepts the Express Backend with all other options at none', async () => {
  const tempRoot = await fs.mkdtemp(join(tmpdir(), 'tenkit-proof-args-'));
  const targetDir = join(tempRoot, 'app');
  tempRoots.push(tempRoot);

  await runScript(proofScript, [
    '--setup-type',
    'white-label',
    '--backend',
    'express',
    '--auth',
    'none',
    '--database',
    'none',
    '--orm',
    'none',
    '--target',
    targetDir,
    '--no-install',
  ]);

  assert.equal(await fs.pathExists(join(targetDir, 'apps/server/package.json')), true);
  assert.equal(await fs.pathExists(join(targetDir, 'packages/auth')), false);
  assert.equal(await fs.pathExists(join(targetDir, 'packages/db')), false);
});

test('proof accepts NestJS and reports the combined Expo and Backend command', async () => {
  const tempRoot = await fs.mkdtemp(join(tmpdir(), 'tenkit-proof-args-'));
  const targetDir = join(tempRoot, 'app');
  tempRoots.push(tempRoot);

  const { stdout } = await runScript(proofScript, [
    '--setup-type',
    'white-label',
    '--backend',
    'nestjs',
    '--auth',
    'none',
    '--database',
    'none',
    '--orm',
    'none',
    '--target',
    targetDir,
    '--no-install',
  ]);

  assert.equal(await fs.pathExists(join(targetDir, 'apps/server/nest-cli.json')), true);
  assert.match(stdout, /pnpm run dev/);
});

test('proof accepts NestJS with PostgreSQL and Prisma without Auth', async () => {
  const tempRoot = await fs.mkdtemp(join(tmpdir(), 'tenkit-proof-args-'));
  const targetDir = join(tempRoot, 'app');
  tempRoots.push(tempRoot);

  await runScript(proofScript, [
    '--setup-type',
    'white-label',
    '--backend',
    'nestjs',
    '--auth',
    'none',
    '--database',
    'postgresql',
    '--orm',
    'prisma',
    '--target',
    targetDir,
    '--no-install',
  ]);

  assert.equal(await fs.pathExists(join(targetDir, 'apps/server/nest-cli.json')), true);
  assert.equal(await fs.pathExists(join(targetDir, 'packages/db/prisma/schema.prisma')), true);
  assert.equal(await fs.pathExists(join(targetDir, 'packages/auth')), false);
});

test('verify accepts --styling before validating the Setup Type', async () => {
  await expectScriptFailure(
    verifyScript,
    ['--styling', 'unistyles', '--setup-type', 'unsupported'],
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

test('maintainer commands reject the superseded global --accent flag', async () => {
  for (const script of [proofScript, verifyScript]) {
    await expectScriptFailure(script, ['--accent', '#123ABC'], /Unknown argument --accent/);
  }
});

test('maintainer commands reject unsupported Generated App Option combinations', async () => {
  await expectScriptFailure(
    proofScript,
    [
      '--setup-type',
      'white-label',
      '--target',
      'unused',
      '--backend',
      'express',
      '--auth',
      'better-auth',
    ],
    /Unsupported Generated App Option combination/,
  );
  await expectScriptFailure(
    verifyScript,
    ['--setup-type', 'white-label', '--backend', 'express', '--auth', 'better-auth'],
    /Unsupported Generated App Option combination/,
  );
});
