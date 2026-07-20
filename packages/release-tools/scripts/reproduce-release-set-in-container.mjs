import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { RELEASE_SET_PACKAGES } from '../src/release-set.mjs';

const workspaceRoot = '/workspace';
const artifactRoot = '/artifacts';
const toolchainRoot = '/tmp/tenkit-release-toolchain';

function exactVersion(value, description) {
  const version = value?.trim().replace(/^v/, '');

  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`${description} must be one exact major.minor.patch version.`);
  }

  return version;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      CI: 'true',
      INIT_CWD: workspaceRoot,
      LC_ALL: 'C',
      SOURCE_DATE_EPOCH: '0',
      TZ: 'UTC',
    },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    const diagnostic = `${result.stdout}\n${result.stderr}`.trim();
    throw new Error(`${command} failed${diagnostic ? `: ${diagnostic}` : '.'}`);
  }

  return result.stdout.trim().replace(/^v/, '');
}

function assertVersion(tool, expected, actual) {
  if (actual !== expected) {
    throw new Error(`Release Set container requires ${tool} ${expected}, found ${actual}.`);
  }
}

const rootPackage = JSON.parse(readFileSync(join(workspaceRoot, 'package.json'), 'utf8'));
const pnpmMatch = /^pnpm@(\d+\.\d+\.\d+)$/.exec(rootPackage.packageManager ?? '');
const sourceToolchain = {
  node: exactVersion(readFileSync(join(workspaceRoot, '.nvmrc'), 'utf8'), '.nvmrc'),
  npm: exactVersion(readFileSync(join(workspaceRoot, '.npm-version'), 'utf8'), '.npm-version'),
  pnpm: exactVersion(pnpmMatch?.[1], 'package.json#packageManager'),
};
const expectedToolchain = {
  node: exactVersion(process.env.TENKIT_NODE_VERSION, 'TENKIT_NODE_VERSION'),
  npm: exactVersion(process.env.TENKIT_NPM_VERSION, 'TENKIT_NPM_VERSION'),
  pnpm: exactVersion(process.env.TENKIT_PNPM_VERSION, 'TENKIT_PNPM_VERSION'),
};

if (JSON.stringify(sourceToolchain) !== JSON.stringify(expectedToolchain)) {
  throw new Error('Release Set source toolchain pins changed after container selection.');
}

assertVersion('Node', expectedToolchain.node, process.version.replace(/^v/, ''));
run('npm', [
  'install',
  '--prefix',
  toolchainRoot,
  '--no-package-lock',
  '--ignore-scripts',
  '--no-audit',
  '--no-fund',
  `npm@${expectedToolchain.npm}`,
]);
assertVersion(
  'npm',
  expectedToolchain.npm,
  run('node', [join(toolchainRoot, 'node_modules/npm/bin/npm-cli.js'), '--version']),
);
assertVersion('pnpm', expectedToolchain.pnpm, run('corepack', ['pnpm', '--version']));
run('corepack', ['pnpm', 'install', '--frozen-lockfile', '--ignore-scripts']);

const version = exactVersion(process.env.TENKIT_RELEASE_VERSION, 'TENKIT_RELEASE_VERSION');

for (const releasePackage of RELEASE_SET_PACKAGES) {
  const packageJsonPath = join(workspaceRoot, releasePackage.root, 'package.json');
  const packageMetadata = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

  if (packageMetadata.name !== releasePackage.name) {
    throw new Error(`Expected package metadata for ${releasePackage.name}.`);
  }

  writeFileSync(packageJsonPath, `${JSON.stringify({ ...packageMetadata, version }, null, 2)}\n`);
}

for (const releasePackage of RELEASE_SET_PACKAGES) {
  run('corepack', [
    'pnpm',
    '--filter',
    releasePackage.name,
    'pack',
    '--pack-destination',
    artifactRoot,
  ]);
}
