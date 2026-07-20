import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access, mkdir, readFile, realpath, symlink } from 'node:fs/promises';
import { delimiter, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type ReleaseToolchain = {
  node: string;
  npm: string;
  pnpm: string;
};

type AssertPinnedReleaseToolchainInput = {
  activeNodeVersion?: string;
  runVersionCommand?(command: 'npm' | 'pnpm'): Promise<string>;
};

export type InstalledReleaseToolchain = {
  executables: {
    node: string;
    npm: string;
    pnpm: string;
  };
  env: NodeJS.ProcessEnv;
};

type InstallPinnedReleaseToolchainInput = {
  targetRoot: string;
  activeNodeExecutable?: string;
  baseEnv?: NodeJS.ProcessEnv;
  resolveExecutable?(command: 'npm' | 'pnpm'): Promise<string>;
  runInstalledVersionCommand?(tool: 'Node' | 'npm' | 'pnpm', executable: string): Promise<string>;
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

export async function readPinnedReleaseToolchain(workspaceRoot: string): Promise<ReleaseToolchain> {
  const [nodePin, npmPin, rootPackageContents] = await Promise.all([
    readRequiredFile(join(workspaceRoot, '.nvmrc'), 'the Node pin from .nvmrc'),
    readRequiredFile(join(workspaceRoot, '.npm-version'), 'the npm pin from .npm-version'),
    readRequiredFile(join(workspaceRoot, 'package.json'), 'the root package metadata'),
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

async function defaultRunVersionCommand(command: 'npm' | 'pnpm'): Promise<string> {
  const { stdout } = await execFileAsync(command, ['--version'], { encoding: 'utf8' });
  return stdout;
}

function assertVersion(tool: 'Node' | 'npm' | 'pnpm', expected: string, active: string): void {
  const normalizedActive = active.trim().replace(/^v/, '');

  if (normalizedActive !== expected) {
    throw new Error(
      `Release Set packing requires ${tool} ${expected}, but found ${normalizedActive || 'no version'}.`,
    );
  }
}

export async function assertPinnedReleaseToolchain(
  pinned: ReleaseToolchain,
  input: AssertPinnedReleaseToolchainInput = {},
): Promise<void> {
  assertVersion('Node', pinned.node, input.activeNodeVersion ?? process.version);
  const runVersionCommand = input.runVersionCommand ?? defaultRunVersionCommand;
  assertVersion('npm', pinned.npm, await runVersionCommand('npm'));
  assertVersion('pnpm', pinned.pnpm, await runVersionCommand('pnpm'));
}

async function resolveExecutableOnPath(command: 'npm' | 'pnpm'): Promise<string> {
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    if (!directory) {
      continue;
    }

    const candidate = join(directory, command);

    try {
      await access(candidate, constants.X_OK);
      return await realpath(candidate);
    } catch {
      continue;
    }
  }

  throw new Error(`Unable to locate the validated ${command} executable on PATH.`);
}

async function defaultRunInstalledVersionCommand(
  _tool: 'Node' | 'npm' | 'pnpm',
  executable: string,
): Promise<string> {
  const { stdout } = await execFileAsync(executable, ['--version'], { encoding: 'utf8' });
  return stdout;
}

export async function installPinnedReleaseToolchain(
  pinned: ReleaseToolchain,
  input: InstallPinnedReleaseToolchainInput,
): Promise<InstalledReleaseToolchain> {
  const binRoot = join(input.targetRoot, 'bin');
  await mkdir(binRoot, { recursive: true });
  const resolveExecutable = input.resolveExecutable ?? resolveExecutableOnPath;
  const sourceExecutables = {
    node: await realpath(input.activeNodeExecutable ?? process.execPath),
    npm: await resolveExecutable('npm'),
    pnpm: await resolveExecutable('pnpm'),
  };
  const executables = {
    node: join(binRoot, 'node'),
    npm: join(binRoot, 'npm'),
    pnpm: join(binRoot, 'pnpm'),
  };

  await Promise.all(
    (Object.keys(executables) as Array<keyof typeof executables>).map((tool) =>
      symlink(sourceExecutables[tool], executables[tool]),
    ),
  );

  const runInstalledVersionCommand =
    input.runInstalledVersionCommand ?? defaultRunInstalledVersionCommand;
  assertVersion('Node', pinned.node, await runInstalledVersionCommand('Node', executables.node));
  assertVersion('npm', pinned.npm, await runInstalledVersionCommand('npm', executables.npm));
  assertVersion('pnpm', pinned.pnpm, await runInstalledVersionCommand('pnpm', executables.pnpm));

  return {
    executables,
    env: {
      ...(input.baseEnv ?? process.env),
      PATH: [binRoot, input.baseEnv?.PATH ?? process.env.PATH].filter(Boolean).join(delimiter),
    },
  };
}
