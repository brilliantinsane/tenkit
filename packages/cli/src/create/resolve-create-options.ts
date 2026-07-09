import fs from 'fs-extra';
import { resolve } from 'pathe';
import { normalizeGeneratedSetupType, type GeneratedSetupType } from '@tenkit/template-generator';

import {
  DEFAULT_PROJECT_NAME,
  DEFAULT_PUBLIC_SETUP_SLUG,
  DEFAULT_STYLING_CHOICE,
  PROMPT_CANCELLED,
  SETUP_PROMPT_CHOICES,
  STYLING_PROMPT_CHOICES,
} from '../constants';
import { CreateFlowCancelledError } from '../errors';
import {
  derivePackageName,
  normalizeAccentInput,
  normalizeSetupInput,
  normalizeStylingInput,
  parseGitMode,
  validatePackageName,
  validateProjectName,
} from './validation';
import { resolvePackageManager } from './package-manager';
import type { CreateCommandOptions, CreateFlowEnvironment, ResolvedCreateOptions } from './types';

async function readProjectName(
  options: CreateCommandOptions,
  env: CreateFlowEnvironment,
): Promise<string> {
  if (options.name !== undefined) {
    return validateProjectName(options.name);
  }

  if (options.yes) {
    return DEFAULT_PROJECT_NAME;
  }

  if (!env.isInteractive) {
    throw new Error('Missing --name. Pass --name or use --yes to accept the default.');
  }

  const answer = await env.prompts.text({
    message: 'Project name',
    placeholder: DEFAULT_PROJECT_NAME,
    defaultValue: DEFAULT_PROJECT_NAME,
    validate(value) {
      try {
        validateProjectName(value ?? '');
        return undefined;
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    },
  });

  if (answer === PROMPT_CANCELLED) {
    throw new CreateFlowCancelledError();
  }

  return validateProjectName(answer);
}

async function readStylingChoice(options: CreateCommandOptions, env: CreateFlowEnvironment) {
  if (options.styling !== undefined) {
    return normalizeStylingInput(options.styling);
  }

  if (options.yes || !env.isInteractive) {
    return DEFAULT_STYLING_CHOICE;
  }

  const answer = await env.prompts.select({
    message: 'Styling Choice',
    initialValue: DEFAULT_STYLING_CHOICE,
    options: STYLING_PROMPT_CHOICES,
  });

  if (answer === PROMPT_CANCELLED) {
    throw new CreateFlowCancelledError();
  }

  return normalizeStylingInput(answer);
}

async function readSetupType(
  options: CreateCommandOptions,
  env: CreateFlowEnvironment,
): Promise<GeneratedSetupType> {
  if (options.setup !== undefined || options.setupType !== undefined) {
    return normalizeSetupInput(options.setup, options.setupType);
  }

  if (options.yes) {
    return normalizeGeneratedSetupType(DEFAULT_PUBLIC_SETUP_SLUG);
  }

  if (!env.isInteractive) {
    throw new Error('Missing --setup. Pass --setup or use --yes to accept the default.');
  }

  const answer = await env.prompts.select({
    message: 'Setup Type',
    initialValue: DEFAULT_PUBLIC_SETUP_SLUG,
    options: SETUP_PROMPT_CHOICES,
  });

  if (answer === PROMPT_CANCELLED) {
    throw new CreateFlowCancelledError();
  }

  return normalizeGeneratedSetupType(answer);
}

async function assertTargetIsSafe(targetDir: string): Promise<void> {
  if (!(await fs.pathExists(targetDir))) {
    return;
  }

  const stats = await fs.stat(targetDir);

  if (!stats.isDirectory()) {
    throw new Error(`Generated project target ${targetDir} exists but is not a directory.`);
  }

  const entries = await fs.readdir(targetDir);

  if (entries.length > 0) {
    throw new Error(`Generated project target ${targetDir} already exists and is not empty.`);
  }
}

export async function resolveCreateOptions(
  options: CreateCommandOptions,
  env: CreateFlowEnvironment,
): Promise<ResolvedCreateOptions> {
  const projectName = await readProjectName(options, env);
  const setupType = await readSetupType(options, env);
  const stylingChoice = await readStylingChoice(options, env);
  const accent = normalizeAccentInput(options.accent);
  const packageName =
    options.packageName !== undefined
      ? validatePackageName(options.packageName)
      : derivePackageName(projectName);
  const packageManager = resolvePackageManager({
    packageManager: options.packageManager,
    userAgent: env.packageManagerUserAgent,
  });
  const targetDir = resolve(env.cwd, projectName);

  await assertTargetIsSafe(targetDir);

  return {
    projectName,
    packageName,
    setupType,
    stylingChoice,
    accent,
    targetDir,
    packageManager,
    install: options.install !== false,
    git: parseGitMode(options.git),
    dryRun: options.dryRun === true,
  };
}
