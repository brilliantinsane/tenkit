import { readFile } from 'node:fs/promises';
import { assert, test } from 'vitest';

test('loads only the intended browser-safe Setup Type entrypoint exports', async () => {
  const publicModuleUrl = import.meta.resolve('@tenkit/types/setup-type-definitions');
  const publicModuleSource = await readFile(new URL(publicModuleUrl), 'utf8');
  const publicModule: unknown = await import(publicModuleUrl);

  assert.ok(typeof publicModule === 'object' && publicModule !== null);
  assert.deepEqual(Object.keys(publicModule).sort(), [
    'GENERATED_SETUP_TYPE_DEFINITIONS',
    'SUPPORTED_GENERATED_SETUP_TYPES',
    'SUPPORTED_GENERATED_SETUP_TYPE_IDS',
    'SUPPORTED_PUBLIC_SETUP_SLUGS',
    'deriveAppVariantIdentities',
    'deriveAppVariantIdentity',
    'derivePackageName',
    'getGeneratedSetupTypeDefinition',
    'getGeneratedSetupTypeDefinitionByPublicSlug',
    'normalizeProjectName',
    'validatePackageName',
  ]);
  assert.notMatch(publicModuleSource, /^import\s|^export\s.+\sfrom\s/m);
  assert.notMatch(publicModuleSource, /node:|fs-extra|handlebars|pathe|writer/);
});

test('loads only the intended browser-safe Styling entrypoint exports', async () => {
  const publicModuleUrl = import.meta.resolve('@tenkit/types/styling-definitions');
  const publicModuleSource = await readFile(new URL(publicModuleUrl), 'utf8');
  const publicModule: unknown = await import(publicModuleUrl);

  assert.ok(typeof publicModule === 'object' && publicModule !== null);
  assert.deepEqual(Object.keys(publicModule).sort(), [
    'SUPPORTED_GENERATED_STYLING_CHOICES',
    'normalizeGeneratedStylingChoice',
  ]);
  assert.notMatch(publicModuleSource, /^import\s|^export\s.+\sfrom\s/m);
  assert.notMatch(publicModuleSource, /node:|fs-extra|handlebars|pathe|writer/);
});

test('loads only the intended browser-safe Generated App Option entrypoint exports', async () => {
  const publicModuleUrl = import.meta.resolve('@tenkit/types/generated-app-option-definitions');
  const publicModuleSource = await readFile(new URL(publicModuleUrl), 'utf8');
  const publicModule: unknown = await import(publicModuleUrl);

  assert.ok(typeof publicModule === 'object' && publicModule !== null);
  assert.deepEqual(Object.keys(publicModule).sort(), [
    'DEFAULT_GENERATED_APP_OPTIONS',
    'SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS',
    'SUPPORTED_GENERATED_AUTH_VALUES',
    'SUPPORTED_GENERATED_BACKEND_VALUES',
    'SUPPORTED_GENERATED_DATABASE_VALUES',
    'SUPPORTED_GENERATED_ORM_VALUES',
    'getGeneratedAppOptionChoiceState',
    'resolveGeneratedAppOptions',
  ]);
  assert.notMatch(publicModuleSource, /^import\s|^export\s.+\sfrom\s/m);
  assert.notMatch(publicModuleSource, /node:|fs-extra|handlebars|pathe|writer/);
});

test('declares no transitive runtime dependencies', async () => {
  const packageMetadata = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8'),
  ) as Record<string, unknown>;

  assert.notProperty(packageMetadata, 'dependencies');
  assert.deepEqual(packageMetadata.exports, {
    './generated-app-option-definitions': './dist/generated-app-option-definitions.mjs',
    './setup-type-definitions': './dist/setup-type-definitions.mjs',
    './styling-definitions': './dist/styling-definitions.mjs',
  });
});
