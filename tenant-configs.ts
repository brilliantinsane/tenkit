import {
  TENANT_SLUGS,
  type TenantConfig,
  type TenantAppConfig,
  type TenantSlug,
} from '@/types/tenant-config.types';

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
  tenantSlug?: unknown;
};

const configuredTenantSlugs = TENANT_SLUGS;
const defaultTenantSlug = configuredTenantSlugs[0];

function isTenantSlug(value: unknown): value is TenantSlug {
  return typeof value === 'string' && configuredTenantSlugs.includes(value as TenantSlug);
}

export function resolveTenantConfig({ tenantSlug }: TenantConfigResolverInput = {}): TenantConfig {
  const selectedTenantSlug = tenantSlug === undefined ? defaultTenantSlug : tenantSlug;

  if (!isTenantSlug(selectedTenantSlug)) {
    throw new Error(
      `Invalid Tenant Slug ${JSON.stringify(selectedTenantSlug)}. Expected one of: ${configuredTenantSlugs.join(', ')}`,
    );
  }

  return configs[selectedTenantSlug];
}
