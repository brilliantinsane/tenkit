/// <reference types="node" />

import { fileURLToPath } from 'node:url';

import fs from 'fs-extra';
import { join, resolve } from 'pathe';
import { globSync } from 'tinyglobby';
import { assert, test } from 'vitest';

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
function readPackageSource(path: string): string {
  return fs.readFileSync(join(packageRoot, path), 'utf8');
}

test('Template generator implementation consumes shared definitions from @tenkit/types', () => {
  const implementationPaths = globSync('src/**/*.ts', {
    cwd: packageRoot,
    onlyFiles: true,
  });
  const compatibilityImports = implementationPaths.filter((path) =>
    /from ['"]\.\/generated-(?:setup-type-definitions|styling-choices)['"]/.test(
      readPackageSource(path),
    ),
  );

  assert.deepEqual(compatibilityImports, []);
  assert.match(readPackageSource('src/generator.ts'), /@tenkit\/types\/setup-type-definitions/);
  assert.match(readPackageSource('src/generator.ts'), /@tenkit\/types\/styling-definitions/);
  assert.match(
    readPackageSource('src/generated-setup-types.ts'),
    /@tenkit\/types\/setup-type-definitions/,
  );
  assert.match(
    readPackageSource('src/generated-project-verification.ts'),
    /@tenkit\/types\/setup-type-definitions/,
  );
  assert.match(
    readPackageSource('src/template-reader.ts'),
    /@tenkit\/types\/(?:setup-type|styling)-definitions/,
  );
});

test('Template generator public interface excludes definitions owned by @tenkit/types', async () => {
  const packageMetadata = fs.readJsonSync(join(packageRoot, 'package.json')) as {
    exports: Record<string, string>;
    scripts: { build: string };
  };
  const publicModule = await import('@tenkit/template-generator');
  const generatorModule = await import('@tenkit/template-generator/generator');
  const publicDeclarationSources = [
    import.meta.resolve('@tenkit/template-generator'),
    import.meta.resolve('@tenkit/template-generator/generator'),
  ].map((moduleUrl) =>
    fs.readFileSync(fileURLToPath(moduleUrl.replace(/\.mjs$/, '.d.mts')), 'utf8'),
  );
  const sharedDefinitionExports = [
    'SUPPORTED_GENERATED_SETUP_TYPE_IDS',
    'SUPPORTED_GENERATED_SETUP_TYPES',
    'SUPPORTED_GENERATED_STYLING_CHOICES',
    'SUPPORTED_PUBLIC_SETUP_SLUGS',
    'normalizeGeneratedStylingChoice',
  ];

  assert.deepEqual(Object.keys(packageMetadata.exports).sort(), [
    '.',
    './generator',
    './local-proof',
    './writer',
  ]);
  assert.deepEqual(
    sharedDefinitionExports.filter((exportName) => exportName in publicModule),
    [],
  );
  assert.deepEqual(
    sharedDefinitionExports.filter((exportName) => exportName in generatorModule),
    [],
  );
  for (const declarationSource of publicDeclarationSources) {
    assert.notMatch(
      declarationSource,
      /\b(?:GeneratedSetupType|GeneratedSetupTypeInput|GeneratedStylingChoice|PublicSetupSlug)\b/,
    );
  }
  assert.notMatch(
    packageMetadata.scripts.build,
    /generated-(?:setup-type-definitions|styling-choices)\.ts/,
  );
  assert.deepEqual(
    globSync('src/generated-{setup-type-definitions,styling-choices}.ts', {
      cwd: packageRoot,
      onlyFiles: true,
    }),
    [],
  );
});
