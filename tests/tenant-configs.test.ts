/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveTenantConfig } from '../tenant-configs';

test('missing Tenant Slug resolves to the first configured Tenant', () => {
  const tenant = resolveTenantConfig({ tenantSlug: undefined });

  assert.equal(tenant.slug, 'first-tenant');
});

test('valid Tenant Slug resolves to the matching Tenant config', () => {
  const tenant = resolveTenantConfig({ tenantSlug: 'second-tenant' });

  assert.equal(tenant.slug, 'second-tenant');
  assert.equal(tenant.name, 'SecondTenant');
});

test('resolved Tenant exposes a numeric Tenant ID', () => {
  const tenant = resolveTenantConfig({ tenantSlug: 'first-tenant' });

  assert.equal(Number.isInteger(tenant.tenantId), true);
  assert.equal(tenant.tenantId > 0, true);
});

test('invalid Tenant Slug throws a clear configuration error', () => {
  assert.throws(
    () => resolveTenantConfig({ tenantSlug: 'missing-tenant' }),
    /Invalid Tenant Slug "missing-tenant". Expected one of: first-tenant, second-tenant/,
  );
});
