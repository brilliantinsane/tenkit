import type { ReleaseToolchain } from './release-toolchain';
import { runReleaseCommand, type RunReleaseCommand } from './release-command';

export const RELEASE_CONTAINER_IMAGE =
  'node:24.16.0-bookworm-slim@sha256:2c87ef9bd3c6a3bd4b472b4bec2ce9d16354b0c574f736c476489d09f560a203';
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
      input.image,
      'node',
      'packages/release-tools/scripts/reproduce-release-set-in-container.mjs',
    ],
    cwd: input.sourceRoot,
  });
}
