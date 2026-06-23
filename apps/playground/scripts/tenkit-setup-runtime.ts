import { confirm, select } from '@inquirer/prompts';
import { spawnSync } from 'node:child_process';

import { activeSetup } from '../src/active-setup/manifest';
import { type SetupType } from '../src/setup-types/core';
import {
  applySetupPlan,
  formatSetupFilePlan,
  getImplementedSetupTypes,
  planSetup,
  type SetupFlags,
} from './tenkit-setup-core';

export type SetupRuntimeDeps = {
  ci: boolean;
  activeSetupType?: SetupType;
  projectRoot: string;
  promptSelect: (input: {
    message: string;
    choices: { name: string; value: string }[];
  }) => Promise<string>;
  promptConfirm: (input: { message: string; defaultValue?: boolean }) => Promise<boolean>;
  log: (message: string) => void;
  formatFiles: (paths: string[]) => void;
};

export function createSetupRuntimeDeps(): SetupRuntimeDeps {
  return {
    ci: process.env.CI === 'true',
    activeSetupType: activeSetup.setupType,
    projectRoot: process.cwd(),
    promptSelect: ({ message, choices }) => select({ message, choices, pageSize: 20 }),
    promptConfirm: ({ message, defaultValue }) => confirm({ message, default: defaultValue }),
    log: console.log,
    formatFiles: (paths) => {
      if (paths.length === 0) {
        return;
      }

      const result = spawnSync('pnpm', ['exec', 'prettier', '--write', ...paths], {
        stdio: 'inherit',
      });

      if (result.error) {
        throw result.error;
      }

      if (result.status !== 0) {
        throw new Error('Failed to format setup output.');
      }
    },
  };
}

function changedFilePaths(plan: ReturnType<typeof planSetup>) {
  return plan.operations
    .filter((operation) => operation.kind === 'write' || operation.kind === 'copy')
    .map((operation) => operation.path);
}

async function resolveSetupType(flags: SetupFlags, deps: SetupRuntimeDeps): Promise<string> {
  if (flags.setupType) {
    return flags.setupType;
  }

  if (deps.ci) {
    throw new Error('Non-interactive setup requires --setup-type and --yes.');
  }

  return deps.promptSelect({
    message: 'Select a Setup Type:',
    choices: getImplementedSetupTypes().map((setupType) => ({
      name: setupType === deps.activeSetupType ? `${setupType} (current)` : setupType,
      value: setupType,
    })),
  });
}

export async function runSetup(flags: SetupFlags, deps = createSetupRuntimeDeps()) {
  if (deps.ci && (!flags.setupType || !flags.yes)) {
    throw new Error('Non-interactive setup requires --setup-type and --yes.');
  }

  const setupType = await resolveSetupType(flags, deps);
  const plan = planSetup(setupType);
  const formattedPlan = formatSetupFilePlan(plan);
  let confirmedInteractively = false;

  deps.log(`Setup Type: ${plan.setupType}`);
  deps.log('Active Setup changes:');

  for (const line of formattedPlan) {
    deps.log(`- ${line}`);
  }

  if (flags.dryRun) {
    return applySetupPlan({
      plan,
      projectRoot: deps.projectRoot,
      force: flags.force,
      dryRun: true,
    });
  }

  if (!flags.yes) {
    const confirmed = await deps.promptConfirm({
      message: 'Apply these Active Setup changes?',
      defaultValue: true,
    });

    if (!confirmed) {
      throw new Error('Setup cancelled.');
    }

    confirmedInteractively = true;
  }

  const result = applySetupPlan({
    plan,
    projectRoot: deps.projectRoot,
    force: flags.force || confirmedInteractively,
  });

  if (result.blockedTargets.length > 0) {
    throw new Error(
      `Setup target paths already exist or have local changes: ${result.blockedTargets.join(', ')}. Re-run interactively or use --force to replace them explicitly.`,
    );
  }

  deps.formatFiles(changedFilePaths(plan));
  deps.log('Setup applied.');

  return result;
}
