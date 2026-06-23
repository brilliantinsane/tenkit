import { EXPO_OWNER } from '../project-config';
import { activeSetup } from '../src/active-setup/manifest';
import {
  getDefaultAppVariant,
  getAppVariants,
  type ActiveSetup,
  type AppVariant,
  type AppVariantEnvironment,
} from '../src/setup-types/core';

export const EAS_CLI_MISSING_MESSAGE =
  'EAS CLI not found. Install it globally using the official EAS CLI installation instructions.';

export const APP_VARIANT_ENVIRONMENTS = ['development', 'preview', 'production'] as const;

export type BuildPlatform = 'ios' | 'android' | 'both';

export type CommandPlan = {
  bin: string;
  args: string[];
  env?: Record<string, string>;
};

export type BuildFlags = {
  slug?: string;
  env?: string;
  platform?: string;
  ios?: boolean;
  android?: boolean;
  both?: boolean;
};

export type BuildContext = {
  ci: boolean;
  expoToken?: string;
  expoOwner?: string;
  activeSetup?: ActiveSetup;
};

export type BuildPlan = {
  activeSetup: ActiveSetup;
  appVariant: AppVariant;
  environment: AppVariantEnvironment;
  platform: BuildPlatform;
  commands: CommandPlan[];
};

const DEFAULT_ENVIRONMENT: AppVariantEnvironment = 'development';

function fail(message: string): never {
  throw new Error(message);
}

function selectedPlatformFlags(flags: {
  platform?: string;
  ios?: boolean;
  android?: boolean;
  both?: boolean;
}): string[] {
  return [
    flags.platform ? `--platform ${flags.platform}` : undefined,
    flags.ios ? '--ios' : undefined,
    flags.android ? '--android' : undefined,
    flags.both ? '--both' : undefined,
  ].filter((flag): flag is string => Boolean(flag));
}

function resolveBuildPlatform(flags: BuildFlags): BuildPlatform {
  const selected = selectedPlatformFlags(flags);

  if (selected.length > 1) {
    fail('Choose only one platform option.');
  }

  const platform =
    flags.platform ??
    (flags.ios ? 'ios' : flags.android ? 'android' : flags.both ? 'both' : 'both');

  if (platform !== 'ios' && platform !== 'android' && platform !== 'both') {
    fail('Invalid platform. Expected one of: ios, android, both');
  }

  return platform;
}

function resolveAppVariantEnvironment(value: string = DEFAULT_ENVIRONMENT): AppVariantEnvironment {
  if (!APP_VARIANT_ENVIRONMENTS.includes(value as AppVariantEnvironment)) {
    fail(
      `Invalid App Variant Environment ${JSON.stringify(value)}. Expected one of: ${APP_VARIANT_ENVIRONMENTS.join(', ')}`,
    );
  }

  return value as AppVariantEnvironment;
}

function resolveAppVariant(activeSetupConfig: ActiveSetup, slug?: string): AppVariant {
  const appVariants = getAppVariants(activeSetupConfig);
  const selectedSlug = slug === undefined ? getDefaultAppVariant(activeSetupConfig).slug : slug;
  const appVariant = appVariants.find((candidate) => candidate.slug === selectedSlug);

  if (!appVariant) {
    fail(
      `Invalid Slug ${JSON.stringify(selectedSlug)}. Expected one of: ${appVariants
        .map((candidate) => candidate.slug)
        .join(', ')}`,
    );
  }

  return appVariant;
}

function getAppVariantEasProjectId(appVariant: AppVariant): string {
  return typeof appVariant.eas.projectId === 'string' ? appVariant.eas.projectId.trim() : '';
}

function assertAppVariantHasEasProjectId(appVariant: AppVariant) {
  if (getAppVariantEasProjectId(appVariant)) {
    return;
  }

  fail(
    `App Variant "${appVariant.name}" (${appVariant.appVariantId}) is missing an EAS Project ID. ` +
      `Create or find this App Variant's EAS Project in your Expo account, copy the EAS Project ID, ` +
      `and paste it into src/active-setup/manifest.ts for this App Variant. ` +
      `Optional helper: APP_VARIANT_SLUG=${appVariant.slug} eas init can create or discover the ID; ` +
      `if it prints the projectId and then fails because this app uses dynamic config, copy the printed ID.`,
  );
}

function assertExpoOwnerConfigured(expoOwner: string = EXPO_OWNER) {
  if (expoOwner.trim()) {
    return;
  }

  fail(
    'Missing Expo Owner. Set the global Expo Owner in project-config.ts to your Expo account or organization before Build Preparation.',
  );
}

function createEasEnvPullCommand(environment: AppVariantEnvironment, slug: string): CommandPlan {
  return {
    bin: 'eas',
    args: ['env:pull', '--environment', environment, '--path', '.env.local', '--non-interactive'],
    env: { APP_VARIANT_SLUG: slug },
  };
}

function createPrebuildCommand(platform: BuildPlatform, slug: string): CommandPlan {
  const args = ['expo', 'prebuild', '--clean'];

  if (platform !== 'both') {
    args.push('--platform', platform);
  }

  return {
    bin: 'pnpm',
    args,
    env: { APP_VARIANT_SLUG: slug },
  };
}

export function planBuild({
  flags,
  context,
}: {
  flags: BuildFlags;
  context: BuildContext;
}): BuildPlan {
  const activeSetupConfig = context.activeSetup ?? activeSetup;
  const needsAppVariantFlag = getAppVariants(activeSetupConfig).length > 1;

  if (
    context.ci &&
    ((needsAppVariantFlag && !flags.slug) ||
      !flags.env ||
      selectedPlatformFlags(flags).length === 0 ||
      !context.expoToken)
  ) {
    fail(
      'CI build preparation requires --slug when the Active Setup has multiple App Variants, --platform or platform shortcut, --env, and EXPO_TOKEN.',
    );
  }

  const appVariant = resolveAppVariant(activeSetupConfig, flags.slug);
  assertAppVariantHasEasProjectId(appVariant);
  assertExpoOwnerConfigured(context.expoOwner);

  const environment = resolveAppVariantEnvironment(flags.env);
  const platform = resolveBuildPlatform(flags);

  return {
    activeSetup: activeSetupConfig,
    appVariant,
    environment,
    platform,
    commands: [
      createEasEnvPullCommand(environment, appVariant.slug),
      createPrebuildCommand(platform, appVariant.slug),
    ],
  };
}

export function planReset(context: Omit<BuildContext, 'ci' | 'expoToken'> = {}): BuildPlan {
  const activeSetupConfig = context.activeSetup ?? activeSetup;
  const appVariant = getDefaultAppVariant(activeSetupConfig);

  return planBuild({
    flags: {
      slug: appVariant.slug,
      env: DEFAULT_ENVIRONMENT,
      platform: 'both',
    },
    context: {
      ci: false,
      expoToken: undefined,
      expoOwner: context.expoOwner,
      activeSetup: activeSetupConfig,
    },
  });
}
