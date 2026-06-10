import {
  TENANT_SLUGS,
  type TenantConfig,
  type TenantAppConfig,
  type TenantSlug,
} from '@/types/tenant-config.types';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const configs: TenantAppConfig = {
  'first-tenant': {
    tenantId: 1,
    name: 'FirstTenant',
    slug: 'first-tenant',
    version: '1.0.0',
    scheme: 'firsttenant',
    bundleIdentifier: 'com.brilliantinsane.firsttenant',
    packageName: 'com.brilliantinsane.firsttenant',
    theme: {
      accent: '#208AEF',
    },
    extra: {
      eas: {
        projectId: '',
      },
    },
  },
  'second-tenant': {
    tenantId: 2,
    name: 'SecondTenant',
    slug: 'second-tenant',
    version: '1.0.0',
    scheme: 'secondtenant',
    bundleIdentifier: 'com.brilliantinsane.secondtenant',
    packageName: 'com.brilliantinsane.secondtenant',
    theme: {
      accent: '#ca0b09',
    },
    extra: {
      eas: {
        projectId: '',
      },
    },
  },
};

type TenantConfigResolverInput = {
  projectRoot?: string;
  tenantSlug?: unknown;
};

const configuredTenantSlugs = TENANT_SLUGS;
const defaultTenantSlug = configuredTenantSlugs[0];

function isTenantSlug(value: unknown): value is TenantSlug {
  return typeof value === 'string' && configuredTenantSlugs.includes(value as TenantSlug);
}

function getRequiredTenantAssetPaths(tenantSlug: TenantSlug): string[] {
  const assetPath = `assets/${tenantSlug}`;
  const icons = `${assetPath}/icons`;
  const iosIcon = `${assetPath}/app.icon`;

  return [
    `${icons}/icon.png`,
    `${icons}/android-icon-foreground.png`,
    `${icons}/android-icon-background.png`,
    `${icons}/android-icon-monochrome.png`,
    `${icons}/splash-icon.png`,
    `${iosIcon}/icon.json`,
    `${iosIcon}/Assets/ios-icon-default.png`,
  ];
}

function validateTenantAssets(tenant: TenantConfig, projectRoot: string) {
  for (const assetPath of getRequiredTenantAssetPaths(tenant.slug)) {
    if (!existsSync(join(projectRoot, assetPath))) {
      throw new Error(
        `Missing required Tenant asset "${assetPath}" for Tenant Slug "${tenant.slug}"`,
      );
    }
  }
}

export function resolveTenantConfig({
  projectRoot = process.cwd(),
  tenantSlug,
}: TenantConfigResolverInput = {}): TenantConfig {
  const selectedTenantSlug = tenantSlug === undefined ? defaultTenantSlug : tenantSlug;

  if (!isTenantSlug(selectedTenantSlug)) {
    throw new Error(
      `Invalid Tenant Slug ${JSON.stringify(selectedTenantSlug)}. Expected one of: ${configuredTenantSlugs.join(', ')}`,
    );
  }

  const tenant = configs[selectedTenantSlug];

  validateTenantAssets(tenant, projectRoot);

  return tenant;
}
