import { readTemplateTree, type TemplateContext } from './template-reader';
import { mergeVirtualFileTrees, type VirtualFileTree } from './virtual-file-tree';

export const SUPPORTED_GENERATED_SETUP_TYPES = [
  'white-label-apps',
  'single-app-runtime-tenants',
] as const;

export type GeneratedSetupType = (typeof SUPPORTED_GENERATED_SETUP_TYPES)[number];

export type WhiteLabelAppsProjectConfig = {
  setupType: 'white-label-apps';
  projectName?: string;
  packageName?: string;
};

export type SingleAppRuntimeTenantsProjectConfig = {
  setupType: 'single-app-runtime-tenants';
  projectName?: string;
  packageName?: string;
};

export type GenerateProjectConfig =
  | WhiteLabelAppsProjectConfig
  | SingleAppRuntimeTenantsProjectConfig;

const DEFAULT_WHITE_LABEL_PROJECT_NAME = 'Tenkit White Label App';
const DEFAULT_WHITE_LABEL_PACKAGE_NAME = 'tenkit-white-label-app';
const DEFAULT_SINGLE_APP_PROJECT_NAME = 'Tenkit Single App Runtime Tenants';
const DEFAULT_SINGLE_APP_PACKAGE_NAME = 'tenkit-single-app-runtime-tenants';
const WHITE_LABEL_APP_VARIANT_SLUGS = ['first-tenant', 'second-tenant'] as const;
const SINGLE_APP_RUNTIME_TENANTS_APP_VARIANT_SLUGS = ['acme-app'] as const;

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

function normalizeTemplateContext({
  projectName: rawProjectName,
  packageName: rawPackageName,
  defaultProjectName,
  defaultPackageName,
}: {
  projectName?: string;
  packageName?: string;
  defaultProjectName: string;
  defaultPackageName: string;
}): TemplateContext {
  const projectName = normalizeName(rawProjectName, defaultProjectName);

  return {
    projectName,
    projectNameStringLiteral: JSON.stringify(projectName),
    packageName: normalizePackageName(rawPackageName, defaultPackageName),
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
  const templateTree = readTemplateTree(templatePath, context);
  const assetTree = readTemplateTree('assets', context);
  const appVariantAssets = appVariantSlugs.flatMap((slug) =>
    assetTree.map((file) => ({
      path: `assets/${slug}/${file.path}`,
      contents: file.contents,
    })),
  );

  return mergeVirtualFileTrees(sharedTree, templateTree, appVariantAssets);
}

export function generateWhiteLabelAppsProject(
  config: WhiteLabelAppsProjectConfig = { setupType: 'white-label-apps' },
): VirtualFileTree {
  if (config.setupType !== 'white-label-apps') {
    throw new Error('The Template generator currently supports only White Label Apps output.');
  }

  const context = normalizeTemplateContext({
    projectName: config.projectName,
    packageName: config.packageName,
    defaultProjectName: DEFAULT_WHITE_LABEL_PROJECT_NAME,
    defaultPackageName: DEFAULT_WHITE_LABEL_PACKAGE_NAME,
  });

  return readProjectTemplateTree({
    templatePath: 'white-label',
    context,
    appVariantSlugs: WHITE_LABEL_APP_VARIANT_SLUGS,
  });
}

export function generateSingleAppRuntimeTenantsProject(
  config: SingleAppRuntimeTenantsProjectConfig = { setupType: 'single-app-runtime-tenants' },
): VirtualFileTree {
  if (config.setupType !== 'single-app-runtime-tenants') {
    throw new Error('The Template generator expected Single App Runtime Tenants output.');
  }

  const context = normalizeTemplateContext({
    projectName: config.projectName,
    packageName: config.packageName,
    defaultProjectName: DEFAULT_SINGLE_APP_PROJECT_NAME,
    defaultPackageName: DEFAULT_SINGLE_APP_PACKAGE_NAME,
  });

  return readProjectTemplateTree({
    templatePath: 'single-app-runtime-tenants',
    context,
    appVariantSlugs: SINGLE_APP_RUNTIME_TENANTS_APP_VARIANT_SLUGS,
  });
}

export function generateProject(config: GenerateProjectConfig): VirtualFileTree {
  if (config.setupType === 'white-label-apps') {
    return generateWhiteLabelAppsProject(config);
  }

  if (config.setupType === 'single-app-runtime-tenants') {
    return generateSingleAppRuntimeTenantsProject(config);
  }

  throw new Error(
    `Unsupported generated Setup Type ${JSON.stringify((config as { setupType?: unknown }).setupType)}. Expected one of: ${SUPPORTED_GENERATED_SETUP_TYPES.join(', ')}`,
  );
}
