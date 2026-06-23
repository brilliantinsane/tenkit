import { type RuntimeTenant } from './types';
import { singleAppRuntimeTenantsStarterData } from '../../starter-data/single-app-runtime-tenants';

export const runtimeTenants =
  singleAppRuntimeTenantsStarterData.runtimeTenants satisfies readonly RuntimeTenant[];
