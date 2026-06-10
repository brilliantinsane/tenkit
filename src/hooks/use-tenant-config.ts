import { DEFAULT_GENERIC_TENANT_ID } from '@/constants/globals';
import { TenantConfig } from '@/types/common.types';

const tenantId = process.env.EXPO_PUBLIC_TENANT_ID
  ? Number(process.env.EXPO_PUBLIC_TENANT_ID)
  : DEFAULT_GENERIC_TENANT_ID;

export const useTenantConfig = (): TenantConfig => {
  return {
    tenantId,
  };
};
