import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type GeneratedAppCommandOptions = {
  env?: Record<string, string>;
  inheritProcessEnv?: boolean;
};

export async function runGeneratedAppCommand(
  cwd: string,
  command: string,
  args: string[],
  options: GeneratedAppCommandOptions = {},
): Promise<void> {
  const { env, inheritProcessEnv = true } = options;
  const commandText = [command, ...args].join(' ');
  const envKeysText = env ? ` with env keys: ${Object.keys(env).join(', ')}` : '';

  try {
    await execFileAsync(command, args, {
      cwd,
      env: {
        ...(inheritProcessEnv ? process.env : {}),
        ...env,
      },
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error) {
    if (error && typeof error === 'object') {
      const details: string[] = [];

      if ('code' in error && error.code !== undefined) {
        details.push(`exit code ${String(error.code)}`);
      }

      if ('signal' in error && error.signal !== undefined) {
        details.push(`signal ${String(error.signal)}`);
      }

      throw new Error(
        `Generated app verification command failed: ${commandText}${envKeysText}${
          details.length > 0 ? ` (${details.join(', ')})` : ''
        }. Re-run that command in the generated app for full output.`,
      );
    }

    throw error;
  }
}
