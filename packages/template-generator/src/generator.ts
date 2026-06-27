import { readTemplateTree, type TemplateContext } from './template-reader';
import { mergeVirtualFileTrees, type VirtualFileTree } from './virtual-file-tree';

export const SUPPORTED_GENERATED_SETUP_TYPES = ['white-label-apps'] as const;

export type GeneratedSetupType = (typeof SUPPORTED_GENERATED_SETUP_TYPES)[number];

export type WhiteLabelAppsProjectConfig = {
  setupType: 'white-label-apps';
  projectName?: string;
  packageName?: string;
};

export type GenerateProjectConfig = WhiteLabelAppsProjectConfig;

const DEFAULT_PROJECT_NAME = 'Tenkit White Label App';
const DEFAULT_PACKAGE_NAME = 'tenkit-white-label-app';
const WHITE_LABEL_APP_VARIANT_SLUGS = ['first-tenant', 'second-tenant'] as const;

function normalizeName(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function normalizePackageName(value: string | undefined): string {
  const packageName = normalizeName(value, DEFAULT_PACKAGE_NAME);

  if (!/^[a-z0-9._-]+$/.test(packageName)) {
    throw new Error(
      `Invalid generated app package name ${JSON.stringify(packageName)}. Use a lowercase package name that can also be used as the Expo Slug.`,
    );
  }

  return packageName;
}

function normalizeTemplateContext(config: WhiteLabelAppsProjectConfig): TemplateContext {
  return {
    projectName: normalizeName(config.projectName, DEFAULT_PROJECT_NAME),
    packageName: normalizePackageName(config.packageName),
  };
}

export function generateWhiteLabelAppsProject(
  config: WhiteLabelAppsProjectConfig = { setupType: 'white-label-apps' },
): VirtualFileTree {
  if (config.setupType !== 'white-label-apps') {
    throw new Error('The Template generator currently supports only White Label Apps output.');
  }

  const normalizedConfig = normalizeTemplateContext(config);
  const sharedTree = readTemplateTree('shared', normalizedConfig);
  const whiteLabelTree = readTemplateTree('white-label', normalizedConfig);
  const assetTree = readTemplateTree('assets', normalizedConfig);
  const appVariantAssets = WHITE_LABEL_APP_VARIANT_SLUGS.flatMap((slug) =>
    assetTree.map((file) => ({
      path: `assets/${slug}/${file.path}`,
      contents: file.contents,
    })),
  );

  return mergeVirtualFileTrees(sharedTree, whiteLabelTree, appVariantAssets);
}

export function generateProject(config: GenerateProjectConfig): VirtualFileTree {
  if (config.setupType === 'white-label-apps') {
    return generateWhiteLabelAppsProject(config);
  }

  throw new Error('Unsupported generated Setup Type.');
}
