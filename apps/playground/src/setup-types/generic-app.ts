import {
  defineActiveSetup,
  type GenericAppSetup,
  type GenericAppVariant,
  type RuntimeTenantId,
  type StandaloneAppVariant,
} from './core';
import {
  normalizeCapabilityProfile,
  type NormalizedRuntimeTenant,
  type RuntimeTenant,
} from './single-app-runtime-tenants';

export type {
  AppVariant,
  AppVariantId,
  GenericAppSetup,
  GenericAppSetupVariant,
  GenericAppVariant,
  RuntimeTenantAccess,
  RuntimeTenantId,
  StandaloneAppVariant,
} from './core';
export type {
  NormalizedCapabilityProfile,
  NormalizedRuntimeTenant,
  RawCapabilityProfile,
  RuntimeTenant,
} from './single-app-runtime-tenants';

type GenericAppRuntimeTenantInput = {
  setup: GenericAppSetup;
  runtimeTenants: readonly RuntimeTenant[];
};

type AppVariantRuntimeTenantInput = GenericAppRuntimeTenantInput & {
  appVariant: GenericAppVariant | StandaloneAppVariant;
};

function findDuplicateRuntimeTenantId(
  runtimeTenantIds: readonly RuntimeTenantId[],
): RuntimeTenantId | undefined {
  const seenRuntimeTenantIds = new Set<RuntimeTenantId>();

  for (const runtimeTenantId of runtimeTenantIds) {
    if (seenRuntimeTenantIds.has(runtimeTenantId)) {
      return runtimeTenantId;
    }

    seenRuntimeTenantIds.add(runtimeTenantId);
  }
}

function mapRuntimeTenantsById(
  runtimeTenants: readonly RuntimeTenant[],
): Map<RuntimeTenantId, RuntimeTenant> {
  return new Map(
    runtimeTenants.map((runtimeTenant) => [runtimeTenant.runtimeTenantId, runtimeTenant]),
  );
}

function normalizeRuntimeTenant(runtimeTenant: RuntimeTenant): NormalizedRuntimeTenant {
  return {
    runtimeTenantId: runtimeTenant.runtimeTenantId,
    name: runtimeTenant.name,
    capabilities: normalizeCapabilityProfile(runtimeTenant.capabilities),
  };
}

function getGenericAppVariant(setup: GenericAppSetup): GenericAppVariant {
  const genericAppVariant = setup.appVariants.find(
    (appVariant): appVariant is GenericAppVariant => appVariant.role === 'generic',
  );

  if (!genericAppVariant) {
    throw new Error('Generic App Setup must include exactly one Generic App Variant');
  }

  return genericAppVariant;
}

export function defineGenericAppSetup<TSetup extends GenericAppSetup>(setup: TSetup): TSetup {
  return defineActiveSetup(setup);
}

export function validateGenericAppRuntimeTenants({
  setup,
  runtimeTenants,
}: GenericAppRuntimeTenantInput): void {
  defineGenericAppSetup(setup);

  const runtimeTenantIds = runtimeTenants.map((runtimeTenant) => runtimeTenant.runtimeTenantId);
  const duplicateRuntimeTenantId = findDuplicateRuntimeTenantId(runtimeTenantIds);

  if (duplicateRuntimeTenantId !== undefined) {
    throw new Error(
      `Duplicate Runtime Tenant ID "${duplicateRuntimeTenantId}" in Runtime Tenant list`,
    );
  }

  const runtimeTenantIdSet = new Set(runtimeTenantIds);
  const genericAppVariant = getGenericAppVariant(setup);
  const allowedRuntimeTenantIds = genericAppVariant.runtimeTenantAccess.allowedRuntimeTenantIds;
  const missingAllowedRuntimeTenantIds = allowedRuntimeTenantIds.filter(
    (runtimeTenantId) => !runtimeTenantIdSet.has(runtimeTenantId),
  );

  if (missingAllowedRuntimeTenantIds.length > 0) {
    throw new Error(
      `Generic App Variant allows missing Runtime Tenant IDs: ${missingAllowedRuntimeTenantIds.join(', ')}`,
    );
  }

  const missingStandaloneRuntimeTenantIds = setup.appVariants
    .filter((appVariant): appVariant is StandaloneAppVariant => appVariant.role === 'standalone')
    .map((appVariant) => appVariant.standaloneRuntimeTenantId)
    .filter((runtimeTenantId) => !runtimeTenantIdSet.has(runtimeTenantId));

  if (missingStandaloneRuntimeTenantIds.length > 0) {
    throw new Error(
      `Standalone App Variants reference missing Runtime Tenant IDs: ${missingStandaloneRuntimeTenantIds.join(', ')}`,
    );
  }
}

export function resolveRuntimeTenantsForAppVariant({
  setup,
  appVariant,
  runtimeTenants,
}: AppVariantRuntimeTenantInput): NormalizedRuntimeTenant[] {
  validateGenericAppRuntimeTenants({ setup, runtimeTenants });

  const runtimeTenantById = mapRuntimeTenantsById(runtimeTenants);

  if (appVariant.role === 'generic') {
    return appVariant.runtimeTenantAccess.allowedRuntimeTenantIds.map((runtimeTenantId) => {
      const runtimeTenant = runtimeTenantById.get(runtimeTenantId);

      if (!runtimeTenant) {
        throw new Error(`Allowed Runtime Tenant ID "${runtimeTenantId}" does not exist`);
      }

      return normalizeRuntimeTenant(runtimeTenant);
    });
  }

  const runtimeTenant = runtimeTenantById.get(appVariant.standaloneRuntimeTenantId);

  if (!runtimeTenant) {
    throw new Error(
      `Standalone Runtime Tenant ID "${appVariant.standaloneRuntimeTenantId}" does not exist`,
    );
  }

  return [normalizeRuntimeTenant(runtimeTenant)];
}
