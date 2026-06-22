import {
  defineGenericAppSetup,
  type GenericAppSetup,
  type RuntimeTenant,
} from '../src/setup-types/generic-app';

export type GenericAppStarterData = {
  setup: GenericAppSetup;
  runtimeTenants: readonly RuntimeTenant[];
};

export const genericAppStarterData: GenericAppStarterData = {
  setup: defineGenericAppSetup({
    setupType: 'generic-with-standalone-app-variants',
    appVariants: [
      {
        role: 'generic',
        appVariantId: 1,
        slug: 'atlas-network',
        name: 'Atlas Network',
        version: '1.0.0',
        scheme: 'atlasnetwork',
        bundleIdentifier: 'com.example.atlasnetwork',
        packageName: 'com.example.atlasnetwork',
        theme: {
          accent: '#20EF99',
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
      {
        role: 'standalone',
        appVariantId: 2,
        slug: 'west-studio',
        name: 'West Studio',
        version: '1.0.0',
        scheme: 'weststudio',
        bundleIdentifier: 'com.example.weststudio',
        packageName: 'com.example.weststudio',
        theme: {
          accent: '#EBE925',
        },
        eas: {
          projectId: '',
        },
        standaloneRuntimeTenantId: 103,
      },
    ],
  }),

  // Runtime Tenants are all known business contexts for this Active Setup.
  // App Variant access decides which Runtime Tenants each installed app can open.
  runtimeTenants: [
    {
      runtimeTenantId: 100,
      name: 'North Studio',
      capabilities: {
        featureA: true,
      },
    },
    {
      runtimeTenantId: 101,
      name: 'South Studio',
      capabilities: {
        featureB: true,
      },
    },
    {
      runtimeTenantId: 102,
      name: 'East Studio',
      capabilities: {
        featureA: true,
        featureB: true,
      },
    },
    {
      runtimeTenantId: 103,
      name: 'West Studio',
      capabilities: {
        featureC: true,
      },
    },
  ] satisfies readonly RuntimeTenant[],
};
