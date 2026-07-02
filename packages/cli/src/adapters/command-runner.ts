import { spawn } from 'node:child_process';

import type { CommandResult, RunCommandOptions } from '../create/types';

export function defaultRunCommand(
  command: string,
  args: readonly string[],
  cwd: string,
  options: RunCommandOptions = {},
): Promise<CommandResult> {
  return new Promise((resolveCommand) => {
    const stdio = options.stdio ?? 'inherit';
    const child = spawn(command, [...args], {
      cwd,
      stdio,
    });
    let stdout = '';

    if (stdio === 'pipe') {
      child.stdout?.setEncoding('utf8');
      child.stdout?.on('data', (chunk: string) => {
        stdout += chunk;
      });
    }

    child.on('error', () => {
      resolveCommand({ ok: false, code: 1 });
    });
    child.on('close', (code) => {
      resolveCommand({ ok: code === 0, code: code ?? 1, stdout });
    });
  });
}
