/// <reference types="node" />

import { type ConfigContext } from 'expo/config';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import createExpoConfig from '../app.config';
import { resolveAppVariantConfig } from '../src/setup-types/core';
import { resolveRuntimeActiveSetupConfig } from '../src/utils/runtime-active-setup-config';
import { genericAppStarterData } from '../starter-data/generic-with-standalone-app-variants';

const configContext: ConfigContext = {
  projectRoot: process.cwd(),
  staticConfigPath: null,
  packageJsonPath: null,
  config: {},
};

function withAppVariantSlug<T>(slug: string | undefined, callback: () => T): T {
  const previousAppVariantSlug = process.env.APP_VARIANT_SLUG;

  try {
    if (slug === undefined) {
      delete process.env.APP_VARIANT_SLUG;
    } else {
      process.env.APP_VARIANT_SLUG = slug;
    }

    return callback();
  } finally {
    if (previousAppVariantSlug === undefined) {
      delete process.env.APP_VARIANT_SLUG;
    } else {
      process.env.APP_VARIANT_SLUG = previousAppVariantSlug;
    }
  }
}

test('dynamic Expo config injects resolved App Variant native identity and Active Setup bootstrap data', () => {
  const config = withAppVariantSlug('second-tenant', () => createExpoConfig(configContext));

  assert.equal(config.owner, 'brilliant-insane');
  assert.deepEqual(config.extra?.activeSetup, {
    setupType: 'white-label-apps',
    appVariant: {
      id: 2,
      slug: 'second-tenant',
    },
    theme: {
      accent: '#ef8520',
    },
  });
  assert.equal(config.ios?.bundleIdentifier, 'com.brilliantinsane.secondtenant');
  assert.equal(config.android?.package, 'com.brilliantinsane.secondtenant');
});

test('runtime Active Setup config exposes the public Active Setup bootstrap data', () => {
  assert.deepEqual(
    resolveRuntimeActiveSetupConfig({
      activeSetup: {
        setupType: 'single-app-runtime-tenants',
        appVariant: {
          id: 1,
          slug: 'acme-app',
        },
        theme: {
          accent: '#2563eb',
        },
        runtimeTenantAccess: {
          selectionMode: 'selectable',
          defaultRuntimeTenantId: 100,
          allowedRuntimeTenantIds: [100, 101, 102],
        },
      },
    }),
    {
      setupType: 'single-app-runtime-tenants',
      appVariant: {
        id: 1,
        slug: 'acme-app',
      },
      theme: {
        accent: '#2563eb',
      },
      runtimeTenantAccess: {
        selectionMode: 'selectable',
        defaultRuntimeTenantId: 100,
        allowedRuntimeTenantIds: [100, 101, 102],
      },
    },
  );
});

function createProjectRootWithAssets(slugs: readonly string[]) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'runtime-active-setup-config-'));
  const assetSuffixes = [
    'icons/icon.png',
    'icons/android-icon-foreground.png',
    'icons/android-icon-background.png',
    'icons/android-icon-monochrome.png',
    'icons/splash-icon.png',
    'app.icon/icon.json',
  ];

  for (const slug of slugs) {
    for (const assetSuffix of assetSuffixes) {
      const filePath = join(projectRoot, 'assets', slug, assetSuffix);
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, filePath);
    }
  }

  return projectRoot;
}

function getStarterAppVariant(slug: string) {
  const appVariant = genericAppStarterData.setup.appVariants.find(
    (candidate) => candidate.slug === slug,
  );

  if (!appVariant) {
    throw new Error(`Missing Generic App starter App Variant "${slug}"`);
  }

  return appVariant;
}

test('Generic With Standalone runtime config exposes Atlas Network public bootstrap data only', () => {
  const projectRoot = createProjectRootWithAssets(['atlas-network', 'west-studio']);
  const atlasNetwork = getStarterAppVariant('atlas-network');

  try {
    const resolved = resolveAppVariantConfig({
      activeSetup: genericAppStarterData.setup,
      slug: 'atlas-network',
      projectRoot,
    });

    assert.deepEqual(resolved.extra.activeSetup, {
      setupType: 'generic-with-standalone-app-variants',
      appVariant: {
        id: 1,
        slug: 'atlas-network',
      },
      theme: atlasNetwork.theme,
      runtimeTenantAccess: {
        selectionMode: 'selectable',
        defaultRuntimeTenantId: 100,
        allowedRuntimeTenantIds: [100, 101, 102],
      },
    });
    assert.equal('runtimeTenants' in resolved.extra.activeSetup, false);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('Generic With Standalone runtime config exposes West Studio public bootstrap data only', () => {
  const projectRoot = createProjectRootWithAssets(['atlas-network', 'west-studio']);
  const westStudio = getStarterAppVariant('west-studio');

  try {
    const resolved = resolveAppVariantConfig({
      activeSetup: genericAppStarterData.setup,
      slug: 'west-studio',
      projectRoot,
    });

    assert.deepEqual(resolved.extra.activeSetup, {
      setupType: 'generic-with-standalone-app-variants',
      appVariant: {
        id: 2,
        slug: 'west-studio',
      },
      theme: westStudio.theme,
      standaloneRuntimeTenantId: 103,
    });
    assert.equal('runtimeTenantAccess' in resolved.extra.activeSetup, false);
    assert.equal('runtimeTenants' in resolved.extra.activeSetup, false);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('runtime Active Setup config accepts Generic With Standalone bootstrap data', () => {
  assert.deepEqual(
    resolveRuntimeActiveSetupConfig({
      activeSetup: {
        setupType: 'generic-with-standalone-app-variants',
        appVariant: {
          id: 2,
          slug: 'west-studio',
        },
        theme: {
          accent: '#db2777',
        },
        standaloneRuntimeTenantId: 103,
      },
    }),
    {
      setupType: 'generic-with-standalone-app-variants',
      appVariant: {
        id: 2,
        slug: 'west-studio',
      },
      theme: {
        accent: '#db2777',
      },
      standaloneRuntimeTenantId: 103,
    },
  );
});

test('runtime Active Setup config fails when Expo runtime config has no Active Setup bootstrap data', () => {
  assert.throws(
    () => resolveRuntimeActiveSetupConfig({}),
    /Missing Active Setup bootstrap data in Expo runtime config/,
  );
});
