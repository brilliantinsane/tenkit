import { cancel } from '@clack/prompts';

import { findTenkitWorkspaceRoot } from './adapters/workspace';
import { createProgram } from './commands/create';
import type { CreateFlowEnvironment } from './create/types';
import { CreateFlowCancelledError } from './errors';
import { createPromptAdapter } from './prompts/create-prompts';

type CliIo = {
  stdout: Pick<NodeJS.WriteStream, 'write' | 'isTTY'>;
  stderr: Pick<NodeJS.WriteStream, 'write'>;
  stdin: Pick<NodeJS.ReadStream, 'isTTY'>;
};

export async function main(
  argv: string[] = process.argv.slice(2),
  io: CliIo = process,
): Promise<number> {
  const output = {
    log(message = '') {
      io.stdout.write(`${message}\n`);
    },
    error(message: string) {
      io.stderr.write(`${message}\n`);
    },
  };
  const workspaceRoot = await findTenkitWorkspaceRoot(import.meta.url);
  const env: CreateFlowEnvironment = {
    cwd: process.env.INIT_CWD ?? process.cwd(),
    workspaceRoot,
    isInteractive: io.stdin.isTTY === true && io.stdout.isTTY === true,
    packageManagerUserAgent: process.env.npm_config_user_agent,
    output,
    prompts: createPromptAdapter(),
  };
  const program = createProgram(env);

  try {
    await program.parseAsync(argv, { from: 'user' });
    return 0;
  } catch (error) {
    if (error instanceof CreateFlowCancelledError) {
      cancel(error.message);
      return 130;
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'commander.helpDisplayed'
    ) {
      return 0;
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'commander.version'
    ) {
      return 0;
    }

    const message = error instanceof Error ? error.message : String(error);
    output.error(message);
    return 1;
  }
}
