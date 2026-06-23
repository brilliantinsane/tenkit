import {
  defineSingleAppRuntimeTenantsSetup,
  type RuntimeTenant,
} from '../src/setup-types/single-app-runtime-tenants';

export const singleAppRuntimeTenantsStarterData = {
  setup: defineSingleAppRuntimeTenantsSetup({
    setupType: 'single-app-runtime-tenants',
    appVariant: {
      appVariantId: 1,
      slug: 'acme-app',
      name: 'Acme App',
      version: '1.0.0',
      scheme: 'acmeapp',
      bundleIdentifier: 'com.example.acmeapp',
      packageName: 'com.example.acmeapp',
      theme: {
        accent: '#eb2556',
      },
      eas: {
        projectId: '',
      },
      runtimeTenantAccess: {
        selectionMode: 'selectable',
        defaultRuntimeTenantId: 100,
        allowedRuntimeTenantIds: [100, 101, 102],
      },
    },
  }),

  runtimeTenants: [
    {
      runtimeTenantId: 100,
      name: 'North Branch',
      capabilities: {
        featureA: true,
      },
    },
    {
      runtimeTenantId: 101,
      name: 'South Branch',
      capabilities: {
        featureA: true,
        featureB: true,
      },
    },
    {
      runtimeTenantId: 102,
      name: 'East Branch',
      capabilities: {
        featureB: true,
      },
    },
  ] satisfies readonly RuntimeTenant[],
};
