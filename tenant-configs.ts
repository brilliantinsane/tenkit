import { type TenantAppConfig } from '@/types/tenant-config.types';

export const configs: TenantAppConfig = {
  'first-tenant': {
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
