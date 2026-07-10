import { readFile } from 'node:fs/promises';
import { assert, test } from 'vitest';

type SetupTypeDefinitionsModule = {
  GENERATED_SETUP_TYPE_DEFINITIONS: readonly unknown[];
  deriveAppVariantIdentity: (appVariantName: string) => { slug: string };
};

function isSetupTypeDefinitionsModule(value: unknown): value is SetupTypeDefinitionsModule {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return (
    'GENERATED_SETUP_TYPE_DEFINITIONS' in value &&
    Array.isArray(value.GENERATED_SETUP_TYPE_DEFINITIONS) &&
    'deriveAppVariantIdentity' in value &&
    typeof value.deriveAppVariantIdentity === 'function'
  );
}

test('loads the browser-safe Setup Type definitions package subpath without runtime imports', async () => {
  const publicModuleUrl = import.meta.resolve('@tenkit/template-generator/setup-type-definitions');
  const publicModuleSource = await readFile(new URL(publicModuleUrl), 'utf8');
  const publicModule: unknown = await import(publicModuleUrl);

  assert.ok(isSetupTypeDefinitionsModule(publicModule));
  assert.equal(publicModule.GENERATED_SETUP_TYPE_DEFINITIONS.length, 3);
  assert.equal(publicModule.deriveAppVariantIdentity('My App').slug, 'my-app');
  assert.notMatch(publicModuleSource, /^import\s/m);
  assert.notMatch(
    publicModuleSource,
    /node:|fs-extra|handlebars|pathe|generated-setup-types|writer/,
  );
});
