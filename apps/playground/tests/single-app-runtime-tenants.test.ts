/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeCapabilityProfile,
  resolveDefaultRuntimeTenant,
  resolveSelectableRuntimeTenants,
  validateRuntimeTenantAccess,
  type AppVariant,
  type RuntimeTenant,
} from '../src/setup-types/single-app-runtime-tenants';

const appVariant = {
  appVariantId: 1,
  slug: 'acme-app',
  name: 'Acme App',
  version: '1.0.0',
  scheme: 'acmeapp',
  bundleIdentifier: 'com.example.acmeapp',
  packageName: 'com.example.acmeapp',
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
} satisfies AppVariant & { runtimeTenantAccess: NonNullable<AppVariant['runtimeTenantAccess']> };

const runtimeTenants = [
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
] satisfies readonly RuntimeTenant[];

test('Single App Runtime Tenants resolves the default Runtime Tenant from App Variant access', () => {
  assert.deepEqual(resolveDefaultRuntimeTenant({ appVariant, runtimeTenants }), {
    runtimeTenantId: 100,
    name: 'North Branch',
    capabilities: {
      featureA: true,
      featureB: false,
      featureC: false,
    },
  });
});

test('Single App Runtime Tenants resolves selectable Runtime Tenants in allowed ID order', () => {
  assert.deepEqual(
    resolveSelectableRuntimeTenants({
      appVariant: {
        ...appVariant,
        runtimeTenantAccess: {
          ...appVariant.runtimeTenantAccess,
          allowedRuntimeTenantIds: [102, 101, 100],
        },
      },
      runtimeTenants,
    }).map((runtimeTenant) => runtimeTenant.runtimeTenantId),
    [102, 101, 100],
  );
});

test('Capability Profiles normalize omitted flags to false', () => {
  assert.deepEqual(normalizeCapabilityProfile({ featureB: true }), {
    featureA: false,
    featureB: true,
    featureC: false,
  });

  assert.deepEqual(normalizeCapabilityProfile(), {
    featureA: false,
    featureB: false,
    featureC: false,
  });
});

test('Runtime Tenant Access rejects invalid local-source membership', () => {
  assert.throws(
    () =>
      validateRuntimeTenantAccess({
        appVariant: {
          ...appVariant,
          runtimeTenantAccess: {
            ...appVariant.runtimeTenantAccess,
            defaultRuntimeTenantId: 999,
          },
        },
        runtimeTenants,
      }),
    /Default Runtime Tenant ID "999" must be included in allowed Runtime Tenant IDs: 100, 101, 102/,
  );

  assert.throws(
    () =>
      validateRuntimeTenantAccess({
        appVariant: {
          ...appVariant,
          runtimeTenantAccess: {
            ...appVariant.runtimeTenantAccess,
            allowedRuntimeTenantIds: [100, 999],
          },
        },
        runtimeTenants,
      }),
    /Runtime Tenant Access allows missing Runtime Tenant IDs: 999/,
  );

  assert.throws(
    () =>
      validateRuntimeTenantAccess({
        appVariant: {
          ...appVariant,
          runtimeTenantAccess: {
            ...appVariant.runtimeTenantAccess,
            allowedRuntimeTenantIds: [100],
          },
        },
        runtimeTenants,
      }),
    /Runtime Tenant list includes IDs not allowed by App Variant "1": 101, 102/,
  );
});

test('Runtime Tenant Access rejects duplicate Runtime Tenant IDs', () => {
  assert.throws(
    () =>
      validateRuntimeTenantAccess({
        appVariant,
        runtimeTenants: [
          { runtimeTenantId: 100, name: 'North Branch' },
          { runtimeTenantId: 100, name: 'Duplicate North Branch' },
          { runtimeTenantId: 101, name: 'South Branch' },
        ],
      }),
    /Duplicate Runtime Tenant ID "100" in Runtime Tenant list/,
  );

  assert.throws(
    () =>
      validateRuntimeTenantAccess({
        appVariant: {
          ...appVariant,
          runtimeTenantAccess: {
            ...appVariant.runtimeTenantAccess,
            allowedRuntimeTenantIds: [100, 100, 101],
          },
        },
        runtimeTenants,
      }),
    /Duplicate allowed Runtime Tenant ID "100" in Runtime Tenant Access/,
  );
});
