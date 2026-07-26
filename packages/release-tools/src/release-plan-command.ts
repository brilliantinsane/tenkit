import { planReleaseSetFromRepository } from './plan-release-set-from-repository';
import type { ReleaseChannel } from './release-plan';

type RunReleasePlanCommandInput = {
  args: readonly string[];
  workspaceRoot: string;
  write(message: string): void;
};

type ReleasePlanCommandOptions = {
  channel: ReleaseChannel;
  sourceRevision: string;
};

const USAGE = 'Usage: pnpm release:plan -- --channel <stable|rc> [--source <git-revision>]';

function parseOptions(args: readonly string[]): ReleasePlanCommandOptions {
  const commandArgs = args[0] === '--' ? args.slice(1) : args;
  let channel: ReleaseChannel | undefined;
  let sourceRevision = 'HEAD';
  let sourceSpecified = false;

  for (let index = 0; index < commandArgs.length; index += 2) {
    const name = commandArgs[index];
    const value = commandArgs[index + 1];

    if (name === '--channel' && (value === 'stable' || value === 'rc') && !channel) {
      channel = value;
      continue;
    }

    if (name === '--source' && value && !sourceSpecified) {
      sourceRevision = value;
      sourceSpecified = true;
      continue;
    }

    throw new Error(USAGE);
  }

  if (!channel) {
    throw new Error(USAGE);
  }

  return { channel, sourceRevision };
}

export async function runReleasePlanCommand(input: RunReleasePlanCommandInput): Promise<number> {
  const options = parseOptions(input.args);
  const plan = await planReleaseSetFromRepository({
    channel: options.channel,
    workspaceRoot: input.workspaceRoot,
    sourceRevision: options.sourceRevision,
  });

  input.write(`${JSON.stringify(plan, null, 2)}\n`);
  return 0;
}
