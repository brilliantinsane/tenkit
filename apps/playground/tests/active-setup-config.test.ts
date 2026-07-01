/// <reference types="node" />

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assert, test } from 'vitest';

import { activeSetup } from '../src/active-setup/manifest';
import { defineActiveSetup, resolveAppVariantConfig } from '../src/setup-types/core';

test('missing Slug resolves to the default App Variant', () => {
  const appVariant = resolveAppVariantConfig({ activeSetup, slug: undefined });

  assert.equal(appVariant.appVariantId, 1);
  assert.equal(appVariant.slug, 'first-tenant');
});

test('valid Slug resolves to the matching App Variant config', () => {
  const appVariant = resolveAppVariantConfig({ activeSetup, slug: 'second-tenant' });

  assert.equal(appVariant.appVariantId, 2);
  assert.equal(appVariant.slug, 'second-tenant');
  assert.equal(appVariant.name, 'Second Tenant');
});

test('resolved White Label Apps config does not expose top-level runtime Tenant metadata', () => {
  const appVariant = resolveAppVariantConfig({ activeSetup, slug: 'first-tenant' });

  assert.equal('tenantId' in appVariant.extra, false);
  assert.equal('slug' in appVariant.extra, false);
  assert.equal('theme' in appVariant.extra, false);
});

test('resolved App Variant exposes public Active Setup bootstrap data', () => {
  const appVariant = resolveAppVariantConfig({ activeSetup, slug: 'second-tenant' });

  assert.deepEqual(appVariant.extra.activeSetup, {
    setupType: 'white-label-apps',
    appVariant: {
      id: 2,
      slug: 'second-tenant',
    },
    theme: {
      accent: '#ef8520',
    },
  });
});

test('invalid Slug throws a clear configuration error', () => {
  assert.throws(
    () => resolveAppVariantConfig({ activeSetup, slug: 'missing-variant' }),
    /Invalid Slug "missing-variant". Expected one of: first-tenant, second-tenant/,
  );
});

test('selected App Variant with missing required assets fails clearly', () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'app-variant-assets-'));

  try {
    assert.throws(
      () =>
        resolveAppVariantConfig({
          activeSetup,
          slug: 'first-tenant',
          projectRoot,
        }),
      /Missing required App Variant asset "assets\/first-tenant\/icons\/icon\.png" for Slug "first-tenant"/,
    );
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('Active Setup Manifest rejects duplicate App Variant IDs', () => {
  assert.throws(
    () =>
      defineActiveSetup({
        setupType: 'white-label-apps',
        appVariants: [
          {
            ...activeSetup.appVariants[0],
            appVariantId: 1,
          },
          {
            ...activeSetup.appVariants[1],
            appVariantId: 1,
          },
        ],
      }),
    /Duplicate App Variant ID "1" in Active Setup Manifest/,
  );
});
