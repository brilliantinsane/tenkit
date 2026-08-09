/// <reference types="node" />

import { fileURLToPath } from 'node:url';

import fs from 'fs-extra';
import { join, resolve } from 'pathe';
import { globSync } from 'tinyglobby';
import { assert, test } from 'vitest';

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const compatibilityModulePaths = new Set([
  'src/generated-setup-type-definitions.ts',
  'src/generated-styling-choices.ts',
]);

function readPackageSource(path: string): string {
  return fs.readFileSync(join(packageRoot, path), 'utf8');
}

test('Template generator implementation consumes shared definitions from @tenkit/types', () => {
  const implementationPaths = globSync('src/**/*.ts', {
    cwd: packageRoot,
    onlyFiles: true,
  }).filter((path) => !compatibilityModulePaths.has(path));
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

test('Template generator compatibility modules only re-export the canonical definitions', () => {
  assert.equal(
    readPackageSource('src/generated-setup-type-definitions.ts'),
    "export * from '@tenkit/types/setup-type-definitions';\n",
  );
  assert.equal(
    readPackageSource('src/generated-styling-choices.ts'),
    "export * from '@tenkit/types/styling-definitions';\n",
  );
});
