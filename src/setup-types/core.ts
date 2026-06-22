import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { Android, IOS } from '@expo/config-types';
import { ExpoConfig } from 'expo/config';

export const SETUP_TYPES = [
  'white-label-apps',
  'single-app-runtime-tenants',
  'generic-with-standalone-app-variants',
] as const;

export type SetupType = (typeof SETUP_TYPES)[number];
export type AppVariantId = number;
export type RuntimeTenantId = number;
export type AppVariantEnvironment = 'development' | 'preview' | 'production';

export type AppVariantTheme = {
  accent: string;
};

export type AppVariantEasProject = {
  projectId: string;
};

export type RuntimeTenantAccess = {
  selectionMode: 'selectable';
  defaultRuntimeTenantId: RuntimeTenantId;
  allowedRuntimeTenantIds: readonly RuntimeTenantId[];
};

export type AppVariant = {
  appVariantId: AppVariantId;
  slug: string;
  name: ExpoConfig['name'];
  version: ExpoConfig['version'];
  scheme: string;
  bundleIdentifier: IOS['bundleIdentifier'];
  packageName: Android['package'];
  theme: AppVariantTheme;
  eas: AppVariantEasProject;
  runtimeTenantAccess?: RuntimeTenantAccess;
};

export type AppVariantWithRuntimeTenantAccess = AppVariant & {
  runtimeTenantAccess: RuntimeTenantAccess;
};

export type GenericAppVariant = AppVariantWithRuntimeTenantAccess & {
  role: 'generic';
};

export type StandaloneAppVariant = AppVariant & {
  role: 'standalone';
  standaloneRuntimeTenantId: RuntimeTenantId;
  runtimeTenantAccess?: never;
};

export type GenericAppSetupVariant = GenericAppVariant | StandaloneAppVariant;

export type WhiteLabelAppsSetup = {
  setupType: 'white-label-apps';
  appVariants: readonly AppVariant[];
  defaultAppVariantId?: AppVariantId;
};

export type SingleAppRuntimeTenantsSetup = {
  setupType: 'single-app-runtime-tenants';
  appVariant: AppVariantWithRuntimeTenantAccess;
};

export type GenericAppSetup = {
  setupType: 'generic-with-standalone-app-variants';
  appVariants: readonly GenericAppSetupVariant[];
};

export type ActiveSetup = WhiteLabelAppsSetup | SingleAppRuntimeTenantsSetup | GenericAppSetup;

export type ActiveSetupBootstrap = {
  setupType: SetupType;
  appVariant: {
    id: AppVariantId;
    slug: string;
  };
  theme: AppVariantTheme;
  runtimeTenantAccess?: RuntimeTenantAccess;
  standaloneRuntimeTenantId?: RuntimeTenantId;
};

export type ResolvedAppVariantConfig = AppVariant & {
  activeSetup: ActiveSetup;
  extra: {
    eas: {
      projectId: string;
    };
    activeSetup: ActiveSetupBootstrap;
  };
};

type ResolveAppVariantInput = {
  activeSetup: ActiveSetup;
  slug?: unknown;
  projectRoot?: string;
};

function fail(message: string): never {
  throw new Error(message);
}

function assertNonEmptyString(value: unknown, label: string) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${label} must be a non-empty string`);
  }
}

function assertPositiveInteger(value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    fail(`${label} must be a positive integer`);
  }
}

function findDuplicate<TValue>(values: readonly TValue[]): TValue | undefined {
  const seen = new Set<TValue>();

  for (const value of values) {
    if (seen.has(value)) {
      return value;
    }

    seen.add(value);
  }
}

function validateRuntimeTenantAccess(appVariant: AppVariant) {
  const access = appVariant.runtimeTenantAccess;

  if (!access) {
    return;
  }

  if (!access.allowedRuntimeTenantIds.includes(access.defaultRuntimeTenantId)) {
    fail(
      `Default Runtime Tenant ID "${access.defaultRuntimeTenantId}" must be included in allowed Runtime Tenant IDs: ${access.allowedRuntimeTenantIds.join(', ')}`,
    );
  }
}

function validateAppVariant(appVariant: AppVariant) {
  assertPositiveInteger(appVariant.appVariantId, 'App Variant ID');
  assertNonEmptyString(appVariant.slug, 'Slug');
  assertNonEmptyString(appVariant.name, 'App Variant name');
  assertNonEmptyString(appVariant.version, 'App Variant version');
  assertNonEmptyString(appVariant.scheme, 'App Variant scheme');
  assertNonEmptyString(appVariant.bundleIdentifier, 'iOS bundle identifier');
  assertNonEmptyString(appVariant.packageName, 'Android package name');
  assertNonEmptyString(appVariant.theme?.accent, 'App Variant theme accent');
  validateRuntimeTenantAccess(appVariant);
}

function validateWhiteLabelAppsSetup(activeSetup: WhiteLabelAppsSetup) {
  if (!Array.isArray(activeSetup.appVariants) || activeSetup.appVariants.length === 0) {
    fail('Active Setup must include at least one App Variant');
  }

  for (const appVariant of activeSetup.appVariants) {
    validateAppVariant(appVariant);
  }

  const duplicateAppVariantId = findDuplicate(
    activeSetup.appVariants.map((appVariant) => appVariant.appVariantId),
  );

  if (duplicateAppVariantId) {
    fail(`Duplicate App Variant ID "${duplicateAppVariantId}" in Active Setup Manifest`);
  }

  const duplicateSlug = findDuplicate(activeSetup.appVariants.map((appVariant) => appVariant.slug));

  if (duplicateSlug) {
    fail(`Duplicate Slug "${duplicateSlug}" in Active Setup Manifest`);
  }

  if (
    activeSetup.defaultAppVariantId !== undefined &&
    !activeSetup.appVariants.some(
      (appVariant) => appVariant.appVariantId === activeSetup.defaultAppVariantId,
    )
  ) {
    fail(
      `Default App Variant ID "${activeSetup.defaultAppVariantId}" does not exist in Active Setup Manifest`,
    );
  }
}

function validateSingleAppRuntimeTenantsSetup(activeSetup: SingleAppRuntimeTenantsSetup) {
  validateAppVariant(activeSetup.appVariant);
}

function validateGenericAppSetup(activeSetup: GenericAppSetup) {
  if (!Array.isArray(activeSetup.appVariants) || activeSetup.appVariants.length === 0) {
    fail('Generic App Setup must include at least one App Variant');
  }

  for (const appVariant of activeSetup.appVariants) {
    validateAppVariant(appVariant);

    if (appVariant.role === 'generic') {
      if (!appVariant.runtimeTenantAccess) {
        fail('Generic App Variant must declare selectable Runtime Tenant Access');
      }
    } else if (appVariant.role === 'standalone') {
      assertPositiveInteger(
        appVariant.standaloneRuntimeTenantId,
        'Standalone App Variant Runtime Tenant ID',
      );

      if (appVariant.runtimeTenantAccess) {
        fail('Standalone App Variants must use a direct Runtime Tenant ID');
      }
    } else {
      fail(`Invalid App Variant role ${JSON.stringify(appVariant.role)}`);
    }
  }

  const genericAppVariants = activeSetup.appVariants.filter(
    (appVariant): appVariant is GenericAppVariant => appVariant.role === 'generic',
  );

  if (genericAppVariants.length !== 1) {
    fail(
      `Generic App Setup must include exactly one Generic App Variant, found ${genericAppVariants.length}`,
    );
  }

  const duplicateAppVariantId = findDuplicate(
    activeSetup.appVariants.map((appVariant) => appVariant.appVariantId),
  );

  if (duplicateAppVariantId) {
    fail(`Duplicate App Variant ID "${duplicateAppVariantId}" in Active Setup Manifest`);
  }

  const duplicateSlug = findDuplicate(activeSetup.appVariants.map((appVariant) => appVariant.slug));

  if (duplicateSlug) {
    fail(`Duplicate Slug "${duplicateSlug}" in Active Setup Manifest`);
  }

  const standaloneRuntimeTenantIds = activeSetup.appVariants
    .filter((appVariant): appVariant is StandaloneAppVariant => appVariant.role === 'standalone')
    .map((appVariant) => appVariant.standaloneRuntimeTenantId);
  const duplicateStandaloneRuntimeTenantId = findDuplicate(standaloneRuntimeTenantIds);

  if (duplicateStandaloneRuntimeTenantId) {
    fail(
      `Duplicate standalone Runtime Tenant assignment "${duplicateStandaloneRuntimeTenantId}" in Active Setup Manifest`,
    );
  }

  const genericAllowedRuntimeTenantIds =
    genericAppVariants[0]?.runtimeTenantAccess.allowedRuntimeTenantIds ?? [];
  const standaloneRuntimeTenantInGenericAccess = standaloneRuntimeTenantIds.find(
    (runtimeTenantId) => genericAllowedRuntimeTenantIds.includes(runtimeTenantId),
  );

  if (standaloneRuntimeTenantInGenericAccess !== undefined) {
    fail(
      `Standalone Runtime Tenant ID "${standaloneRuntimeTenantInGenericAccess}" must not appear in Generic App Variant Runtime Tenant Access`,
    );
  }
}

export function defineActiveSetup<TActiveSetup extends ActiveSetup>(
  activeSetup: TActiveSetup,
): TActiveSetup {
  if (!SETUP_TYPES.includes(activeSetup.setupType)) {
    fail(
      `Invalid Setup Type ${JSON.stringify(activeSetup.setupType)}. Expected one of: ${SETUP_TYPES.join(', ')}`,
    );
  }

  if (activeSetup.setupType === 'single-app-runtime-tenants') {
    validateSingleAppRuntimeTenantsSetup(activeSetup);
  } else if (activeSetup.setupType === 'generic-with-standalone-app-variants') {
    validateGenericAppSetup(activeSetup);
  } else {
    validateWhiteLabelAppsSetup(activeSetup);
  }

  return activeSetup;
}

export function getAppVariants(activeSetup: ActiveSetup): readonly AppVariant[] {
  if (activeSetup.setupType === 'single-app-runtime-tenants') {
    return [activeSetup.appVariant];
  }

  return activeSetup.appVariants;
}

export function getDefaultAppVariant(activeSetup: ActiveSetup): AppVariant {
  if (activeSetup.setupType === 'single-app-runtime-tenants') {
    return activeSetup.appVariant;
  }

  if (activeSetup.setupType === 'generic-with-standalone-app-variants') {
    const genericAppVariant = activeSetup.appVariants.find(
      (appVariant) => appVariant.role === 'generic',
    );

    if (!genericAppVariant) {
      fail('Generic App Setup has no Generic App Variant');
    }

    return genericAppVariant;
  }

  const defaultAppVariantId =
    activeSetup.defaultAppVariantId ?? activeSetup.appVariants[0]?.appVariantId;
  const appVariant = activeSetup.appVariants.find(
    (candidate) => candidate.appVariantId === defaultAppVariantId,
  );

  if (!appVariant) {
    fail('Active Setup Manifest has no default App Variant');
  }

  return appVariant;
}

export function getRequiredAppVariantAssetPaths(appVariant: AppVariant): string[] {
  const assetPath = `assets/${appVariant.slug}`;
  const icons = `${assetPath}/icons`;
  const iosIcon = `${assetPath}/app.icon`;

  return [
    `${icons}/icon.png`,
    `${icons}/android-icon-foreground.png`,
    `${icons}/android-icon-background.png`,
    `${icons}/android-icon-monochrome.png`,
    `${icons}/splash-icon.png`,
    `${iosIcon}/icon.json`,
  ];
}

function validateAppVariantAssets(appVariant: AppVariant, projectRoot: string) {
  for (const assetPath of getRequiredAppVariantAssetPaths(appVariant)) {
    if (!existsSync(join(projectRoot, assetPath))) {
      fail(`Missing required App Variant asset "${assetPath}" for Slug "${appVariant.slug}"`);
    }
  }
}

function hasStandaloneRuntimeTenantId(
  appVariant: AppVariant,
): appVariant is AppVariant & { standaloneRuntimeTenantId: RuntimeTenantId } {
  return (
    'standaloneRuntimeTenantId' in appVariant &&
    typeof appVariant.standaloneRuntimeTenantId === 'number'
  );
}

export function resolveAppVariantConfig({
  activeSetup,
  slug,
  projectRoot = process.cwd(),
}: ResolveAppVariantInput): ResolvedAppVariantConfig {
  const appVariants = getAppVariants(activeSetup);
  const selectedSlug = slug === undefined ? getDefaultAppVariant(activeSetup).slug : slug;

  if (typeof selectedSlug !== 'string') {
    fail(
      `Invalid Slug ${JSON.stringify(selectedSlug)}. Expected one of: ${appVariants
        .map((appVariant) => appVariant.slug)
        .join(', ')}`,
    );
  }

  const appVariant = appVariants.find((candidate) => candidate.slug === selectedSlug);

  if (!appVariant) {
    fail(
      `Invalid Slug ${JSON.stringify(selectedSlug)}. Expected one of: ${appVariants
        .map((candidate) => candidate.slug)
        .join(', ')}`,
    );
  }

  validateAppVariantAssets(appVariant, projectRoot);

  const activeSetupBootstrap: ActiveSetupBootstrap = {
    setupType: activeSetup.setupType,
    appVariant: {
      id: appVariant.appVariantId,
      slug: appVariant.slug,
    },
    theme: appVariant.theme,
    ...(appVariant.runtimeTenantAccess
      ? { runtimeTenantAccess: appVariant.runtimeTenantAccess }
      : {}),
    ...(hasStandaloneRuntimeTenantId(appVariant)
      ? { standaloneRuntimeTenantId: appVariant.standaloneRuntimeTenantId }
      : {}),
  };

  return {
    ...appVariant,
    activeSetup,
    extra: {
      eas: {
        projectId: appVariant.eas.projectId,
      },
      activeSetup: activeSetupBootstrap,
    },
  };
}
