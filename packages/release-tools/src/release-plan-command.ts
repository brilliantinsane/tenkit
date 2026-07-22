import { planReleaseSetFromRepository } from './plan-release-set-from-repository';

type RunReleasePlanCommandInput = {
  args: readonly string[];
  workspaceRoot: string;
  write(message: string): void;
};

function parseSourceRevision(args: readonly string[]): string {
  const commandArgs = args[0] === '--' ? args.slice(1) : args;

  if (commandArgs.length === 0) {
    return 'HEAD';
  }

  if (commandArgs.length === 2 && commandArgs[0] === '--source' && commandArgs[1]) {
    return commandArgs[1];
  }

  throw new Error('Usage: pnpm release:plan -- [--source <git-revision>]');
}

export async function runReleasePlanCommand(input: RunReleasePlanCommandInput): Promise<number> {
  const sourceRevision = parseSourceRevision(input.args);
  const plan = await planReleaseSetFromRepository({
    workspaceRoot: input.workspaceRoot,
    sourceRevision,
  });

  input.write(`${JSON.stringify(plan, null, 2)}\n`);
  return 0;
}
