import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { RELEASE_SET_PACKAGES, type ReleaseSetPackageName } from './release-set';

const execFileAsync = promisify(execFile);
const PUBLIC_REGISTRY = 'https://registry.npmjs.org/';
const DEFAULT_PNPM_MINIMUM_RELEASE_AGE_MINUTES = 24 * 60;
const REPRESENTATIVE_PROJECT_NAME = 'tenkit-candidate-smoke';

type ExternalCommandInput = {
  command: string;
  args: readonly string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
};

type ExternalCommandResult = {
  stdout: string;
  stderr: string;
};

export type RunCandidateSmokeExternalCommand = (
  input: ExternalCommandInput,
) => Promise<ExternalCommandResult>;

type RunCandidateSmokeCommandInput = {
  args: readonly string[];
  workspaceRoot: string;
  write(message: string): void;
  runCommand?: RunCandidateSmokeExternalCommand;
  now?: () => Date;
};

type CandidatePackageMetadata = {
  packageName: ReleaseSetPackageName;
  latestVersion?: string;
  publishedAt?: Date;
  dependencies: Record<string, string>;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseArguments(args: readonly string[]): string {
  const commandArgs = args[0] === '--' ? args.slice(1) : args;

  if (
    commandArgs.length !== 2 ||
    commandArgs[0] !== '--version' ||
    !commandArgs[1] ||
    !/^\d+\.\d+\.\d+$/.test(commandArgs[1])
  ) {
    throw new Error('Usage: pnpm release:smoke -- --version <exact-major.minor.patch-version>');
  }

  return commandArgs[1];
}

function parseJson(output: string, description: string): unknown {
  try {
    return JSON.parse(output) as unknown;
  } catch (error) {
    throw new Error(`npm returned invalid JSON for ${description}.`, { cause: error });
  }
}

function parseCandidateMetadata(
  value: unknown,
  packageName: ReleaseSetPackageName,
  version: string,
): CandidatePackageMetadata {
  if (!isRecord(value) || value.name !== packageName || value.version !== version) {
    throw new Error(`public package identity mismatch for ${packageName}@${version}.`);
  }

  const distTags = value['dist-tags'];

  if (!isRecord(distTags) || distTags.candidate !== version) {
    throw new Error(
      `${packageName} candidate tag expected ${version}, found ${String(isRecord(distTags) ? distTags.candidate : undefined)}.`,
    );
  }

  const time = value.time;
  const publishedAtValue = isRecord(time) ? time[version] : undefined;
  const publishedAt =
    typeof publishedAtValue === 'string' ? new Date(publishedAtValue) : new Date(Number.NaN);

  const dependencies = isRecord(value.dependencies)
    ? Object.fromEntries(
        Object.entries(value.dependencies).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
    : {};

  return {
    packageName,
    ...(typeof distTags.latest === 'string' ? { latestVersion: distTags.latest } : {}),
    ...(!Number.isNaN(publishedAt.getTime()) ? { publishedAt } : {}),
    dependencies,
  };
}

function assertInternalDependencies(
  metadata: readonly CandidatePackageMetadata[],
  version: string,
): void {
  for (const releasePackage of RELEASE_SET_PACKAGES) {
    if (!('internalDependency' in releasePackage)) {
      continue;
    }

    const packageMetadata = metadata.find(
      ({ packageName }) => packageName === releasePackage.name,
    )!;
    const actualVersion = packageMetadata.dependencies[releasePackage.internalDependency];

    if (actualVersion !== version) {
      throw new Error(
        `Dependency drift: ${releasePackage.name}@${version} must depend on ${releasePackage.internalDependency}@${version}, found ${String(actualVersion)}.`,
      );
    }
  }
}

function assertPreviousLatestState(metadata: readonly CandidatePackageMetadata[], version: string) {
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

function isolatedEnvironment(cwd: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    INIT_CWD: cwd,
    npm_config_registry: PUBLIC_REGISTRY,
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

export const runCandidateSmokeExternalCommand: RunCandidateSmokeExternalCommand = async (input) => {
  try {
    const result = await execFileAsync(input.command, [...input.args], {
      cwd: input.cwd,
      env: input.env,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });

    return { stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const diagnostic =
      error && typeof error === 'object' && 'stderr' in error && typeof error.stderr === 'string'
        ? error.stderr.replaceAll(input.cwd, '<candidate-smoke-dir>').trim()
        : '';
    throw new Error(`${input.command} failed${diagnostic ? `: ${diagnostic}` : '.'}`, {
      cause: error,
    });
  }
};

export async function runCandidateSmokeCommand(
  input: RunCandidateSmokeCommandInput,
): Promise<number> {
  const version = parseArguments(input.args);
  const runCommand = input.runCommand ?? runCandidateSmokeExternalCommand;
  const now = (input.now ?? (() => new Date()))();
  const metadata: CandidatePackageMetadata[] = [];

  for (const releasePackage of RELEASE_SET_PACKAGES) {
    let commandResult: ExternalCommandResult;

    try {
      commandResult = await runCommand({
        command: 'npm',
        args: [
          'view',
          `${releasePackage.name}@${version}`,
          'name',
          'version',
          'dependencies',
          'dist-tags',
          'time',
          '--json',
        ],
        cwd: input.workspaceRoot,
        env: { ...process.env, npm_config_registry: PUBLIC_REGISTRY },
      });
      metadata.push(
        parseCandidateMetadata(
          parseJson(commandResult.stdout, `${releasePackage.name} Candidate metadata`),
          releasePackage.name,
          version,
        ),
      );
    } catch (error) {
      throw new Error(
        `Candidate tags: incomplete for ${releasePackage.name}@${version}. ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }

  assertInternalDependencies(metadata, version);
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
  const operationRoot = await mkdtemp(join(tmpdir(), 'tenkit-candidate-smoke-'));

  try {
    for (const launcher of LAUNCHERS) {
      const launcherRoot = join(operationRoot, `${launcher.command}-launcher`);
      await mkdir(launcherRoot);
      await mkdir(join(launcherRoot, '.bun-create'));

      let result: ExternalCommandResult;

      try {
        result = await runCommand({
          command: launcher.command,
          args: launcher.args(version),
          cwd: launcherRoot,
          env: isolatedEnvironment(launcherRoot),
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
          'npm',
          '--yes',
          '--no-install',
          '--no-git',
        ],
        cwd: generationRoot,
        env: isolatedEnvironment(generationRoot),
      });
      const generatedPackageJson = parseJson(
        await readFile(join(generationRoot, REPRESENTATIVE_PROJECT_NAME, 'package.json'), 'utf8'),
        'representative generated project package.json',
      );

      if (
        !isRecord(generatedPackageJson) ||
        generatedPackageJson.name !== REPRESENTATIVE_PROJECT_NAME
      ) {
        throw new Error('representative project package identity mismatch.');
      }
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
