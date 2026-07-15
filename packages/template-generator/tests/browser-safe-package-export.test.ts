import { readFile } from 'node:fs/promises';
import { assert, test } from 'vitest';

type SetupTypeDefinitionsModule = {
  GENERATED_SETUP_TYPE_DEFINITIONS: readonly unknown[];
  deriveAppVariantIdentity: (appVariantName: string) => { slug: string };
  getGeneratedSetupTypeDefinition: (setupType: string) => unknown;
  getGeneratedSetupTypeDefinitionByPublicSlug: (publicSlug: string) => unknown;
};

type StylingDefinitionsModule = {
  SUPPORTED_GENERATED_STYLING_CHOICES: readonly string[];
  normalizeGeneratedStylingChoice: (value: string | undefined) => string;
};

function isSetupTypeDefinitionsModule(value: unknown): value is SetupTypeDefinitionsModule {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return (
    'GENERATED_SETUP_TYPE_DEFINITIONS' in value &&
    Array.isArray(value.GENERATED_SETUP_TYPE_DEFINITIONS) &&
    'deriveAppVariantIdentity' in value &&
    typeof value.deriveAppVariantIdentity === 'function' &&
    'getGeneratedSetupTypeDefinition' in value &&
    typeof value.getGeneratedSetupTypeDefinition === 'function' &&
    'getGeneratedSetupTypeDefinitionByPublicSlug' in value &&
    typeof value.getGeneratedSetupTypeDefinitionByPublicSlug === 'function'
  );
}

function isStylingDefinitionsModule(value: unknown): value is StylingDefinitionsModule {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return (
    'SUPPORTED_GENERATED_STYLING_CHOICES' in value &&
    Array.isArray(value.SUPPORTED_GENERATED_STYLING_CHOICES) &&
    'normalizeGeneratedStylingChoice' in value &&
    typeof value.normalizeGeneratedStylingChoice === 'function'
  );
}

test('loads the browser-safe Setup Type definitions package subpath without runtime imports', async () => {
  const publicModuleUrl = import.meta.resolve('@tenkit/template-generator/setup-type-definitions');
  const publicModuleSource = await readFile(new URL(publicModuleUrl), 'utf8');
  const publicModule: unknown = await import(publicModuleUrl);

  assert.ok(isSetupTypeDefinitionsModule(publicModule));
  assert.equal(publicModule.GENERATED_SETUP_TYPE_DEFINITIONS.length, 3);
  assert.equal(publicModule.deriveAppVariantIdentity('My App').slug, 'my-app');
  assert.equal(
    publicModule.getGeneratedSetupTypeDefinition('white-label-apps'),
    publicModule.getGeneratedSetupTypeDefinitionByPublicSlug('white-label'),
  );
  assert.notMatch(publicModuleSource, /^import\s/m);
  assert.notMatch(
    publicModuleSource,
    /node:|fs-extra|handlebars|pathe|generated-setup-types|writer/,
  );
});

test('loads the browser-safe Styling definitions package subpath without generation-runtime imports', async () => {
  const publicModuleUrl = import.meta.resolve('@tenkit/template-generator/styling-definitions');
  const publicModuleSource = await readFile(new URL(publicModuleUrl), 'utf8');
  const publicModule: unknown = await import(publicModuleUrl);

  assert.ok(isStylingDefinitionsModule(publicModule));
  assert.deepEqual(publicModule.SUPPORTED_GENERATED_STYLING_CHOICES, [
    'bare',
    'uniwind',
    'unistyles',
  ]);
  assert.equal(publicModule.normalizeGeneratedStylingChoice(undefined), 'bare');
  assert.equal(publicModule.normalizeGeneratedStylingChoice('uniwind'), 'uniwind');
  assert.equal(publicModule.normalizeGeneratedStylingChoice('unistyles'), 'unistyles');
  assert.throws(
    () => publicModule.normalizeGeneratedStylingChoice('nativewind'),
    /Unsupported generated Styling Choice "nativewind".*Expected one of: bare, uniwind, unistyles/,
  );
  assert.notMatch(publicModuleSource, /^import\s/m);
  assert.notMatch(
    publicModuleSource,
    /node:|fs-extra|handlebars|pathe|template-reader|writer|generator/,
  );
});
