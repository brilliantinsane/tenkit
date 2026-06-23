/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { acmeAppVariant } from './app-variant';
import {
  normalizeCapabilityProfile,
  resolveDefaultRuntimeTenant,
  resolveSelectableRuntimeTenants,
  validateRuntimeTenantAccess,
} from './runtime-tenant-access';

test('default Runtime Tenant resolves from the App Variant access config', () => {
  assert.deepEqual(resolveDefaultRuntimeTenant(), {
    runtimeTenantId: 100,
    name: 'North Branch',
    capabilities: {
      featureA: true,
      featureB: false,
      featureC: false,
    },
  });
});

test('selectable Runtime Tenants resolve in allowed Runtime Tenant ID order', () => {
  assert.deepEqual(
    resolveSelectableRuntimeTenants({
      appVariant: {
        ...acmeAppVariant,
        runtimeTenantAccess: {
          ...acmeAppVariant.runtimeTenantAccess,
          allowedRuntimeTenantIds: [102, 101, 100],
        },
      },
    }).map((runtimeTenant) => runtimeTenant.runtimeTenantId),
    [102, 101, 100],
  );
});

test('Capability Profiles normalize omitted flags to false in stable key order', () => {
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

test('Runtime Tenant Access rejects a default Runtime Tenant outside the allowed IDs', () => {
  assert.throws(
    () =>
      validateRuntimeTenantAccess({
        appVariant: {
          ...acmeAppVariant,
          runtimeTenantAccess: {
            ...acmeAppVariant.runtimeTenantAccess,
            defaultRuntimeTenantId: 999,
          },
        },
      }),
    /Default Runtime Tenant ID "999" must be included in allowed Runtime Tenant IDs: 100, 101, 102/,
  );
});

test('Runtime Tenant Access rejects allowed IDs with no local Runtime Tenant', () => {
  assert.throws(
    () =>
      validateRuntimeTenantAccess({
        appVariant: {
          ...acmeAppVariant,
          runtimeTenantAccess: {
            ...acmeAppVariant.runtimeTenantAccess,
            allowedRuntimeTenantIds: [100, 999],
          },
        },
      }),
    /Runtime Tenant Access allows missing Runtime Tenant IDs: 999/,
  );
});

test('Runtime Tenant Access rejects local Runtime Tenants outside the allowed IDs', () => {
  assert.throws(
    () =>
      validateRuntimeTenantAccess({
        appVariant: {
          ...acmeAppVariant,
          runtimeTenantAccess: {
            ...acmeAppVariant.runtimeTenantAccess,
            allowedRuntimeTenantIds: [100],
          },
        },
      }),
    /Runtime Tenant list includes IDs not allowed by App Variant "1": 101, 102/,
  );
});

test('Runtime Tenant Access rejects duplicate local Runtime Tenant IDs', () => {
  assert.throws(
    () =>
      validateRuntimeTenantAccess({
        runtimeTenants: [
          { runtimeTenantId: 100, name: 'North Branch' },
          { runtimeTenantId: 100, name: 'Duplicate North Branch' },
          { runtimeTenantId: 101, name: 'South Branch' },
        ],
      }),
    /Duplicate Runtime Tenant ID "100" in Runtime Tenant list/,
  );
});

test('Runtime Tenant Access rejects duplicate allowed Runtime Tenant IDs', () => {
  assert.throws(
    () =>
      validateRuntimeTenantAccess({
        appVariant: {
          ...acmeAppVariant,
          runtimeTenantAccess: {
            ...acmeAppVariant.runtimeTenantAccess,
            allowedRuntimeTenantIds: [100, 100, 101],
          },
        },
      }),
    /Duplicate allowed Runtime Tenant ID "100" in Runtime Tenant Access/,
  );
});
