import { isGeneratedNodeBackend } from '@tenkit/types/generated-app-option-definitions';

import type { CreateFlowOutput, CreateFlowResult, ResolvedCreateOptions } from './types';
import { formatInstallCommand, formatRunCommand } from './package-manager';

export function logCreateSummary(options: ResolvedCreateOptions, output: CreateFlowOutput): void {
  output.log('Configuration:');
  output.log(`- Project: ${options.projectName}`);
  output.log(`- Setup Type: ${options.setupType}`);
  output.log(`- App Variants: ${options.appVariantNames.join(', ')}`);
  output.log(`- Backend: ${options.generatedAppOptions.backend}`);
  output.log(`- Auth: ${options.generatedAppOptions.auth}`);
  output.log(
    `- Database: ${options.generatedAppOptions.backend === 'convex' ? 'Convex-managed' : options.generatedAppOptions.database}`,
  );
  output.log(
    `- ORM: ${options.generatedAppOptions.backend === 'convex' ? 'not applicable' : options.generatedAppOptions.orm}`,
  );
  output.log(`- Styling: ${options.stylingChoice}`);
  output.log(`- Package Manager: ${options.packageManager}`);
  output.log(`- Git: ${options.git ? 'initialize' : 'skip'}`);
  output.log(`- Install: ${options.install ? 'install dependencies' : 'skip'}`);
  output.log('');
}

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

  if (isGeneratedNodeBackend(result.generatedAppOptions.backend)) {
    output.log('- cp .env.example .env.local');
    output.log('- cp apps/server/.env.example apps/server/.env.local');
    if (result.generatedAppOptions.auth === 'clerk') {
      output.log('- Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in .env.local');
      output.log('- Set CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in apps/server/.env.local');
    }
    output.log('- Set EXPO_PUBLIC_API_URL in .env.local to a Backend URL reachable by your target');
    output.log(`- ${formatRunCommand(result.packageManager, 'dev')}`);
  } else if (result.generatedAppOptions.backend === 'convex') {
    output.log('- cp .env.example .env.local');
    output.log('- cp apps/server/.env.example apps/server/.env.local');
    output.log(`- ${formatRunCommand(result.packageManager, 'convex:sync')}`);
    output.log('- Set EXPO_PUBLIC_CONVEX_URL in .env.local to the synced deployment HTTPS URL');
    output.log(`- ${formatRunCommand(result.packageManager, 'convex:seed')}`);
    output.log(`- ${formatRunCommand(result.packageManager, 'dev')}`);
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
