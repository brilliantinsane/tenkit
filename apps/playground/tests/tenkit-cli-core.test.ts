/// <reference types="node" />

import { assert, test } from 'vitest';

import { EAS_CLI_MISSING_MESSAGE, planBuild, planReset } from '../scripts/tenkit-cli-core';
import { activeSetup } from '../src/active-setup/manifest';
import { type ActiveSetup } from '../src/setup-types/core';
import { defineSingleAppRuntimeTenantsSetup } from '../src/setup-types/single-app-runtime-tenants';

function withProjectIds(setup: ActiveSetup = activeSetup): ActiveSetup {
  if (setup.setupType === 'single-app-runtime-tenants') {
    return {
      ...setup,
      appVariant: {
        ...setup.appVariant,
        eas: {
          projectId: '11111111-1111-1111-1111-111111111111',
        },
      },
    };
  }

  if (setup.setupType === 'generic-with-standalone-app-variants') {
    return {
      ...setup,
      appVariants: setup.appVariants.map((appVariant, index) => ({
        ...appVariant,
        eas: {
          projectId: `${index + 1}${index + 1}${index + 1}${index + 1}${index + 1}${index + 1}${index + 1}${index + 1}-1111-1111-1111-111111111111`,
        },
      })),
    };
  }

  return {
    ...setup,
    appVariants: setup.appVariants.map((appVariant, index) => ({
      ...appVariant,
      eas: {
        projectId: `${index + 1}${index + 1}${index + 1}${index + 1}${index + 1}${index + 1}${index + 1}${index + 1}-1111-1111-1111-111111111111`,
      },
    })),
  };
}

function withoutFirstProjectId(): ActiveSetup {
  if (activeSetup.setupType !== 'white-label-apps') {
    throw new Error('test fixture expects the default Active Setup to be White Label Apps');
  }

  return {
    ...activeSetup,
    appVariants: activeSetup.appVariants.map((appVariant) => ({
      ...appVariant,
      eas: {
        projectId: appVariant.slug === 'first-tenant' ? '' : '22222222-2222-2222-2222-222222222222',
      },
    })),
  };
}

const singleAppRuntimeTenantsSetup = defineSingleAppRuntimeTenantsSetup({
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
      accent: '#2563eb',
    },
    eas: {
      projectId: '33333333-3333-3333-3333-333333333333',
    },
    runtimeTenantAccess: {
      selectionMode: 'selectable',
      defaultRuntimeTenantId: 100,
      allowedRuntimeTenantIds: [100, 101, 102],
    },
  },
});

test('build preparation resolves platform shortcuts and explicit platform values', () => {
  const shortcut = planBuild({
    flags: { slug: 'first-tenant', env: 'development', ios: true },
    context: { ci: false, expoToken: undefined, activeSetup: withProjectIds() },
  });
  const explicit = planBuild({
    flags: { slug: 'first-tenant', env: 'development', platform: 'ios' },
    context: { ci: false, expoToken: undefined, activeSetup: withProjectIds() },
  });

  assert.equal(shortcut.platform, 'ios');
  assert.equal(explicit.platform, 'ios');
});

test('build preparation rejects conflicting platform shortcuts', () => {
  assert.throws(
    () =>
      planBuild({
        flags: { slug: 'first-tenant', env: 'development', ios: true, android: true },
        context: { ci: false, expoToken: undefined, activeSetup: withProjectIds() },
      }),
    /Choose only one platform/,
  );
});

test('build preparation rejects unknown Slugs', () => {
  assert.throws(
    () =>
      planBuild({
        flags: { slug: 'missing-variant', env: 'development', platform: 'ios' },
        context: { ci: false, expoToken: undefined, activeSetup: withProjectIds() },
      }),
    /Invalid Slug "missing-variant"/,
  );
});

test('build preparation requires the selected App Variant EAS Project ID', () => {
  assert.throws(
    () =>
      planBuild({
        flags: { slug: 'first-tenant', env: 'development', platform: 'ios' },
        context: { ci: false, expoToken: undefined, activeSetup: withoutFirstProjectId() },
      }),
    /missing an EAS Project ID/,
  );
});

test('CI build preparation requires Slug when the Active Setup has multiple App Variants', () => {
  assert.throws(
    () =>
      planBuild({
        flags: { env: 'development', platform: 'ios' },
        context: { ci: true, expoToken: 'token', activeSetup: withProjectIds() },
      }),
    /CI build preparation requires --slug/,
  );
});

test('CI build preparation allows omitted Slug when the Active Setup has one App Variant', () => {
  const plan = planBuild({
    flags: { env: 'development', platform: 'ios' },
    context: { ci: true, expoToken: 'token', activeSetup: singleAppRuntimeTenantsSetup },
  });

  assert.equal(plan.appVariant.appVariantId, 1);
  assert.equal(plan.appVariant.slug, 'acme-app');
});

test('local build preparation resolves defaults without CI auth requirements', () => {
  const plan = planBuild({
    flags: {},
    context: { ci: false, expoToken: undefined, activeSetup: withProjectIds() },
  });

  assert.equal(plan.appVariant.appVariantId, 1);
  assert.equal(plan.appVariant.slug, 'first-tenant');
  assert.equal(plan.environment, 'development');
  assert.equal(plan.platform, 'both');
});

test('build reset resolves default App Variant, development App Variant Environment, and both platforms', () => {
  const plan = planReset({ activeSetup: withProjectIds() });

  assert.equal(plan.appVariant.appVariantId, 1);
  assert.equal(plan.appVariant.slug, 'first-tenant');
  assert.equal(plan.environment, 'development');
  assert.equal(plan.platform, 'both');
});

test('build reset works for Single App Runtime Tenants without Runtime Tenant selection', () => {
  const plan = planReset({ activeSetup: singleAppRuntimeTenantsSetup });

  assert.equal(plan.appVariant.appVariantId, 1);
  assert.equal(plan.appVariant.slug, 'acme-app');
  assert.equal(plan.environment, 'development');
  assert.equal(plan.platform, 'both');
});

test('build reset requires the default App Variant EAS Project ID', () => {
  assert.throws(
    () => planReset({ activeSetup: withoutFirstProjectId() }),
    /missing an EAS Project ID/,
  );
});

test('build preparation pulls EAS env vars into explicit .env.local path', () => {
  const plan = planBuild({
    flags: { slug: 'first-tenant', env: 'preview', platform: 'android' },
    context: { ci: false, expoToken: undefined, activeSetup: withProjectIds() },
  });

  assert.deepEqual(plan.commands[0], {
    bin: 'eas',
    args: ['env:pull', '--environment', 'preview', '--path', '.env.local', '--non-interactive'],
    env: { APP_VARIANT_SLUG: 'first-tenant' },
  });
  assert.deepEqual(plan.commands[1], {
    bin: 'pnpm',
    args: ['expo', 'prebuild', '--clean', '--platform', 'android'],
    env: { APP_VARIANT_SLUG: 'first-tenant' },
  });
});

test('missing EAS CLI message points to official global installation instructions', () => {
  assert.equal(
    EAS_CLI_MISSING_MESSAGE,
    'EAS CLI not found. Install it globally using the official EAS CLI installation instructions.',
  );
});
