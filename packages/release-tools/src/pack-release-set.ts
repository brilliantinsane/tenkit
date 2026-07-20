import { execFile } from 'node:child_process';
import { lstat, mkdir, mkdtemp, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { promisify } from 'node:util';

import { injectReleaseSetVersion } from './inject-release-set-version';
import { inspectPackedReleasePackage } from './packed-release-package';
import { verifyPackedReleaseSet as defaultVerifyPackedReleaseSet } from './packed-release-smoke';
import { createReleaseSetManifest, type PackedReleasePackage } from './release-set-manifest';
import type { ReleaseSetPlan } from './release-plan';
import { getReleaseSetPackage, RELEASE_SET_PACKAGES } from './release-set';
import {
  assertPinnedReleaseToolchain,
  installPinnedReleaseToolchain,
  readPinnedReleaseToolchain,
} from './release-toolchain';

const execFileAsync = promisify(execFile);

export type RunReleaseCommandInput = {
  command: string;
  args: readonly string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
};

export type RunReleaseCommandResult = {
  stdout: string;
  stderr: string;
};

export type RunReleaseCommand = (input: RunReleaseCommandInput) => Promise<RunReleaseCommandResult>;

type PrepareReleaseWorkspaceInput = {
  repositoryRoot: string;
  isolatedWorkspaceRoot: string;
  sourceSha: string;
  runCommand?: RunReleaseCommand;
};

type VerifyPackedReleaseSetInput = {
  artifactPaths: readonly string[];
  expectedVersion: string;
  runCommand: RunReleaseCommand;
};

type PrepareIsolatedWorkspace = (input: PrepareReleaseWorkspaceInput) => Promise<void>;
type VerifyPackedReleaseSet = (input: VerifyPackedReleaseSetInput) => Promise<void>;

export type PackReleaseSetInput = {
  repositoryRoot: string;
  outputRoot: string;
  plan: Extract<ReleaseSetPlan, { kind: 'release' }>;
  activeNodeVersion?: string;
  now?: () => Date;
  prepareIsolatedWorkspace?: PrepareIsolatedWorkspace;
  resolveToolExecutable?(command: 'npm' | 'pnpm'): Promise<string>;
  runCommand?: RunReleaseCommand;
  verifyPackedReleaseSet?: VerifyPackedReleaseSet;
};

export type PackReleaseSetResult = {
  manifestPath: string;
  artifactPaths: string[];
};

export async function runReleaseCommand(
  input: RunReleaseCommandInput,
): Promise<RunReleaseCommandResult> {
  try {
    const result = await execFileAsync(input.command, [...input.args], {
      cwd: input.cwd,
      env: {
        ...process.env,
        ...input.env,
        INIT_CWD: input.cwd,
      },
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
    return { stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'stderr' in error &&
      typeof error.stderr === 'string'
    ) {
      const diagnostic = error.stderr.replaceAll(input.cwd, '<release-workspace>').trim();
      throw new Error(`${basename(input.command)} failed${diagnostic ? `: ${diagnostic}` : '.'}`, {
        cause: error,
      });
    }

    throw new Error(`${basename(input.command)} failed.`, { cause: error });
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

export async function prepareReleaseWorkspace(input: PrepareReleaseWorkspaceInput): Promise<void> {
  const runCommand = input.runCommand ?? runReleaseCommand;
  const archivePath = `${input.isolatedWorkspaceRoot}.tar`;
  await mkdir(input.isolatedWorkspaceRoot, { recursive: true });

  try {
    const resolvedSource = await runCommand({
      command: 'git',
      args: ['rev-parse', `${input.sourceSha}^{commit}`],
      cwd: input.repositoryRoot,
    });

    if (resolvedSource.stdout.trim() !== input.sourceSha) {
      throw new Error(
        `Approved Release Set source ${input.sourceSha} resolved to ${resolvedSource.stdout.trim()}.`,
      );
    }

    await runCommand({
      command: 'git',
      args: ['archive', '--format=tar', `--output=${archivePath}`, input.sourceSha],
      cwd: input.repositoryRoot,
    });
    await runCommand({
      command: 'tar',
      args: ['-xf', archivePath, '-C', input.isolatedWorkspaceRoot],
      cwd: input.repositoryRoot,
    });
  } finally {
    if (await pathExists(archivePath)) {
      await unlink(archivePath);
    }
  }
}

function artifactFilename(packageName: string, version: string): string {
  return `${getReleaseSetPackage(packageName).artifactPrefix}-${version}.tgz`;
}

export async function packReleaseSet(input: PackReleaseSetInput): Promise<PackReleaseSetResult> {
  if (await pathExists(input.outputRoot)) {
    throw new Error('Release Set output directory already exists.');
  }

  const outputParent = dirname(input.outputRoot);
  const outputParentStats = await lstat(outputParent);

  if (!outputParentStats.isDirectory()) {
    throw new Error('Release Set output parent is not a directory.');
  }

  const operationRoot = await mkdtemp(join(outputParent, '.tenkit-release-pack-'));
  const isolatedWorkspaceRoot = join(operationRoot, 'source');
  const artifactRoot = join(operationRoot, 'result');
  const runCommand = input.runCommand ?? runReleaseCommand;
  const prepareIsolatedWorkspace = input.prepareIsolatedWorkspace ?? prepareReleaseWorkspace;

  try {
    await prepareIsolatedWorkspace({
      repositoryRoot: input.repositoryRoot,
      isolatedWorkspaceRoot,
      sourceSha: input.plan.sourceSha,
      runCommand,
    });
    const toolchain = await readPinnedReleaseToolchain(isolatedWorkspaceRoot);
    await assertPinnedReleaseToolchain(toolchain, {
      activeNodeVersion: input.activeNodeVersion,
      async runVersionCommand(command) {
        const result = await runCommand({
          command,
          args: ['--version'],
          cwd: isolatedWorkspaceRoot,
        });
        return result.stdout;
      },
    });
    const installedToolchain = await installPinnedReleaseToolchain(toolchain, {
      targetRoot: join(operationRoot, 'toolchain'),
      activeNodeExecutable: process.execPath,
      resolveExecutable: input.resolveToolExecutable,
      async runInstalledVersionCommand(_tool, executable) {
        const result = await runCommand({
          command: executable,
          args: ['--version'],
          cwd: isolatedWorkspaceRoot,
        });
        return result.stdout;
      },
    });
    const runPinnedCommand: RunReleaseCommand = (commandInput) => {
      const command =
        commandInput.command === 'node' ||
        commandInput.command === 'npm' ||
        commandInput.command === 'pnpm'
          ? installedToolchain.executables[commandInput.command]
          : commandInput.command;

      return runCommand({
        ...commandInput,
        command,
        env: {
          ...installedToolchain.env,
          ...commandInput.env,
        },
      });
    };
    await injectReleaseSetVersion({ isolatedWorkspaceRoot, plan: input.plan });
    await runPinnedCommand({
      command: 'pnpm',
      args: ['install', '--frozen-lockfile', '--ignore-scripts'],
      cwd: isolatedWorkspaceRoot,
    });
    await mkdir(artifactRoot);

    for (const releasePackage of RELEASE_SET_PACKAGES) {
      await runPinnedCommand({
        command: 'pnpm',
        args: ['--filter', releasePackage.name, 'pack', '--pack-destination', artifactRoot],
        cwd: isolatedWorkspaceRoot,
      });
    }

    const packedPackages: PackedReleasePackage[] = [];

    for (const releasePackage of RELEASE_SET_PACKAGES) {
      packedPackages.push(
        await inspectPackedReleasePackage({
          artifactPath: join(
            artifactRoot,
            artifactFilename(releasePackage.name, input.plan.version),
          ),
          expectedName: releasePackage.name,
          expectedVersion: input.plan.version,
          forbiddenPathFragments: [input.repositoryRoot, isolatedWorkspaceRoot],
        }),
      );
    }

    const artifactPaths = packedPackages.map(({ artifactFilename }) =>
      join(artifactRoot, artifactFilename),
    );
    await (input.verifyPackedReleaseSet ?? defaultVerifyPackedReleaseSet)({
      artifactPaths,
      expectedVersion: input.plan.version,
      runCommand: runPinnedCommand,
    });
    const manifest = createReleaseSetManifest({
      plan: input.plan,
      packedPackages,
      toolchain,
      createdAt: (input.now?.() ?? new Date()).toISOString(),
    });
    const manifestFilename = `release-set-${input.plan.version}.json`;
    await writeFile(join(artifactRoot, manifestFilename), `${JSON.stringify(manifest, null, 2)}\n`);
    await rename(artifactRoot, input.outputRoot);

    return {
      manifestPath: join(input.outputRoot, manifestFilename),
      artifactPaths: packedPackages.map(({ artifactFilename }) =>
        join(input.outputRoot, artifactFilename),
      ),
    };
  } finally {
    await rm(operationRoot, { recursive: true });
  }
}
