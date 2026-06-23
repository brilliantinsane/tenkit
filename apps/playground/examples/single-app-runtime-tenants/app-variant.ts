import { type AppVariant } from './types';
import { singleAppRuntimeTenantsStarterData } from '../../starter-data/single-app-runtime-tenants';

export const acmeAppVariant = singleAppRuntimeTenantsStarterData.setup
  .appVariant satisfies AppVariant;
