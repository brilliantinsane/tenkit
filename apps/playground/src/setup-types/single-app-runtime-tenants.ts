import {
  defineActiveSetup,
  type AppVariant,
  type SingleAppRuntimeTenantsSetup,
  type RuntimeTenantAccess,
  type RuntimeTenantId,
} from './core';

export type { RuntimeTenantAccess, RuntimeTenantId } from './core';
export type { AppVariant, AppVariantId } from './core';

export type { SingleAppRuntimeTenantsSetup } from './core';

export function defineSingleAppRuntimeTenantsSetup<TSetup extends SingleAppRuntimeTenantsSetup>(
  activeSetup: TSetup,
): TSetup {
  if (!activeSetup.appVariant.runtimeTenantAccess) {
    throw new Error('Single App Runtime Tenants App Variant must declare Runtime Tenant Access');
  }

  return defineActiveSetup(activeSetup);
}

export type CapabilityKey = 'featureA' | 'featureB' | 'featureC';

export type RawCapabilityProfile = Partial<Record<CapabilityKey, boolean>>;

export type NormalizedCapabilityProfile = {
  featureA: boolean;
  featureB: boolean;
  featureC: boolean;
};

export type RuntimeTenant = {
  runtimeTenantId: RuntimeTenantId;
  name: string;
  capabilities?: RawCapabilityProfile;
};

export type NormalizedRuntimeTenant = {
  runtimeTenantId: RuntimeTenantId;
  name: string;
  capabilities: NormalizedCapabilityProfile;
};

type RuntimeTenantAccessInput = {
  appVariant: AppVariant & { runtimeTenantAccess: RuntimeTenantAccess };
  runtimeTenants: readonly RuntimeTenant[];
};

export function normalizeCapabilityProfile(
  capabilities?: RawCapabilityProfile,
): NormalizedCapabilityProfile {
  return {
    featureA: capabilities?.featureA ?? false,
    featureB: capabilities?.featureB ?? false,
    featureC: capabilities?.featureC ?? false,
  };
}

function normalizeRuntimeTenant(runtimeTenant: RuntimeTenant): NormalizedRuntimeTenant {
  return {
    runtimeTenantId: runtimeTenant.runtimeTenantId,
    name: runtimeTenant.name,
    capabilities: normalizeCapabilityProfile(runtimeTenant.capabilities),
  };
}

function mapRuntimeTenantsById(
  availableRuntimeTenants: readonly RuntimeTenant[],
): Map<RuntimeTenantId, RuntimeTenant> {
  return new Map(
    availableRuntimeTenants.map((runtimeTenant) => [runtimeTenant.runtimeTenantId, runtimeTenant]),
  );
}

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

export function validateRuntimeTenantAccess({
  appVariant,
  runtimeTenants: availableRuntimeTenants,
}: RuntimeTenantAccessInput): void {
  const { defaultRuntimeTenantId, allowedRuntimeTenantIds } = appVariant.runtimeTenantAccess;
  const availableRuntimeTenantIds = availableRuntimeTenants.map(
    (runtimeTenant) => runtimeTenant.runtimeTenantId,
  );

  const duplicateRuntimeTenantId = findDuplicateRuntimeTenantId(availableRuntimeTenantIds);

  if (duplicateRuntimeTenantId !== undefined) {
    throw new Error(
      `Duplicate Runtime Tenant ID "${duplicateRuntimeTenantId}" in Runtime Tenant list`,
    );
  }

  const duplicateAllowedRuntimeTenantId = findDuplicateRuntimeTenantId(allowedRuntimeTenantIds);

  if (duplicateAllowedRuntimeTenantId !== undefined) {
    throw new Error(
      `Duplicate allowed Runtime Tenant ID "${duplicateAllowedRuntimeTenantId}" in Runtime Tenant Access`,
    );
  }

  if (!allowedRuntimeTenantIds.includes(defaultRuntimeTenantId)) {
    throw new Error(
      `Default Runtime Tenant ID "${defaultRuntimeTenantId}" must be included in allowed Runtime Tenant IDs: ${allowedRuntimeTenantIds.join(', ')}`,
    );
  }

  const runtimeTenantIds = new Set(availableRuntimeTenantIds);
  const missingRuntimeTenantIds = allowedRuntimeTenantIds.filter(
    (runtimeTenantId) => !runtimeTenantIds.has(runtimeTenantId),
  );

  if (missingRuntimeTenantIds.length > 0) {
    throw new Error(
      `Runtime Tenant Access allows missing Runtime Tenant IDs: ${missingRuntimeTenantIds.join(', ')}`,
    );
  }

  const allowedRuntimeTenantIdSet = new Set(allowedRuntimeTenantIds);
  const unallowedRuntimeTenantIds = availableRuntimeTenants
    .map((runtimeTenant) => runtimeTenant.runtimeTenantId)
    .filter((runtimeTenantId) => !allowedRuntimeTenantIdSet.has(runtimeTenantId));

  if (unallowedRuntimeTenantIds.length > 0) {
    throw new Error(
      `Runtime Tenant list includes IDs not allowed by App Variant "${appVariant.appVariantId}": ${unallowedRuntimeTenantIds.join(', ')}`,
    );
  }
}

export function resolveDefaultRuntimeTenant({
  appVariant,
  runtimeTenants: availableRuntimeTenants,
}: RuntimeTenantAccessInput): NormalizedRuntimeTenant {
  validateRuntimeTenantAccess({ appVariant, runtimeTenants: availableRuntimeTenants });

  const runtimeTenantById = mapRuntimeTenantsById(availableRuntimeTenants);
  const defaultRuntimeTenant = runtimeTenantById.get(
    appVariant.runtimeTenantAccess.defaultRuntimeTenantId,
  );

  if (!defaultRuntimeTenant) {
    throw new Error(
      `Default Runtime Tenant ID "${appVariant.runtimeTenantAccess.defaultRuntimeTenantId}" does not exist`,
    );
  }

  return normalizeRuntimeTenant(defaultRuntimeTenant);
}

export function resolveSelectableRuntimeTenants({
  appVariant,
  runtimeTenants: availableRuntimeTenants,
}: RuntimeTenantAccessInput): NormalizedRuntimeTenant[] {
  validateRuntimeTenantAccess({ appVariant, runtimeTenants: availableRuntimeTenants });

  const runtimeTenantById = mapRuntimeTenantsById(availableRuntimeTenants);

  return appVariant.runtimeTenantAccess.allowedRuntimeTenantIds.map((runtimeTenantId) => {
    const runtimeTenant = runtimeTenantById.get(runtimeTenantId);

    if (!runtimeTenant) {
      throw new Error(`Allowed Runtime Tenant ID "${runtimeTenantId}" does not exist`);
    }

    return normalizeRuntimeTenant(runtimeTenant);
  });
}
