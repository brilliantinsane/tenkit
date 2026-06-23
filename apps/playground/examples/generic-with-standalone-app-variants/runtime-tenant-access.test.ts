/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { genericAppExample, resolveRuntimeTenantsForAppVariant } from './index';
import { type GenericAppVariant, type StandaloneAppVariant } from '@/setup-types/generic-app';

const { setup, runtimeTenants } = genericAppExample;
const atlasNetwork = setup.appVariants.find(
  (appVariant): appVariant is GenericAppVariant => appVariant.role === 'generic',
);
const westStudio = setup.appVariants.find(
  (appVariant): appVariant is StandaloneAppVariant => appVariant.role === 'standalone',
);

if (!atlasNetwork || !westStudio) {
  throw new Error('Generic With Standalone example fixtures are incomplete');
}

test('Atlas Network opens North, South, and East Studio only', () => {
  assert.deepEqual(
    resolveRuntimeTenantsForAppVariant({
      setup,
      appVariant: atlasNetwork,
      runtimeTenants,
    }).map((runtimeTenant) => runtimeTenant.name),
    ['North Studio', 'South Studio', 'East Studio'],
  );
});

test('West Studio App Variant opens West Studio only', () => {
  assert.deepEqual(
    resolveRuntimeTenantsForAppVariant({
      setup,
      appVariant: westStudio,
      runtimeTenants,
    }).map((runtimeTenant) => runtimeTenant.name),
    ['West Studio'],
  );
});
