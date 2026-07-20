import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { RELEASE_SET_PACKAGES } from '../src/release-set.ts';

const workspaceRoot = '/workspace';
const artifactRoot = '/artifacts';

function exactVersion(value: unknown, description: string): string {
  const version = typeof value === 'string' ? value.trim().replace(/^v/, '') : '';

  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`${description} must be one exact major.minor.patch version.`);
  }

  return version;
}

function run(command: string, args: string[]): string {
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

function assertVersion(tool: string, expected: string, actual: string): void {
  if (actual !== expected) {
    throw new Error(`Release Set container requires ${tool} ${expected}, found ${actual}.`);
  }
}

const rootPackage: unknown = JSON.parse(readFileSync(join(workspaceRoot, 'package.json'), 'utf8'));

if (!rootPackage || typeof rootPackage !== 'object' || Array.isArray(rootPackage)) {
  throw new Error('Release Set root package metadata must be an object.');
}

const packageManager = 'packageManager' in rootPackage ? rootPackage.packageManager : undefined;
const pnpmMatch =
  typeof packageManager === 'string' ? /^pnpm@(\d+\.\d+\.\d+)$/.exec(packageManager) : null;
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
assertVersion('npm', expectedToolchain.npm, run('npm', ['--version']));
assertVersion('pnpm', expectedToolchain.pnpm, run('pnpm', ['--version']));
run('pnpm', [
  'install',
  '--frozen-lockfile',
  '--ignore-scripts',
  ...RELEASE_SET_PACKAGES.flatMap((releasePackage) => ['--filter', `${releasePackage.name}...`]),
]);

const version = exactVersion(process.env.TENKIT_RELEASE_VERSION, 'TENKIT_RELEASE_VERSION');

for (const releasePackage of RELEASE_SET_PACKAGES) {
  const packageJsonPath = join(workspaceRoot, releasePackage.root, 'package.json');
  const packageMetadata: unknown = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

  if (
    !packageMetadata ||
    typeof packageMetadata !== 'object' ||
    Array.isArray(packageMetadata) ||
    !('name' in packageMetadata) ||
    packageMetadata.name !== releasePackage.name
  ) {
    throw new Error(`Expected package metadata for ${releasePackage.name}.`);
  }

  writeFileSync(packageJsonPath, `${JSON.stringify({ ...packageMetadata, version }, null, 2)}\n`);
}

for (const releasePackage of RELEASE_SET_PACKAGES) {
  run('pnpm', ['--filter', releasePackage.name, 'pack', '--pack-destination', artifactRoot]);
}
