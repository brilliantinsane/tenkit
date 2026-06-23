import { acmeAppVariant } from './app-variant';
import { runtimeTenants } from './runtime-tenants';
import { type RuntimeTenant } from './types';
import {
  normalizeCapabilityProfile as normalizeSharedCapabilityProfile,
  resolveDefaultRuntimeTenant as resolveSharedDefaultRuntimeTenant,
  resolveSelectableRuntimeTenants as resolveSharedSelectableRuntimeTenants,
  validateRuntimeTenantAccess as validateSharedRuntimeTenantAccess,
} from '@/setup-types/single-app-runtime-tenants';

type RuntimeTenantAccessInput = {
  appVariant?: typeof acmeAppVariant;
  runtimeTenants?: readonly RuntimeTenant[];
};

export const normalizeCapabilityProfile = normalizeSharedCapabilityProfile;

export function validateRuntimeTenantAccess({
  appVariant = acmeAppVariant,
  runtimeTenants: availableRuntimeTenants = runtimeTenants,
}: RuntimeTenantAccessInput = {}): void {
  validateSharedRuntimeTenantAccess({ appVariant, runtimeTenants: availableRuntimeTenants });
}

export function resolveDefaultRuntimeTenant({
  appVariant = acmeAppVariant,
  runtimeTenants: availableRuntimeTenants = runtimeTenants,
}: RuntimeTenantAccessInput = {}) {
  return resolveSharedDefaultRuntimeTenant({ appVariant, runtimeTenants: availableRuntimeTenants });
}

export function resolveSelectableRuntimeTenants({
  appVariant = acmeAppVariant,
  runtimeTenants: availableRuntimeTenants = runtimeTenants,
}: RuntimeTenantAccessInput = {}) {
  return resolveSharedSelectableRuntimeTenants({
    appVariant,
    runtimeTenants: availableRuntimeTenants,
  });
}
