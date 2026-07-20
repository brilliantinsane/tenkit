import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { runReleaseCommand, type RunReleaseCommand } from './run-release-command';

const RELEASE_CONTAINER_IMAGE = 'tenkit-release-reproduction:local';
const RELEASE_CONTAINER_PLATFORM = 'linux/amd64';

type RunReleaseContainerInput = {
  sourceRoot: string;
  artifactRoot: string;
  version: string;
  runCommand?: RunReleaseCommand;
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

async function readPinnedToolchain(sourceRoot: string) {
  const [nodePin, npmPin, rootPackageContents] = await Promise.all([
    readRequiredFile(join(sourceRoot, '.nvmrc'), 'the Node pin from .nvmrc'),
    readRequiredFile(join(sourceRoot, '.npm-version'), 'the npm pin from .npm-version'),
    readRequiredFile(join(sourceRoot, 'package.json'), 'the root package metadata'),
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

function bindMount(source: string, target: string): string {
  if (source.includes(',')) {
    throw new Error(
      `Release container bind source ${JSON.stringify(source)} cannot contain a comma.`,
    );
  }

  return `type=bind,source=${source},target=${target}`;
}

export async function runReleaseContainer(input: RunReleaseContainerInput): Promise<void> {
  const runCommand = input.runCommand ?? runReleaseCommand;
  const toolchain = await readPinnedToolchain(input.sourceRoot);
  const userId = typeof process.getuid === 'function' ? process.getuid() : 1000;
  const groupId = typeof process.getgid === 'function' ? process.getgid() : 1000;

  const imageBuild = await runCommand({
    command: 'docker',
    args: [
      'build',
      '--quiet',
      '--platform',
      RELEASE_CONTAINER_PLATFORM,
      '--build-arg',
      `NODE_VERSION=${toolchain.node}`,
      '--build-arg',
      `NPM_VERSION=${toolchain.npm}`,
      '--build-arg',
      `PNPM_VERSION=${toolchain.pnpm}`,
      '--tag',
      RELEASE_CONTAINER_IMAGE,
      '--file',
      'packages/release-tools/container/Dockerfile',
      'packages/release-tools',
    ],
    cwd: input.sourceRoot,
  });
  const canonicalImageId = imageBuild.stdout.trim();

  if (!/^sha256:[0-9a-f]{64}$/.test(canonicalImageId)) {
    throw new Error('Canonical Release Set image build did not return one immutable image ID.');
  }

  await runCommand({
    command: 'docker',
    args: [
      'run',
      '--rm',
      '--platform',
      RELEASE_CONTAINER_PLATFORM,
      '--user',
      `${userId}:${groupId}`,
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      '--read-only',
      '--tmpfs',
      '/tmp:exec,mode=1777',
      '--mount',
      bindMount(input.sourceRoot, '/workspace'),
      '--mount',
      bindMount(input.artifactRoot, '/artifacts'),
      '--workdir',
      '/workspace',
      '--env',
      'HOME=/tmp/tenkit-release-home',
      '--env',
      `TENKIT_RELEASE_VERSION=${input.version}`,
      '--env',
      `TENKIT_NODE_VERSION=${toolchain.node}`,
      '--env',
      `TENKIT_NPM_VERSION=${toolchain.npm}`,
      '--env',
      `TENKIT_PNPM_VERSION=${toolchain.pnpm}`,
      canonicalImageId,
      'node',
      '--no-warnings',
      '/usr/local/lib/tenkit-release-tools/container/pack-release-set.ts',
    ],
    cwd: input.sourceRoot,
  });
}

export type RunReleaseContainer = typeof runReleaseContainer;
