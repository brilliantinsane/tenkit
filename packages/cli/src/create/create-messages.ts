import type { CreateFlowOutput, CreateFlowResult } from './types';
import { formatInstallCommand, formatRunCommand } from './package-manager';

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
    output.log(`- ${formatInstallCommand(result.packageManager)}`);
  }

  output.log(`- ${formatRunCommand(result.packageManager, 'android')}`);
  output.log(`- ${formatRunCommand(result.packageManager, 'ios')}`);
  output.log(`- ${formatRunCommand(result.packageManager, 'web')}`);

  if (result.installFailed) {
    output.log('');
    output.log(
      `Dependency installation failed. Run ${formatInstallCommand(result.packageManager)} in the generated project.`,
    );
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
