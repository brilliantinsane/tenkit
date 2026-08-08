import { assert, test } from 'vitest';

import {
  deriveAppVariantIdentities,
  deriveAppVariantIdentity,
  GENERATED_SETUP_TYPE_DEFINITIONS,
  getGeneratedSetupTypeDefinition,
  getGeneratedSetupTypeDefinitionByPublicSlug,
  normalizeProjectName,
} from '@tenkit/types/setup-type-definitions';

test('exposes canonical Setup Type definitions and fixed App Variant defaults', () => {
  assert.deepEqual(GENERATED_SETUP_TYPE_DEFINITIONS, [
    {
      setupType: 'white-label-apps',
      publicSlug: 'white-label',
      templatePath: 'white-label',
      defaultProjectName: 'Tenkit White Label App',
      defaultPackageName: 'tenkit-white-label-app',
      appVariants: [
        {
          appVariantId: 1,
          role: 'white-label',
          defaultName: 'First Tenant',
          defaultAccent: '#208AEF',
        },
        {
          appVariantId: 2,
          role: 'white-label',
          defaultName: 'Second Tenant',
          defaultAccent: '#EF8520',
        },
      ],
    },
    {
      setupType: 'single-app-runtime-tenants',
      publicSlug: 'runtime-tenants',
      templatePath: 'runtime-tenants',
      defaultProjectName: 'Tenkit Single App Runtime Tenants',
      defaultPackageName: 'tenkit-runtime-tenants',
      appVariants: [
        {
          appVariantId: 1,
          role: 'generic',
          defaultName: 'Acme App',
          defaultAccent: '#EB2556',
        },
      ],
    },
    {
      setupType: 'generic-with-standalone-app-variants',
      publicSlug: 'generic-standalone',
      templatePath: 'generic-standalone',
      defaultProjectName: 'Tenkit Generic With Standalone App Variants',
      defaultPackageName: 'tenkit-generic-standalone',
      appVariants: [
        {
          appVariantId: 1,
          role: 'generic',
          defaultName: 'Atlas Network',
          defaultAccent: '#20EF99',
        },
        {
          appVariantId: 2,
          role: 'standalone',
          defaultName: 'West Studio',
          defaultAccent: '#9A00CD',
        },
      ],
    },
  ]);

  const whiteLabelDefinition = GENERATED_SETUP_TYPE_DEFINITIONS[0];
  assert.equal(getGeneratedSetupTypeDefinition('white-label-apps'), whiteLabelDefinition);
  assert.equal(getGeneratedSetupTypeDefinitionByPublicSlug('white-label'), whiteLabelDefinition);
  assert.equal(normalizeProjectName('  My Néw, Fancy App!  '), 'my-new-fancy-app');
  assert.deepEqual(deriveAppVariantIdentity('  123 Štúdiø  '), {
    displayName: '123 Štúdiø',
    slug: 'app-123-studio',
    scheme: 'app123studio',
    bundleIdentifier: 'com.example.app123studio',
    packageName: 'com.example.app123studio',
    hasNumericPrefix: true,
  });
  assert.throws(
    () => deriveAppVariantIdentities(['Cool App', 'Cool-App']),
    /duplicate derived App Variant identity.*cool-app/i,
  );
});
