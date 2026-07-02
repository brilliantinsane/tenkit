import { PROMPT_CANCELLED } from '../constants';
import { CreateFlowCancelledError } from '../errors';
import type { CreateFlowEnvironment, PublicCliGitMode, RunCommand } from '../create/types';

async function isGitAvailable(runCommand: RunCommand, cwd: string): Promise<boolean> {
  return (await runCommand('git', ['--version'], cwd, { stdio: 'ignore' })).ok;
}

async function isInsideGitWorktree(runCommand: RunCommand, cwd: string): Promise<boolean> {
  return (await runCommand('git', ['rev-parse', '--is-inside-work-tree'], cwd, { stdio: 'ignore' }))
    .ok;
}

export type InitialGitSetupResult = {
  gitInitialized: boolean;
  gitCommitted: boolean;
  gitSkippedReason?: string;
  gitFailed: boolean;
};

export type InitialGitSetup = {
  run(targetDir: string): Promise<InitialGitSetupResult>;
};

async function resolveGitMode({
  explicitGitMode,
  env,
  runCommand,
  targetDir,
}: {
  explicitGitMode: PublicCliGitMode | undefined;
  env: CreateFlowEnvironment;
  runCommand: RunCommand;
  targetDir: string;
}): Promise<{ mode: false | 'init' | 'commit'; skippedReason?: string }> {
  if (explicitGitMode === false || explicitGitMode === 'none') {
    return { mode: false, skippedReason: 'disabled' };
  }

  if (!(await isGitAvailable(runCommand, targetDir))) {
    return { mode: false, skippedReason: 'git-unavailable' };
  }

  const insideGitWorktree = await isInsideGitWorktree(runCommand, targetDir);

  if (insideGitWorktree && explicitGitMode === undefined) {
    if (!env.isInteractive || env.isCi) {
      return { mode: false, skippedReason: 'nested-worktree' };
    }

    const answer = await env.prompts.confirm({
      message: 'Initialize a nested git repository?',
      initialValue: false,
    });

    if (answer === PROMPT_CANCELLED) {
      throw new CreateFlowCancelledError();
    }

    if (!answer) {
      return { mode: false, skippedReason: 'nested-worktree' };
    }
  }

  if (explicitGitMode === 'init') {
    return { mode: 'init' };
  }

  return { mode: 'commit' };
}

export async function prepareInitialGitSetup({
  explicitGitMode,
  env,
  runCommand,
  probeDir,
}: {
  explicitGitMode: PublicCliGitMode | undefined;
  env: CreateFlowEnvironment;
  runCommand: RunCommand;
  probeDir: string;
}): Promise<InitialGitSetup> {
  const gitPlan = await resolveGitMode({
    explicitGitMode,
    env,
    runCommand,
    targetDir: probeDir,
  });

  return {
    async run(targetDir) {
      if (!gitPlan.mode) {
        return {
          gitInitialized: false,
          gitCommitted: false,
          gitSkippedReason: gitPlan.skippedReason,
          gitFailed: false,
        };
      }

      const initResult = await runCommand('git', ['init'], targetDir, { stdio: 'ignore' });
      const gitInitialized = initResult.ok;

      if (!initResult.ok) {
        return {
          gitInitialized,
          gitCommitted: false,
          gitFailed: true,
        };
      }

      if (gitPlan.mode === 'init') {
        return {
          gitInitialized,
          gitCommitted: false,
          gitFailed: false,
        };
      }

      const addResult = await runCommand('git', ['add', '--all'], targetDir, { stdio: 'ignore' });
      const commitResult = addResult.ok
        ? await runCommand('git', ['commit', '-m', 'Initial commit'], targetDir, {
            stdio: 'ignore',
          })
        : { ok: false, code: 1 };

      return {
        gitInitialized,
        gitCommitted: commitResult.ok,
        gitFailed: !commitResult.ok,
      };
    },
  };
}
