import { spawnSync } from 'node:child_process';

export type NpmCommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type RunNpmCommand = (args: readonly string[]) => Promise<NpmCommandResult>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSemanticVersion(version: unknown): version is string {
  return (
    typeof version === 'string' &&
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
      version,
    )
  );
}

function stagedVersion(item: unknown, packageName: string): string {
  if (
    !isRecord(item) ||
    typeof item.id !== 'string' ||
    item.packageName !== packageName ||
    !isSemanticVersion(item.version) ||
    typeof item.tag !== 'string' ||
    typeof item.createdAt !== 'string' ||
    typeof item.actor !== 'string' ||
    typeof item.actorType !== 'string' ||
    (item.access !== 'public' && item.access !== 'private') ||
    typeof item.shasum !== 'string'
  ) {
    throw new Error(`npm returned an invalid staged package entry for ${packageName}.`);
  }

  return item.version;
}

function parseStagedVersions(output: string, packageName: string): Set<string> {
  let response: unknown;

  try {
    response = JSON.parse(output) as unknown;
  } catch (error) {
    throw new Error(`npm returned invalid staged-version JSON for ${packageName}.`, {
      cause: error,
    });
  }

  if (!Array.isArray(response)) {
    throw new Error(`npm returned invalid staged-version JSON for ${packageName}.`);
  }

  try {
    return new Set(response.map((item) => stagedVersion(item, packageName)));
  } catch (error) {
    throw new Error(`npm returned invalid staged-version JSON for ${packageName}.`, {
      cause: error,
    });
  }
}

export const runNpmCommand: RunNpmCommand = async (args) => {
  const command = spawnSync('npm', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (command.error) {
    throw new Error('Unable to start npm for read-only Release Set inspection.', {
      cause: command.error,
    });
  }

  return {
    exitCode: command.status ?? 1,
    stdout: command.stdout,
    stderr: command.stderr,
  };
};

export class NpmVersionOccupancy {
  constructor(private readonly runNpm: RunNpmCommand = runNpmCommand) {}

  async isPackageVersionOccupied(packageName: string, version: string): Promise<boolean> {
    const published = await this.runNpm(['view', `${packageName}@${version}`, 'version', '--json']);

    if (published.exitCode === 0) {
      return true;
    }

    if (!/\bE404\b/.test(`${published.stdout}\n${published.stderr}`)) {
      throw new Error(`Unable to inspect published version ${packageName}@${version}.`);
    }

    const staged = await this.runNpm(['stage', 'list', packageName, '--json']);

    if (staged.exitCode !== 0) {
      throw new Error(
        `Unable to inspect staged versions for ${packageName}. npm stage list requires maintainer registry access.`,
      );
    }

    return parseStagedVersions(staged.stdout, packageName).has(version);
  }
}
