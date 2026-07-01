import type { CreateFlowOutput, CreateFlowResult } from './types';

export function logFinalOutput(result: CreateFlowResult, output: CreateFlowOutput): void {
  const projectShellArg = formatShellArg(result.projectName);

  output.log('');
  output.log(
    result.status === 'dry-run' ? 'Tenkit create plan is valid.' : 'Your Tenkit project is ready.',
  );
  output.log('');
  output.log('Next steps:');
  output.log(`- cd ${projectShellArg}`);

  if (result.installFailed || !result.installed) {
    output.log('- pnpm install');
  }

  output.log('- pnpm run android');
  output.log('- pnpm run ios');
  output.log('- pnpm run web');

  if (result.installFailed) {
    output.log('');
    output.log('Dependency installation failed. Run pnpm install in the generated project.');
  }

  if (result.gitSkippedReason === 'git-unavailable') {
    output.log('');
    output.log('Git was not available. Run git init when ready.');
  } else if (result.gitSkippedReason === 'nested-worktree') {
    output.log('');
    output.log(
      'Git initialization was skipped because the project is inside an existing git worktree.',
    );
  } else if (result.gitFailed) {
    output.log('');
    output.log(
      'Git setup did not complete. Run git init, git add --all, and git commit -m "Initial commit" when ready.',
    );
  }
}

function formatShellArg(value: string): string {
  if (/^[A-Za-z0-9._/-]+$/.test(value)) {
    return value;
  }

  return `'${value.replace(/'/g, `'\\''`)}'`;
}
