/// <reference types="node" />

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { join, relative, resolve } from 'pathe';
import { assert, test } from 'vitest';

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

function listTypeScriptFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return listTypeScriptFiles(path);
    }

    return entry.isFile() && path.endsWith('.ts') ? [path] : [];
  });
}

test('Public CLI consumes shared definitions from @tenkit/types', () => {
  const ownershipPaths = [
    ...listTypeScriptFiles(join(packageRoot, 'src')),
    join(packageRoot, 'tsconfig.json'),
    join(packageRoot, 'vitest.config.ts'),
  ];
  const compatibilityConsumers = ownershipPaths
    .filter((path) =>
      /@tenkit\/template-generator\/(?:setup-type-definitions|styling-definitions)/.test(
        readFileSync(path, 'utf8'),
      ),
    )
    .map((path) => relative(packageRoot, path));

  assert.deepEqual(compatibilityConsumers, []);
  assert.match(
    readFileSync(join(packageRoot, 'tsconfig.json'), 'utf8'),
    /@tenkit\/types\/generated-app-option-definitions/,
  );
  assert.match(
    readFileSync(join(packageRoot, 'tsconfig.json'), 'utf8'),
    /@tenkit\/types\/setup-type-definitions/,
  );
  assert.match(
    readFileSync(join(packageRoot, 'tsconfig.json'), 'utf8'),
    /@tenkit\/types\/styling-definitions/,
  );
  assert.match(
    readFileSync(join(packageRoot, 'vitest.config.ts'), 'utf8'),
    /@tenkit\/types\/generated-app-option-definitions/,
  );
  assert.match(
    readFileSync(join(packageRoot, 'vitest.config.ts'), 'utf8'),
    /@tenkit\/types\/setup-type-definitions/,
  );
  assert.match(
    readFileSync(join(packageRoot, 'vitest.config.ts'), 'utf8'),
    /@tenkit\/types\/styling-definitions/,
  );
});
