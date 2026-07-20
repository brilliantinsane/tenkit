import { execFile } from 'node:child_process';
import { basename } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

type RunReleaseCommandInput = {
  command: string;
  args: readonly string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
};

export async function runReleaseCommand(input: RunReleaseCommandInput) {
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

export type RunReleaseCommand = typeof runReleaseCommand;
