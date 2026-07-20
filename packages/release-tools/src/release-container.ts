import type { ReleaseToolchain } from './release-toolchain';
import { runReleaseCommand, type RunReleaseCommand } from './release-command';

export const RELEASE_CONTAINER_IMAGE = 'tenkit-release-reproduction:local';
export const RELEASE_CONTAINER_PLATFORM = 'linux/amd64';

export type RunCanonicalReleaseContainerInput = {
  sourceRoot: string;
  artifactRoot: string;
  version: string;
  image: typeof RELEASE_CONTAINER_IMAGE;
  platform: typeof RELEASE_CONTAINER_PLATFORM;
  toolchain: ReleaseToolchain;
  runCommand?: RunReleaseCommand;
};

export type RunCanonicalReleaseContainer = (
  input: RunCanonicalReleaseContainerInput,
) => Promise<void>;

function bindMount(source: string, target: string): string {
  if (source.includes(',')) {
    throw new Error(
      `Release container bind source ${JSON.stringify(source)} cannot contain a comma.`,
    );
  }

  return `type=bind,source=${source},target=${target}`;
}

export async function runCanonicalReleaseContainer(
  input: RunCanonicalReleaseContainerInput,
): Promise<void> {
  const runCommand = input.runCommand ?? runReleaseCommand;
  const userId = typeof process.getuid === 'function' ? process.getuid() : 1000;
  const groupId = typeof process.getgid === 'function' ? process.getgid() : 1000;

  const imageBuild = await runCommand({
    command: 'docker',
    args: [
      'build',
      '--quiet',
      '--platform',
      input.platform,
      '--build-arg',
      `NODE_VERSION=${input.toolchain.node}`,
      '--build-arg',
      `NPM_VERSION=${input.toolchain.npm}`,
      '--build-arg',
      `PNPM_VERSION=${input.toolchain.pnpm}`,
      '--tag',
      input.image,
      '--file',
      'packages/release-tools/Dockerfile',
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
      input.platform,
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
      `TENKIT_NODE_VERSION=${input.toolchain.node}`,
      '--env',
      `TENKIT_NPM_VERSION=${input.toolchain.npm}`,
      '--env',
      `TENKIT_PNPM_VERSION=${input.toolchain.pnpm}`,
      canonicalImageId,
      'node',
      '/usr/local/lib/tenkit-release-tools/scripts/reproduce-release-set-in-container.mjs',
    ],
    cwd: input.sourceRoot,
  });
}
