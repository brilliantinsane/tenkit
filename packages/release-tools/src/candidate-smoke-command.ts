import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, isAbsolute, join, relative, resolve } from 'node:path';

import {
  verifyGeneratedProject as verifyGeneratedProjectFromLocalProof,
  type VerifyGeneratedProjectOptions,
} from '@tenkit/template-generator/local-proof';

import { parseExactStableVersion } from './exact-stable-version';
import {
  PUBLIC_NPM_REGISTRY,
  PublicCandidatePackageError,
  readPublicCandidateReleaseSet,
  type PublicCandidatePackageMetadata,
} from './public-candidate-release-set';
import { runReleaseCommand, type RunReleaseCommand } from './run-release-command';

const DEFAULT_PNPM_MINIMUM_RELEASE_AGE_MINUTES = 24 * 60;
const REPRESENTATIVE_PROJECT_NAME = 'tenkit-candidate-smoke';

export type RunCandidateSmokeExternalCommand = RunReleaseCommand;

type RunCandidateSmokeCommandInput = {
  args: readonly string[];
  workspaceRoot: string;
  write(message: string): void;
  runCommand?: RunCandidateSmokeExternalCommand;
  now?: () => Date;
  verifyGeneratedProject?: (options: VerifyGeneratedProjectOptions) => Promise<void>;
};

type Launcher = {
  name: 'npm' | 'pnpm' | 'Bun';
  command: 'npm' | 'pnpm' | 'bun';
  args(version: string): readonly string[];
};

const LAUNCHERS: readonly Launcher[] = [
  {
    name: 'npm',
    command: 'npm',
    args: (version) => ['create', `tenkit@${version}`, '--', '--version'],
  },
  {
    name: 'pnpm',
    command: 'pnpm',
    args: (version) => ['--config.minimumReleaseAge=0', 'create', `tenkit@${version}`, '--version'],
  },
  {
    name: 'Bun',
    command: 'bun',
    args: (version) => ['x', `create-tenkit@${version}`, '--version'],
  },
];

function parseArguments(args: readonly string[]): string {
  const commandArgs = args[0] === '--' ? args.slice(1) : args;

  if (
    commandArgs.length !== 2 ||
    commandArgs[0] !== '--version' ||
    !commandArgs[1] ||
    !parseExactStableVersion(commandArgs[1])
  ) {
    throw new Error('Usage: pnpm release:smoke -- --version <exact-major.minor.patch-version>');
  }

  return commandArgs[1];
}

function assertPreviousLatestState(
  metadata: readonly PublicCandidatePackageMetadata[],
  version: string,
) {
  const latestVersions = new Set(metadata.map(({ latestVersion }) => latestVersion));

  if (metadata.some(({ latestVersion }) => latestVersion === version)) {
    throw new Error(
      `Stable tags: latest already points to ${version}; Candidate Smoke must run before Promotion.`,
    );
  }

  if (latestVersions.size > 1) {
    throw new Error('Stable tags: latest does not identify one coherent previous Release Set.');
  }
}

const ALLOWED_PROCESS_ENV_KEYS = [
  'CI',
  'COLORTERM',
  'ComSpec',
  'FORCE_COLOR',
  'LANG',
  'LC_ALL',
  'NO_COLOR',
  'PATHEXT',
  'SystemRoot',
  'TERM',
  'WINDIR',
] as const;

function isInsideWorkspace(path: string, workspaceRoot: string): boolean {
  const relativePath = relative(resolve(workspaceRoot), resolve(path));
  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));
}

function isolatedEnvironment(workspaceRoot: string, cwd: string): Record<string, string> {
  const environment = Object.fromEntries(
    ALLOWED_PROCESS_ENV_KEYS.flatMap((key) =>
      process.env[key] === undefined ? [] : [[key, process.env[key]!]],
    ),
  );
  const executablePath = process.env.PATH?.split(delimiter)
    .filter((path) => path !== '' && !isInsideWorkspace(path, workspaceRoot))
    .join(delimiter);

  if (!executablePath) {
    throw new Error('Candidate Smoke requires a non-workspace executable PATH.');
  }

  return {
    ...environment,
    PATH: executablePath,
    INIT_CWD: cwd,
    npm_config_registry: PUBLIC_NPM_REGISTRY,
    npm_config_cache: join(cwd, '.npm-cache'),
    npm_config_yes: 'true',
    XDG_CACHE_HOME: join(cwd, '.cache'),
    BUN_INSTALL_CACHE_DIR: join(cwd, '.bun-cache'),
    BUN_CREATE_DIR: join(cwd, '.bun-create'),
  };
}

function hasExactVersionLine(output: string, version: string): boolean {
  return output.split(/\r?\n/).some((line) => line.trim() === version);
}

export async function runCandidateSmokeCommand(
  input: RunCandidateSmokeCommandInput,
): Promise<number> {
  const version = parseArguments(input.args);
  const runCommand = input.runCommand ?? runReleaseCommand;
  const verifyGeneratedProject =
    input.verifyGeneratedProject ?? verifyGeneratedProjectFromLocalProof;
  const now = (input.now ?? (() => new Date()))();
  const operationRoot = await mkdtemp(join(tmpdir(), 'tenkit-candidate-smoke-'));

  try {
    const metadataRoot = join(operationRoot, 'registry-metadata');
    await mkdir(metadataRoot);
    let metadata: PublicCandidatePackageMetadata[];

    try {
      metadata = await readPublicCandidateReleaseSet({
        version,
        cwd: metadataRoot,
        env: isolatedEnvironment(input.workspaceRoot, metadataRoot),
        runNpmCommand: runCommand,
        errorDetail: 'none',
        inheritProcessEnv: false,
      });
    } catch (error) {
      const packageName =
        error instanceof PublicCandidatePackageError ? error.packageName : 'unknown package';
      const failure =
        error instanceof PublicCandidatePackageError && error.kind === 'dependency'
          ? 'Dependency drift'
          : `Candidate tags: incomplete for ${packageName}@${version}`;
      throw new Error(`${failure}. ${error instanceof Error ? error.message : String(error)}`, {
        cause: error,
      });
    }

    assertPreviousLatestState(metadata, version);

    const missingPublicationTime = metadata.find(({ publishedAt }) => publishedAt === undefined);

    if (missingPublicationTime) {
      throw new Error(
        `Package-age visibility: ${missingPublicationTime.packageName}@${version} has no valid public publication timestamp.`,
      );
    }

    const youngestPublication = new Date(
      Math.max(...metadata.map(({ publishedAt }) => publishedAt!.getTime())),
    );

    if (youngestPublication.getTime() > now.getTime()) {
      throw new Error('Package-age visibility: npm returned a future publication timestamp.');
    }

    const fullVisibilityAt = new Date(
      youngestPublication.getTime() + DEFAULT_PNPM_MINIMUM_RELEASE_AGE_MINUTES * 60_000,
    );

    for (const launcher of LAUNCHERS) {
      const launcherRoot = join(operationRoot, `${launcher.command}-launcher`);
      await mkdir(launcherRoot);
      await mkdir(join(launcherRoot, '.bun-create'));

      let result;

      try {
        result = await runCommand({
          command: launcher.command,
          args: launcher.args(version),
          cwd: launcherRoot,
          env: isolatedEnvironment(input.workspaceRoot, launcherRoot),
          errorDetail: 'none',
          inheritProcessEnv: false,
        });
      } catch (error) {
        throw new Error(
          `Launcher resolution (${launcher.name}): ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
      }

      if (!hasExactVersionLine(result.stdout, version)) {
        throw new Error(
          `Launcher resolution (${launcher.name}): create-tenkit did not report exact version ${version}.`,
        );
      }
    }

    const generationRoot = join(operationRoot, 'representative-generation');
    await mkdir(generationRoot);

    try {
      await runCommand({
        command: 'npm',
        args: [
          'create',
          `tenkit@${version}`,
          '--',
          '--name',
          REPRESENTATIVE_PROJECT_NAME,
          '--setup',
          'runtime-tenants',
          '--styling',
          'bare',
          '--package-manager',
          'pnpm',
          '--yes',
          '--no-install',
          '--no-git',
        ],
        cwd: generationRoot,
        env: isolatedEnvironment(input.workspaceRoot, generationRoot),
        errorDetail: 'none',
        inheritProcessEnv: false,
      });
      await verifyGeneratedProject({
        targetDir: join(generationRoot, REPRESENTATIVE_PROJECT_NAME),
        setupType: 'single-app-runtime-tenants',
        packageManager: 'pnpm',
        env: isolatedEnvironment(
          input.workspaceRoot,
          join(generationRoot, REPRESENTATIVE_PROJECT_NAME),
        ),
        inheritProcessEnv: false,
      });
    } catch (error) {
      throw new Error(
        `Generated output: representative Candidate create flow failed. ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }

    const packageAgeMessage =
      now.getTime() < fullVisibilityAt.getTime()
        ? `Package-age visibility: DELAYED for default pnpm policy until ${fullVisibilityAt.toISOString()}. Waiting is optional; exact-version Candidate Smoke remains valid.`
        : `Package-age visibility: READY for the default pnpm policy since ${fullVisibilityAt.toISOString()}.`;
    const latestVersion = metadata[0]!.latestVersion ?? 'not set';

    input.write(
      [
        'Candidate Smoke: PASS',
        `Version: ${version}`,
        `Candidate tags: complete at ${version}`,
        `Latest tags: unchanged at ${latestVersion}`,
        `Internal dependencies: exact at ${version}`,
        ...LAUNCHERS.map(({ name }) => `${name} launcher: create-tenkit@${version}`),
        'Representative project: Runtime Tenant App with Bare Styling',
        packageAgeMessage,
        '',
      ].join('\n'),
    );
    return 0;
  } finally {
    await rm(operationRoot, { recursive: true });
  }
}
