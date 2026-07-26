import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

import type { RunReleaseCommand } from './run-release-command';

const execFileAsync = promisify(execFile);
const PUBLIC_REGISTRY = 'https://registry.npmjs.org/';

type NpmCommandInput = {
  args: readonly string[];
  cwd: string;
};

type NpmCommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type RunReleaseVerificationNpmCommand = (
  input: NpmCommandInput,
) => Promise<NpmCommandResult>;

export const runReleaseVerificationNpmCommand: RunReleaseVerificationNpmCommand = async (input) => {
  try {
    const command = await execFileAsync('npm', [...input.args], {
      cwd: input.cwd,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });

    return { exitCode: 0, stdout: command.stdout, stderr: command.stderr };
  } catch (error) {
    if (error && typeof error === 'object') {
      const stdout = 'stdout' in error && typeof error.stdout === 'string' ? error.stdout : '';
      const stderr = 'stderr' in error && typeof error.stderr === 'string' ? error.stderr : '';
      const exitCode = 'code' in error && typeof error.code === 'number' ? error.code : 1;
      return { exitCode, stdout, stderr };
    }

    throw new Error('Unable to start npm for read-only Release Verification.', { cause: error });
  }
};

export function usePublicNpmRegistry(
  execute: RunReleaseVerificationNpmCommand,
): RunReleaseVerificationNpmCommand {
  return (command) =>
    execute({
      ...command,
      args:
        command.args[0] === '--version'
          ? command.args
          : [...command.args, '--registry', PUBLIC_REGISTRY],
    });
}

export async function verifyExactVersionCreateEntrypoint(input: {
  version: string;
  operationRoot: string;
  runCommand: RunReleaseCommand;
}): Promise<void> {
  const result = await input.runCommand({
    command: 'pnpm',
    args: ['--config.minimumReleaseAge=0', 'create', `tenkit@${input.version}`, '--version'],
    cwd: input.operationRoot,
    env: {
      npm_config_registry: PUBLIC_REGISTRY,
      npm_config_cache: join(input.operationRoot, '.npm-cache'),
    },
    errorDetail: 'none',
  });

  if (!result.stdout.split(/\r?\n/).some((line) => line.trim() === input.version)) {
    throw new Error(`Exact-version create-tenkit did not report exact version ${input.version}.`);
  }
}
