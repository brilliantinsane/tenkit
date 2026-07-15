import type { RunCommand } from '../create/types';

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
  enabled,
  runCommand,
  targetDir,
}: {
  enabled: boolean;
  runCommand: RunCommand;
  targetDir: string;
}): Promise<{ enabled: boolean; skippedReason?: string }> {
  if (!enabled) {
    return { enabled: false, skippedReason: 'disabled' };
  }

  if (!(await isGitAvailable(runCommand, targetDir))) {
    return { enabled: false, skippedReason: 'git-unavailable' };
  }

  const insideGitWorktree = await isInsideGitWorktree(runCommand, targetDir);

  if (insideGitWorktree) {
    return { enabled: false, skippedReason: 'nested-worktree' };
  }

  return { enabled: true };
}

export async function prepareInitialGitSetup({
  enabled,
  runCommand,
  probeDir,
}: {
  enabled: boolean;
  runCommand: RunCommand;
  probeDir: string;
}): Promise<InitialGitSetup> {
  const gitPlan = await resolveGitMode({
    enabled,
    runCommand,
    targetDir: probeDir,
  });

  return {
    async run(targetDir) {
      if (!gitPlan.enabled) {
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
