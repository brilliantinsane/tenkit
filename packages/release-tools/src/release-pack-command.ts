import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

import {
  packReleaseSet as defaultPackReleaseSet,
  type PackReleaseSetInput,
  type PackReleaseSetResult,
} from './pack-release-set';
import { parseReleaseSetPlan } from './release-plan';

type RunReleasePackCommandInput = {
  args: readonly string[];
  repositoryRoot: string;
  cwd?: string;
  write(message: string): void;
  packReleaseSet?(input: PackReleaseSetInput): Promise<PackReleaseSetResult>;
};

function parseArguments(args: readonly string[]): { planPath: string; outputRoot: string } {
  const commandArgs = args[0] === '--' ? args.slice(1) : args;

  if (
    commandArgs.length !== 4 ||
    commandArgs[0] !== '--plan' ||
    !commandArgs[1] ||
    commandArgs[2] !== '--output' ||
    !commandArgs[3]
  ) {
    throw new Error('Usage: pnpm release:pack -- --plan <plan.json> --output <new-directory>');
  }

  return {
    planPath: commandArgs[1],
    outputRoot: commandArgs[3],
  };
}

export async function runReleasePackCommand(input: RunReleasePackCommandInput): Promise<number> {
  const args = parseArguments(input.args);
  const cwd = input.cwd ?? process.cwd();
  let planContents: string;

  try {
    planContents = await readFile(resolve(cwd, args.planPath), 'utf8');
  } catch (error) {
    throw new Error('Unable to read the approved Release Set plan.', { cause: error });
  }

  let planValue: unknown;

  try {
    planValue = JSON.parse(planContents);
  } catch (error) {
    throw new Error('Approved Release Set plan must contain valid JSON.', { cause: error });
  }

  const plan = parseReleaseSetPlan(planValue);

  if (plan.kind === 'no-release') {
    throw new Error(
      `Plan for source ${plan.sourceSha} does not approve a Release Set and cannot be packed.`,
    );
  }

  const pack = input.packReleaseSet ?? defaultPackReleaseSet;
  const result = await pack({
    repositoryRoot: input.repositoryRoot,
    outputRoot: resolve(cwd, args.outputRoot),
    plan,
  });

  input.write(
    `Packed ${result.artifactPaths.length} verified package artifacts from ${plan.sourceSha}.\nManifest: ${relative(cwd, result.manifestPath)}\n`,
  );
  return 0;
}
