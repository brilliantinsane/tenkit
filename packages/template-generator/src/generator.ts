import {
  formatSupportedGeneratedSetupTypes,
  type GeneratedSetupTypeDefinition,
  getGeneratedSetupTypeDefinition,
  normalizeGeneratedSetupType,
} from './generated-setup-types';
import {
  GENERATED_PROJECT_PACKAGE_MANAGERS,
  readTemplateTree,
  type GeneratedProjectPackageManager,
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
export { type GeneratedProjectPackageManager } from './template-reader';

export type WhiteLabelAppsProjectConfig = {
  setupType: 'white-label' | 'white-label-apps';
  projectName?: string;
  packageName?: string;
  packageManager?: GeneratedProjectPackageManager;
};

export type SingleAppRuntimeTenantsProjectConfig = {
  setupType: 'runtime-tenants' | 'single-app-runtime-tenants';
  projectName?: string;
  packageName?: string;
  packageManager?: GeneratedProjectPackageManager;
};

export type GenericWithStandaloneAppVariantsProjectConfig = {
  setupType: 'generic-standalone' | 'generic-with-standalone-app-variants';
  projectName?: string;
  packageName?: string;
  packageManager?: GeneratedProjectPackageManager;
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

function normalizeTemplateContext({
  projectName: rawProjectName,
  packageName: rawPackageName,
  packageManager: rawPackageManager,
  setupTypeDefinition,
}: {
  projectName?: string;
  packageName?: string;
  packageManager?: GeneratedProjectPackageManager;
  setupTypeDefinition: GeneratedSetupTypeDefinition;
}): TemplateContext {
  const projectName = normalizeName(rawProjectName, setupTypeDefinition.defaultProjectName);
  const packageManager = normalizePackageManager(rawPackageManager);

  return {
    isSingleAppRuntimeTenants: setupTypeDefinition.setupType === 'single-app-runtime-tenants',
    isBunPackageManager: packageManager === 'bun',
    isNpmPackageManager: packageManager === 'npm',
    isPnpmPackageManager: packageManager === 'pnpm',
    projectName,
    projectNameStringLiteral: JSON.stringify(projectName),
    packageName: normalizePackageName(rawPackageName, setupTypeDefinition.defaultPackageName),
    packageManager,
    packageManagerInstallCommand: `${packageManager} install`,
    packageManagerRunCommand: `${packageManager} run`,
    packageManagerTenkitCommand:
      packageManager === 'npm' ? 'npm run tenkit --' : `${packageManager} run tenkit`,
  };
}

function readProjectTemplateTree({
  templatePath,
  context,
  appVariantSlugs,
}: {
  templatePath: string;
  context: TemplateContext;
  appVariantSlugs: readonly string[];
}): VirtualFileTree {
  const sharedTree = readTemplateTree('shared', context);
  const setupTypeSharedTree = readTemplateTree(`${templatePath}/shared`, context);
  const setupTypeBareTree = readTemplateTree(`${templatePath}/bare`, context);
  const assetTree = readTemplateTree('assets', context);
  const appVariantAssets = appVariantSlugs.flatMap((slug) =>
    assetTree.map((file) => ({
      path: `assets/${slug}/${file.path}`,
      contents: file.contents,
    })),
  );

  return mergeVirtualFileTrees(
    sharedTree,
    setupTypeSharedTree,
    setupTypeBareTree,
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
    projectName: config.projectName,
    packageName: config.packageName,
    packageManager: config.packageManager,
    setupTypeDefinition,
  });

  return readProjectTemplateTree({
    templatePath: setupTypeDefinition.templatePath,
    context,
    appVariantSlugs: setupTypeDefinition.appVariantSlugs,
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
    projectName: config.projectName,
    packageName: config.packageName,
    packageManager: config.packageManager,
    setupTypeDefinition,
  });

  return readProjectTemplateTree({
    templatePath: setupTypeDefinition.templatePath,
    context,
    appVariantSlugs: setupTypeDefinition.appVariantSlugs,
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
    projectName: config.projectName,
    packageName: config.packageName,
    packageManager: config.packageManager,
    setupTypeDefinition,
  });

  return readProjectTemplateTree({
    templatePath: setupTypeDefinition.templatePath,
    context,
    appVariantSlugs: setupTypeDefinition.appVariantSlugs,
  });
}

export function generateProject(config: GenerateProjectConfig): VirtualFileTree {
  const setupType = normalizeGeneratedSetupType(config.setupType);
  const baseConfig = {
    projectName: config.projectName,
    packageName: config.packageName,
    packageManager: config.packageManager,
  };

  if (setupType === 'white-label-apps') {
    return generateWhiteLabelAppsProject({
      ...baseConfig,
      setupType,
    });
  }

  if (setupType === 'single-app-runtime-tenants') {
    return generateSingleAppRuntimeTenantsProject({
      ...baseConfig,
      setupType,
    });
  }

  if (setupType === 'generic-with-standalone-app-variants') {
    return generateGenericWithStandaloneAppVariantsProject({
      ...baseConfig,
      setupType,
    });
  }

  throw new Error(
    `Unsupported generated Setup Type ${JSON.stringify((config as { setupType?: unknown }).setupType)}. Expected ${formatSupportedGeneratedSetupTypes()}.`,
  );
}
