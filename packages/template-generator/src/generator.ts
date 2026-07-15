import {
  formatSupportedGeneratedSetupTypes,
  normalizeGeneratedSetupType,
} from './generated-setup-types';
import { type GeneratedAccentColor, normalizeGeneratedAccentColor } from './generated-accent-color';
import {
  deriveAppVariantIdentities,
  getGeneratedSetupTypeDefinition,
  type GeneratedSetupTypeDefinition,
} from './generated-setup-type-definitions';
import {
  type GeneratedStylingChoice,
  normalizeGeneratedStylingChoice,
} from './generated-styling-choices';
import {
  GENERATED_PROJECT_PACKAGE_MANAGERS,
  readTemplateTree,
  type GeneratedProjectPackageManager,
  type TemplateAppVariantContext,
  type TemplateContext,
} from './template-reader';
import { mergeVirtualFileTrees, type VirtualFileTree } from './virtual-file-tree';

export {
  formatSupportedGeneratedSetupTypes,
  normalizeGeneratedSetupType,
  SUPPORTED_GENERATED_SETUP_TYPE_IDS,
  SUPPORTED_GENERATED_SETUP_TYPES,
  SUPPORTED_PUBLIC_SETUP_SLUGS,
  type GeneratedSetupType,
  type GeneratedSetupTypeInput,
  type PublicSetupSlug,
} from './generated-setup-types';
export { normalizeGeneratedAccentColor, type GeneratedAccentColor } from './generated-accent-color';
export {
  normalizeGeneratedStylingChoice,
  SUPPORTED_GENERATED_STYLING_CHOICES,
  type GeneratedStylingChoice,
} from './generated-styling-choices';
export { type GeneratedProjectPackageManager } from './template-reader';

export type WhiteLabelAppsProjectConfig = {
  setupType: 'white-label' | 'white-label-apps';
  appVariantAccents?: readonly (string | undefined)[];
  appVariantNames?: readonly (string | undefined)[];
  projectName?: string;
  packageName?: string;
  packageManager?: GeneratedProjectPackageManager;
  stylingChoice?: GeneratedStylingChoice;
};

export type SingleAppRuntimeTenantsProjectConfig = {
  setupType: 'runtime-tenants' | 'single-app-runtime-tenants';
  appVariantAccents?: readonly (string | undefined)[];
  appVariantNames?: readonly (string | undefined)[];
  projectName?: string;
  packageName?: string;
  packageManager?: GeneratedProjectPackageManager;
  stylingChoice?: GeneratedStylingChoice;
};

export type GenericWithStandaloneAppVariantsProjectConfig = {
  setupType: 'generic-standalone' | 'generic-with-standalone-app-variants';
  appVariantAccents?: readonly (string | undefined)[];
  appVariantNames?: readonly (string | undefined)[];
  projectName?: string;
  packageName?: string;
  packageManager?: GeneratedProjectPackageManager;
  stylingChoice?: GeneratedStylingChoice;
};

export type GenerateProjectConfig =
  | WhiteLabelAppsProjectConfig
  | SingleAppRuntimeTenantsProjectConfig
  | GenericWithStandaloneAppVariantsProjectConfig;

function normalizeName(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function normalizePackageName(value: string | undefined, fallback: string): string {
  const packageName = normalizeName(value, fallback);

  if (!/^[a-z0-9._-]+$/.test(packageName)) {
    throw new Error(
      `Invalid generated app package name ${JSON.stringify(packageName)}. Use a lowercase package name that can also be used as the Expo Slug.`,
    );
  }

  return packageName;
}

function normalizePackageManager(
  value: GeneratedProjectPackageManager | undefined,
): GeneratedProjectPackageManager {
  if (value === undefined) {
    return 'pnpm';
  }

  if (GENERATED_PROJECT_PACKAGE_MANAGERS.some((packageManager) => packageManager === value)) {
    return value;
  }

  throw new Error(
    `Invalid generated app package manager ${JSON.stringify(value)}. Expected one of: ${GENERATED_PROJECT_PACKAGE_MANAGERS.join(', ')}.`,
  );
}

function assertAppVariantValueCount(
  values: readonly (string | undefined)[] | undefined,
  expectedCount: number,
  label: string,
) {
  if (values !== undefined && values.length !== expectedCount) {
    throw new Error(
      `Invalid ${label} count ${values.length}. Expected exactly ${expectedCount} App Variant values.`,
    );
  }
}

function normalizeAppVariants({
  appVariantAccents,
  appVariantNames,
  setupTypeDefinition,
}: {
  appVariantAccents?: readonly (string | undefined)[];
  appVariantNames?: readonly (string | undefined)[];
  setupTypeDefinition: GeneratedSetupTypeDefinition;
}): readonly TemplateAppVariantContext[] {
  const expectedCount = setupTypeDefinition.appVariants.length;
  assertAppVariantValueCount(appVariantNames, expectedCount, 'App Variant name');
  assertAppVariantValueCount(appVariantAccents, expectedCount, 'App Variant Accent');

  const displayNames = setupTypeDefinition.appVariants.map(
    ({ defaultName }, index) => appVariantNames?.[index] ?? defaultName,
  );
  const identities = deriveAppVariantIdentities(displayNames);

  return setupTypeDefinition.appVariants.map((definition, index) => {
    const identity = identities[index];
    const accent =
      normalizeGeneratedAccentColor(appVariantAccents?.[index]) ?? definition.defaultAccent;

    if (!identity) {
      throw new Error(`Missing resolved App Variant identity at index ${index}.`);
    }

    return {
      accent,
      accentStringLiteral: JSON.stringify(accent),
      appVariantId: definition.appVariantId,
      bundleIdentifier: identity.bundleIdentifier,
      displayName: identity.displayName,
      displayNameStringLiteral: JSON.stringify(identity.displayName),
      packageName: identity.packageName,
      role: definition.role,
      scheme: identity.scheme,
      slug: identity.slug,
    };
  });
}

function normalizeTemplateContext({
  appVariantAccents,
  appVariantNames,
  projectName: rawProjectName,
  packageName: rawPackageName,
  packageManager: rawPackageManager,
  stylingChoice: rawStylingChoice,
  setupTypeDefinition,
}: {
  appVariantAccents?: readonly (string | undefined)[];
  appVariantNames?: readonly (string | undefined)[];
  projectName?: string;
  packageName?: string;
  packageManager?: GeneratedProjectPackageManager;
  stylingChoice?: GeneratedStylingChoice;
  setupTypeDefinition: GeneratedSetupTypeDefinition;
}): TemplateContext {
  const projectName = normalizeName(rawProjectName, setupTypeDefinition.defaultProjectName);
  const packageManager = normalizePackageManager(rawPackageManager);
  const stylingChoice = normalizeGeneratedStylingChoice(rawStylingChoice);

  return {
    appVariants: normalizeAppVariants({
      appVariantAccents,
      appVariantNames,
      setupTypeDefinition,
    }),
    isSingleAppRuntimeTenants: setupTypeDefinition.setupType === 'single-app-runtime-tenants',
    isBareStyling: stylingChoice === 'bare',
    isBunPackageManager: packageManager === 'bun',
    isNpmPackageManager: packageManager === 'npm',
    isUnistylesStyling: stylingChoice === 'unistyles',
    isUniwindStyling: stylingChoice === 'uniwind',
    projectName,
    projectNameStringLiteral: JSON.stringify(projectName),
    packageName: normalizePackageName(rawPackageName, setupTypeDefinition.defaultPackageName),
    packageManager,
    packageManagerInstallCommand: `${packageManager} install`,
    packageManagerRunCommand: `${packageManager} run`,
    packageManagerTenkitCommand:
      packageManager === 'npm' ? 'npm run tenkit --' : `${packageManager} run tenkit`,
    stylingChoice,
  };
}

function readProjectTemplateTree({
  templatePath,
  context,
}: {
  templatePath: string;
  context: TemplateContext;
}): VirtualFileTree {
  const sharedTree = readTemplateTree('shared', context);
  const setupTypeSharedTree = readTemplateTree(`${templatePath}/shared`, context);
  const setupTypeStylingTree = readTemplateTree(
    `${templatePath}/${context.stylingChoice}`,
    context,
  );
  const packageManagerTree =
    context.packageManager === 'pnpm'
      ? readTemplateTree('options/package-manager/pnpm/shared', context)
      : [];
  const assetTree = readTemplateTree('assets', context);
  const appVariantAssets = context.appVariants.flatMap(({ slug }) =>
    assetTree.map((file) => ({
      path: `assets/${slug}/${file.path}`,
      contents: file.contents,
    })),
  );

  return mergeVirtualFileTrees(
    sharedTree,
    setupTypeSharedTree,
    setupTypeStylingTree,
    packageManagerTree,
    appVariantAssets,
  );
}

export function generateWhiteLabelAppsProject(
  config: WhiteLabelAppsProjectConfig = { setupType: 'white-label-apps' },
): VirtualFileTree {
  if (normalizeGeneratedSetupType(config.setupType) !== 'white-label-apps') {
    throw new Error('The Template generator currently supports only White Label Apps output.');
  }

  const setupTypeDefinition = getGeneratedSetupTypeDefinition('white-label-apps');
  const context = normalizeTemplateContext({
    appVariantAccents: config.appVariantAccents,
    appVariantNames: config.appVariantNames,
    projectName: config.projectName,
    packageName: config.packageName,
    packageManager: config.packageManager,
    stylingChoice: config.stylingChoice,
    setupTypeDefinition,
  });

  return readProjectTemplateTree({
    templatePath: setupTypeDefinition.templatePath,
    context,
  });
}

export function generateSingleAppRuntimeTenantsProject(
  config: SingleAppRuntimeTenantsProjectConfig = { setupType: 'single-app-runtime-tenants' },
): VirtualFileTree {
  if (normalizeGeneratedSetupType(config.setupType) !== 'single-app-runtime-tenants') {
    throw new Error('The Template generator expected Single App Runtime Tenants output.');
  }

  const setupTypeDefinition = getGeneratedSetupTypeDefinition('single-app-runtime-tenants');
  const context = normalizeTemplateContext({
    appVariantAccents: config.appVariantAccents,
    appVariantNames: config.appVariantNames,
    projectName: config.projectName,
    packageName: config.packageName,
    packageManager: config.packageManager,
    stylingChoice: config.stylingChoice,
    setupTypeDefinition,
  });

  return readProjectTemplateTree({
    templatePath: setupTypeDefinition.templatePath,
    context,
  });
}

export function generateGenericWithStandaloneAppVariantsProject(
  config: GenericWithStandaloneAppVariantsProjectConfig = {
    setupType: 'generic-with-standalone-app-variants',
  },
): VirtualFileTree {
  if (normalizeGeneratedSetupType(config.setupType) !== 'generic-with-standalone-app-variants') {
    throw new Error('The Template generator expected Generic With Standalone App Variants output.');
  }

  const setupTypeDefinition = getGeneratedSetupTypeDefinition(
    'generic-with-standalone-app-variants',
  );
  const context = normalizeTemplateContext({
    appVariantAccents: config.appVariantAccents,
    appVariantNames: config.appVariantNames,
    projectName: config.projectName,
    packageName: config.packageName,
    packageManager: config.packageManager,
    stylingChoice: config.stylingChoice,
    setupTypeDefinition,
  });

  return readProjectTemplateTree({
    templatePath: setupTypeDefinition.templatePath,
    context,
  });
}

export function generateProject(config: GenerateProjectConfig): VirtualFileTree {
  const setupType = normalizeGeneratedSetupType(config.setupType);
  const baseConfig = {
    appVariantAccents: config.appVariantAccents,
    appVariantNames: config.appVariantNames,
    projectName: config.projectName,
    packageName: config.packageName,
    packageManager: config.packageManager,
    stylingChoice: config.stylingChoice,
  };

  switch (setupType) {
    case 'white-label-apps':
      return generateWhiteLabelAppsProject({
        ...baseConfig,
        setupType,
      });
    case 'single-app-runtime-tenants':
      return generateSingleAppRuntimeTenantsProject({
        ...baseConfig,
        setupType,
      });
    case 'generic-with-standalone-app-variants':
      return generateGenericWithStandaloneAppVariantsProject({
        ...baseConfig,
        setupType,
      });
  }
}
