/// <reference types="node" />

import { assert, test } from 'vitest';

import {
  defineGenericAppSetup,
  resolveRuntimeTenantsForAppVariant,
  validateGenericAppRuntimeTenants,
  type GenericAppSetup,
  type GenericAppSetupVariant,
  type GenericAppVariant,
  type RuntimeTenant,
  type StandaloneAppVariant,
} from '../src/setup-types/generic-app';
import { SETUP_TYPES, getDefaultAppVariant, getAppVariants } from '../src/setup-types/core';

const setup = defineGenericAppSetup({
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
        accent: '#2563eb',
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
        accent: '#db2777',
      },
      eas: {
        projectId: '',
      },
      standaloneRuntimeTenantId: 103,
    },
  ],
} satisfies GenericAppSetup);

const runtimeTenants = [
  { runtimeTenantId: 100, name: 'North Studio', capabilities: { featureA: true } },
  { runtimeTenantId: 101, name: 'South Studio', capabilities: { featureB: true } },
  { runtimeTenantId: 102, name: 'East Studio' },
  { runtimeTenantId: 103, name: 'West Studio', capabilities: { featureC: true } },
] satisfies readonly RuntimeTenant[];

const atlasNetwork = setup.appVariants[0] as GenericAppVariant;
const westStudio = setup.appVariants[1] as StandaloneAppVariant;

test('Generic With Standalone App Variants is a shared Setup Type', () => {
  assert.ok(SETUP_TYPES.includes('generic-with-standalone-app-variants'));
  assert.equal(getAppVariants(setup).length, 2);
  assert.equal(getDefaultAppVariant(setup).slug, 'atlas-network');
});

test('Generic App Setup resolves selectable and standalone Runtime Tenants', () => {
  assert.deepEqual(
    resolveRuntimeTenantsForAppVariant({
      setup,
      appVariant: atlasNetwork,
      runtimeTenants,
    }).map((runtimeTenant) => runtimeTenant.name),
    ['North Studio', 'South Studio', 'East Studio'],
  );

  assert.deepEqual(
    resolveRuntimeTenantsForAppVariant({
      setup,
      appVariant: westStudio,
      runtimeTenants,
    }).map((runtimeTenant) => runtimeTenant.name),
    ['West Studio'],
  );
});

test('Generic App Setup rejects invalid role and access shapes', () => {
  assert.throws(
    () => defineGenericAppSetup({ ...setup, appVariants: [westStudio] }),
    /Generic App Setup must include exactly one Generic App Variant, found 0/,
  );

  assert.throws(
    () => defineGenericAppSetup({ ...setup, appVariants: [atlasNetwork, { ...atlasNetwork }] }),
    /Generic App Setup must include exactly one Generic App Variant, found 2/,
  );

  assert.throws(
    () =>
      defineGenericAppSetup({
        ...setup,
        appVariants: [
          {
            ...atlasNetwork,
            runtimeTenantAccess: undefined,
          } as unknown as GenericAppSetupVariant,
          westStudio,
        ],
      }),
    /Generic App Variant must declare selectable Runtime Tenant Access/,
  );

  assert.throws(
    () =>
      defineGenericAppSetup({
        ...setup,
        appVariants: [
          atlasNetwork,
          {
            ...westStudio,
            standaloneRuntimeTenantId: undefined,
          } as unknown as GenericAppSetupVariant,
        ],
      }),
    /Standalone App Variant Runtime Tenant ID must be a positive integer/,
  );
});

test('Generic App Setup rejects duplicate App Variant identity and standalone assignments', () => {
  assert.throws(
    () =>
      defineGenericAppSetup({
        ...setup,
        appVariants: [atlasNetwork, { ...westStudio, appVariantId: atlasNetwork.appVariantId }],
      }),
    /Duplicate App Variant ID "1" in Active Setup Manifest/,
  );

  assert.throws(
    () =>
      defineGenericAppSetup({
        ...setup,
        appVariants: [atlasNetwork, { ...westStudio, slug: atlasNetwork.slug }],
      }),
    /Duplicate Slug "atlas-network" in Active Setup Manifest/,
  );

  assert.throws(
    () =>
      defineGenericAppSetup({
        ...setup,
        appVariants: [
          atlasNetwork,
          westStudio,
          {
            ...westStudio,
            appVariantId: 3,
            slug: 'another-west-studio',
          },
        ],
      }),
    /Duplicate standalone Runtime Tenant assignment "103" in Active Setup Manifest/,
  );
});

test('Generic App Setup rejects standalone Runtime Tenants in Generic access', () => {
  assert.throws(
    () =>
      defineGenericAppSetup({
        ...setup,
        appVariants: [
          {
            ...atlasNetwork,
            runtimeTenantAccess: {
              ...atlasNetwork.runtimeTenantAccess,
              allowedRuntimeTenantIds: [100, 101, 102, 103],
            },
          },
          westStudio,
        ],
      }),
    /Standalone Runtime Tenant ID "103" must not appear in Generic App Variant Runtime Tenant Access/,
  );
});

test('Generic App Runtime Tenant validation rejects missing and duplicate Runtime Tenant IDs', () => {
  assert.throws(
    () =>
      validateGenericAppRuntimeTenants({
        setup,
        runtimeTenants: runtimeTenants.filter(
          (runtimeTenant) => runtimeTenant.runtimeTenantId !== 102,
        ),
      }),
    /Generic App Variant allows missing Runtime Tenant IDs: 102/,
  );

  assert.throws(
    () =>
      validateGenericAppRuntimeTenants({
        setup,
        runtimeTenants: runtimeTenants.filter(
          (runtimeTenant) => runtimeTenant.runtimeTenantId !== 103,
        ),
      }),
    /Standalone App Variants reference missing Runtime Tenant IDs: 103/,
  );

  assert.throws(
    () =>
      validateGenericAppRuntimeTenants({
        setup,
        runtimeTenants: [
          ...runtimeTenants,
          {
            runtimeTenantId: 100,
            name: 'Duplicate North Studio',
          },
        ],
      }),
    /Duplicate Runtime Tenant ID "100" in Runtime Tenant list/,
  );
});
