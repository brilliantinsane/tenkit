import fs from 'fs-extra';
import { resolve } from 'pathe';
import { normalizeGeneratedSetupType, type GeneratedSetupType } from '@tenkit/template-generator';
import { GENERATED_SETUP_TYPE_DEFINITIONS } from '@tenkit/template-generator/setup-type-definitions';

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
  normalizeAppVariantCustomization,
  normalizeAppVariantAccentInput,
  normalizeAppVariantNameInput,
  normalizeSetupInput,
  normalizeStylingInput,
  validatePackageName,
  validateProjectName,
} from './validation';
import {
  detectPackageManager,
  normalizePackageManagerInput,
  SUPPORTED_PACKAGE_MANAGERS,
  type PublicCliPackageManager,
} from './package-manager';
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

  const projectName = validateProjectName(answer);
  env.output.log(`Project folder/package: ${projectName}`);
  return projectName;
}

async function readAppVariantCustomization(
  setupType: GeneratedSetupType,
  options: CreateCommandOptions,
  env: CreateFlowEnvironment,
) {
  if (options.appVariantNamesInput !== undefined || options.appVariantAccentsInput !== undefined) {
    return normalizeAppVariantCustomization(
      setupType,
      options.appVariantNamesInput,
      options.appVariantAccentsInput,
    );
  }

  if (options.yes || !env.isInteractive) {
    return normalizeAppVariantCustomization(setupType, undefined, undefined);
  }

  const customize = await env.prompts.confirm({
    message: 'Customize App Variant names and Accent colors?',
    initialValue: false,
  });

  if (customize === PROMPT_CANCELLED) {
    throw new CreateFlowCancelledError();
  }

  if (!customize) {
    return normalizeAppVariantCustomization(setupType, undefined, undefined);
  }

  const definition = GENERATED_SETUP_TYPE_DEFINITIONS.find(
    (candidate) => candidate.setupType === setupType,
  );

  if (!definition) {
    throw new Error(`Missing Setup Type definition for ${JSON.stringify(setupType)}.`);
  }

  const appVariantNames: string[] = [];
  const appVariantAccents: string[] = [];

  for (const appVariant of definition.appVariants) {
    const name = await env.prompts.text({
      message: `App Variant name: ${appVariant.defaultName}`,
      placeholder: appVariant.defaultName,
      defaultValue: appVariant.defaultName,
      validate(value) {
        try {
          normalizeAppVariantNameInput(value ?? '');
          return undefined;
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      },
    });

    if (name === PROMPT_CANCELLED) {
      throw new CreateFlowCancelledError();
    }

    const accent = await env.prompts.text({
      message: `App Variant Accent: ${appVariant.defaultName}`,
      placeholder: appVariant.defaultAccent,
      defaultValue: appVariant.defaultAccent,
      validate(value) {
        try {
          normalizeAppVariantAccentInput(value ?? '');
          return undefined;
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      },
    });

    if (accent === PROMPT_CANCELLED) {
      throw new CreateFlowCancelledError();
    }

    appVariantNames.push(name);
    appVariantAccents.push(accent);
  }

  return normalizeAppVariantCustomization(
    setupType,
    appVariantNames.join(','),
    appVariantAccents.join(','),
  );
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

async function readPackageManager(
  options: CreateCommandOptions,
  env: CreateFlowEnvironment,
): Promise<PublicCliPackageManager> {
  const detectedPackageManager = detectPackageManager(env.packageManagerUserAgent);

  if (options.packageManager !== undefined) {
    const packageManager = normalizePackageManagerInput(options.packageManager);

    if (!packageManager) {
      throw new Error('Package manager is required.');
    }

    return packageManager;
  }

  if (options.yes || !env.isInteractive) {
    return detectedPackageManager;
  }

  const answer = await env.prompts.select({
    message: 'Package manager',
    initialValue: detectedPackageManager,
    options: SUPPORTED_PACKAGE_MANAGERS.map((packageManager) => ({
      value: packageManager,
      label: packageManager,
    })),
  });

  if (answer === PROMPT_CANCELLED) {
    throw new CreateFlowCancelledError();
  }

  return answer;
}

async function readEnabledChoice({
  explicitValue,
  message,
  options,
  env,
}: {
  explicitValue: boolean | undefined;
  message: string;
  options: CreateCommandOptions;
  env: CreateFlowEnvironment;
}): Promise<boolean> {
  if (explicitValue !== undefined) {
    return explicitValue;
  }

  if (options.yes || !env.isInteractive) {
    return true;
  }

  const answer = await env.prompts.confirm({ message, initialValue: true });

  if (answer === PROMPT_CANCELLED) {
    throw new CreateFlowCancelledError();
  }

  return answer;
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
  const { appVariantNames, appVariantAccents } = await readAppVariantCustomization(
    setupType,
    options,
    env,
  );
  const stylingChoice = await readStylingChoice(options, env);
  const packageName =
    options.packageName !== undefined
      ? validatePackageName(options.packageName)
      : derivePackageName(projectName);
  const packageManager = await readPackageManager(options, env);
  const git = await readEnabledChoice({
    explicitValue: options.git,
    message: 'Initialize Git?',
    options,
    env,
  });
  const install = await readEnabledChoice({
    explicitValue: options.install,
    message: 'Install dependencies?',
    options,
    env,
  });
  const targetDir = resolve(env.cwd, projectName);

  await assertTargetIsSafe(targetDir);

  return {
    projectName,
    packageName,
    setupType,
    stylingChoice,
    appVariantNames,
    appVariantAccents,
    targetDir,
    packageManager,
    install,
    git,
    dryRun: options.dryRun === true,
  };
}
