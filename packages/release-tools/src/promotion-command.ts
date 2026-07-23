import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

import {
  PUBLIC_NPM_REGISTRY,
  PublicCandidatePackageError,
  readPublicCandidateReleaseSet,
  type PublicCandidatePackageMetadata,
} from './public-candidate-release-set';
import { RELEASE_SET_PACKAGES } from './release-set';
import {
  runReleaseCommand,
  type RunReleaseCommand,
  type RunReleaseCommandInput,
} from './run-release-command';

const AUTOMATION_AUTH_ENVIRONMENT_KEYS = [
  'ACTIONS_ID_TOKEN_REQUEST_TOKEN',
  'ACTIONS_ID_TOKEN_REQUEST_URL',
  'NODE_AUTH_TOKEN',
  'NPM_CONFIG_TOKEN',
  'NPM_TOKEN',
] as const;

type RunPromotionCommandInput = {
  args: readonly string[];
  workspaceRoot: string;
  write(message: string): void;
  runNpmCommand?: RunReleaseCommand;
  runAuthenticatedNpmCommand?: RunReleaseCommand;
  confirmApply?: (version: string) => Promise<boolean>;
};

type PromotionArguments = {
  version: string;
  apply: boolean;
};

function parseArguments(args: readonly string[]): PromotionArguments {
  const commandArgs = args[0] === '--' ? args.slice(1) : args;
  const validPreview =
    commandArgs.length === 2 &&
    commandArgs[0] === '--version' &&
    typeof commandArgs[1] === 'string';
  const validApply =
    commandArgs.length === 3 &&
    commandArgs[0] === '--version' &&
    typeof commandArgs[1] === 'string' &&
    commandArgs[2] === '--apply';
  const version = commandArgs[1];

  if ((!validPreview && !validApply) || !version || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(
      'Usage: pnpm release:promote -- --version <exact-major.minor.patch-version> [--apply]',
    );
  }

  return { version, apply: validApply };
}

function assertNoAutomationAuthentication(): void {
  const configuredKey = AUTOMATION_AUTH_ENVIRONMENT_KEYS.find(
    (key) => process.env[key] !== undefined,
  );

  if (configuredKey) {
    throw new Error(
      `Promotion apply refuses automation authentication from ${configuredKey}. Remove token or OIDC environment credentials and use the maintainer's interactive npm session.`,
    );
  }
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);

  for (let index = 0; index < 3; index += 1) {
    const difference = leftParts[index]! - rightParts[index]!;

    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

function formatLatestState(metadata: readonly PublicCandidatePackageMetadata[]): string {
  return metadata
    .map(({ packageName, latestVersion }) => `${packageName}=${latestVersion ?? 'not set'}`)
    .join(', ');
}

function assertForwardLatestState(
  metadata: readonly PublicCandidatePackageMetadata[],
  version: string,
): void {
  const firstPendingIndex = metadata.findIndex(({ latestVersion }) => latestVersion !== version);

  if (
    firstPendingIndex !== -1 &&
    metadata.slice(firstPendingIndex + 1).some(({ latestVersion }) => latestVersion === version)
  ) {
    throw new Error(
      `latest state is not a dependency-order prefix of the intended Release Set. Observed: ${formatLatestState(metadata)}.`,
    );
  }

  const pendingMetadata = firstPendingIndex === -1 ? [] : metadata.slice(firstPendingIndex);
  const previousLatestVersions = new Set(pendingMetadata.map(({ latestVersion }) => latestVersion));

  if (previousLatestVersions.size > 1) {
    throw new Error(`latest versions disagree. Observed: ${formatLatestState(metadata)}.`);
  }

  const previousLatestVersion = pendingMetadata[0]?.latestVersion;

  if (
    previousLatestVersion !== undefined &&
    (!/^\d+\.\d+\.\d+$/.test(previousLatestVersion) ||
      compareVersions(previousLatestVersion, version) >= 0)
  ) {
    throw new Error(
      `Promotion cannot move latest backward from ${previousLatestVersion} to ${version}.`,
    );
  }
}

async function readPromotionState(
  input: Pick<RunPromotionCommandInput, 'workspaceRoot'>,
  version: string,
  runNpmCommand: RunReleaseCommand,
): Promise<PublicCandidatePackageMetadata[]> {
  let metadata: PublicCandidatePackageMetadata[];

  try {
    metadata = await readPublicCandidateReleaseSet({
      version,
      cwd: input.workspaceRoot,
      env: { npm_config_registry: PUBLIC_NPM_REGISTRY },
      runNpmCommand,
      errorDetail: 'none',
    });
  } catch (error) {
    const packageName =
      error instanceof PublicCandidatePackageError ? error.packageName : 'unknown package';
    throw new Error(
      `Registry state: unable to verify ${packageName}@${version}. ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  assertForwardLatestState(metadata, version);
  return metadata;
}

function renderMutationPlan(
  metadata: readonly PublicCandidatePackageMetadata[],
  version: string,
): string[] {
  return metadata.map(({ packageName, latestVersion }, index) =>
    latestVersion === version
      ? `${index + 1}. ${packageName} latest: already ${version}`
      : `${index + 1}. ${packageName} latest: ${latestVersion ?? 'not set'} -> ${version}`,
  );
}

async function confirmApply(version: string): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      'Promotion apply requires an interactive terminal for human confirmation and npm authentication or 2FA.',
    );
  }

  const prompt = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const answer = await prompt.question(`Type ${version} to confirm Promotion: `);
    return answer.trim() === version;
  } finally {
    prompt.close();
  }
}

async function runAuthenticatedNpmCommand(
  input: RunReleaseCommandInput,
): Promise<{ stdout: string; stderr: string }> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(input.command, [...input.args], {
      cwd: input.cwd,
      env: {
        ...process.env,
        ...input.env,
        INIT_CWD: input.cwd,
      },
      stdio: 'inherit',
    });

    child.once('error', (error) => {
      reject(new Error('npm Promotion command failed to start.', { cause: error }));
    });
    child.once('close', (exitCode, signal) => {
      if (exitCode === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `npm Promotion command failed${signal ? ` with signal ${signal}` : ` with exit code ${String(exitCode)}`}.`,
        ),
      );
    });
  });

  return { stdout: '', stderr: '' };
}

export async function runPromotionCommand(input: RunPromotionCommandInput): Promise<number> {
  const { version, apply } = parseArguments(input.args);
  const runNpmRead = input.runNpmCommand ?? runReleaseCommand;
  const runNpmMutation = input.runAuthenticatedNpmCommand ?? runAuthenticatedNpmCommand;
  let metadata = await readPromotionState(input, version, runNpmRead);

  if (!apply) {
    const plan = renderMutationPlan(metadata, version);

    input.write(
      [
        'Promotion preview: PASS',
        `Version: ${version}`,
        `Candidate tags: complete at ${version}`,
        `Internal dependencies: exact at ${version}`,
        'Intended latest mutations in dependency order:',
        ...plan,
        'Package bytes: unchanged',
        'GitHub state: unchanged',
        `Apply: pnpm release:promote -- --version ${version} --apply`,
        '',
      ].join('\n'),
    );
    return 0;
  }

  assertNoAutomationAuthentication();

  if (!(await (input.confirmApply ?? confirmApply)(version))) {
    throw new Error('Promotion cancelled: confirmation did not match the intended version.');
  }

  metadata = await readPromotionState(input, version, runNpmRead);

  input.write(
    [
      `Promotion apply: ${version}`,
      'Using the maintainer authenticated npm session. Complete interactive authentication or 2FA when npm requests it.',
      ...renderMutationPlan(metadata, version),
      '',
    ].join('\n'),
  );

  for (const releasePackage of RELEASE_SET_PACKAGES) {
    const currentPackage = metadata.find(({ packageName }) => packageName === releasePackage.name)!;

    if (currentPackage.latestVersion === version) {
      continue;
    }

    await runNpmMutation({
      command: 'npm',
      args: ['dist-tag', 'add', `${releasePackage.name}@${version}`, 'latest'],
      cwd: input.workspaceRoot,
      env: { npm_config_registry: PUBLIC_NPM_REGISTRY },
    });
    metadata = await readPromotionState(input, version, runNpmRead);

    if (
      metadata.find(({ packageName }) => packageName === releasePackage.name)?.latestVersion !==
      version
    ) {
      throw new Error(
        `Promotion verification failed: ${releasePackage.name} latest does not equal ${version}.`,
      );
    }
  }

  if (metadata.some(({ latestVersion }) => latestVersion !== version)) {
    throw new Error(`Promotion incomplete: not every latest tag equals ${version}.`);
  }

  input.write(
    [
      'Promotion apply: PASS',
      `All latest tags: ${version}`,
      'Package bytes: unchanged',
      'GitHub state: unchanged',
      '',
      'Manual Finalize:',
      `1. Open the existing draft GitHub Release v${version}.`,
      `2. Confirm it is still a draft for v${version}, its target is the full reviewed Source SHA, and all three latest tags equal ${version}.`,
      '3. Read the release notes, confirm it is not a prerelease, then click Publish release manually.',
      `4. Confirm the public v${version} tag points to the reviewed Source SHA.`,
      'Publishing the draft creates the stable Git tag and does not mutate npm. Do not repeat Candidate Smoke as a final registry smoke.',
      '',
    ].join('\n'),
  );
  return 0;
}
