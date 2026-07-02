import { intro, outro } from '@clack/prompts';
import { Command } from 'commander';

import { CLI_VERSION, DEFAULT_PROJECT_NAME, supportedSetupValues } from '../constants';
import { runCreateFlow } from '../create/run-create';
import type { CreateCommandOptions, CreateFlowEnvironment } from '../create/types';
import { SUPPORTED_PACKAGE_MANAGERS } from '../create/package-manager';
import { parseGitMode } from '../create/validation';

type CommanderOptions = {
  name?: string;
  packageName?: string;
  setup?: string;
  setupType?: string;
  packageManager?: string;
  yes?: boolean;
  install?: boolean;
  git?: string | false;
  dryRun?: boolean;
};

function normalizeCommanderOptions(options: CommanderOptions): CreateCommandOptions {
  return {
    name: options.name,
    packageName: options.packageName,
    setup: options.setup,
    setupType: options.setupType,
    packageManager: options.packageManager,
    yes: options.yes,
    install: options.install,
    git: parseGitMode(options.git),
    dryRun: options.dryRun,
  };
}

export function createProgram(env: CreateFlowEnvironment): Command {
  const program = new Command();

  program
    .name('tenkit')
    .description('Create a generated Tenkit Expo project.')
    .version(CLI_VERSION)
    .allowExcessArguments(false)
    .option('--name <name>', `project folder name, defaults to ${DEFAULT_PROJECT_NAME} with --yes`)
    .option('--package-name <name>', 'generated package.json name override')
    .option('-s, --setup <setup>', `public Setup slug: ${supportedSetupValues().join(', ')}`)
    .option('--setup-type <setupType>', 'canonical Setup Type ID or public Setup slug')
    .option(
      '--package-manager <manager>',
      `install and generated command package manager: ${SUPPORTED_PACKAGE_MANAGERS.join(', ')}`,
    )
    .option('--yes', 'skip prompts and accept defaults')
    .option('--no-install', 'skip dependency installation')
    .option('--git <mode>', 'git behavior: init, commit, none')
    .option('--no-git', 'skip git initialization')
    .option('--dry-run', 'validate options and print the create plan without writing files')
    .configureOutput({
      writeOut: (message) => env.output.log(message.trimEnd()),
      writeErr: (message) => env.output.error(message.trimEnd()),
    })
    .exitOverride()
    .showHelpAfterError()
    .action(async (options: CommanderOptions) => {
      intro('Create Tenkit');
      await runCreateFlow(normalizeCommanderOptions(options), env);
      outro('Done');
    });

  return program;
}
