import { assert, test } from 'vitest';

import type { GeneratedAppOptions } from '@tenkit/types/generated-app-option-definitions';
import { SUPPORTED_GENERATED_SETUP_TYPE_IDS } from '@tenkit/types/setup-type-definitions';

import { generateProject } from '../src/generator';
import type { VirtualFileTree } from '../src/virtual-file-tree';

const EXPRESS_POSTGRESQL_DRIZZLE_OPTIONS = {
  backend: 'express',
  auth: 'none',
  database: 'postgresql',
  orm: 'drizzle',
} as const satisfies GeneratedAppOptions;

function readVirtualText(tree: VirtualFileTree, path: string): string {
  const file = tree.find((candidate) => candidate.path === path);
  if (!file || typeof file.contents !== 'string') {
    throw new Error(`Missing generated text file ${path}.`);
  }

  return file.contents;
}

function readVirtualManifest(tree: VirtualFileTree, path: string) {
  return JSON.parse(readVirtualText(tree, path)) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    scripts: Record<string, string>;
  };
}

test('generates the exact Auth-free Express PostgreSQL Drizzle shape for every Setup Type', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const tree = generateProject({
      setupType,
      stylingChoice: 'bare',
      packageManager: 'pnpm',
      generatedAppOptions: EXPRESS_POSTGRESQL_DRIZZLE_OPTIONS,
    });
    const paths = tree.map(({ path }) => path);
    const rootManifest = readVirtualManifest(tree, 'package.json');
    const serverManifest = readVirtualManifest(tree, 'apps/server/package.json');
    const databaseManifest = readVirtualManifest(tree, 'packages/db/package.json');
    const drizzleSnapshot = JSON.parse(
      readVirtualText(tree, 'packages/db/drizzle/meta/0000_snapshot.json'),
    ) as { tables: Record<string, unknown> };
    const generatedText = tree
      .flatMap(({ contents }) => (typeof contents === 'string' ? [contents] : []))
      .join('\n');

    assert.deepEqual(
      paths,
      [...paths].sort((left, right) => left.localeCompare(right)),
    );
    assert.includeMembers(paths, [
      'packages/db/POSTGRESQL.md',
      'packages/db/drizzle.config.ts',
      'packages/db/drizzle/0000_init.sql',
      'packages/db/drizzle/meta/0000_snapshot.json',
      'packages/db/drizzle/meta/_journal.json',
      'packages/db/package.json',
      'packages/db/src/index.ts',
      'packages/db/src/repository.ts',
      'packages/db/src/schema.ts',
      'packages/db/src/seed.ts',
      'packages/db/src/starter-data.ts',
      'packages/db/tests/repository.test.ts',
      'packages/db/tsconfig.json',
    ]);
    assert.notInclude(paths, 'packages/auth/package.json');

    assert.deepEqual(serverManifest.dependencies, {
      '@tenkit/db': 'workspace:*',
      cors: '^2.8.5',
      dotenv: '^17.4.2',
      express: '^5.2.1',
      zod: '^4.4.3',
    });
    assert.deepEqual(databaseManifest.dependencies, {
      'drizzle-orm': '0.45.2',
      dotenv: '^17.4.2',
      pg: '8.16.3',
    });
    assert.deepEqual(databaseManifest.devDependencies, {
      '@types/node': '^25.9.3',
      '@types/pg': '8.16.0',
      'drizzle-kit': '0.31.10',
      tsx: '^4.22.4',
      typescript: '~6.0.3',
      vitest: '^4.1.9',
    });
    assert.deepEqual(databaseManifest.scripts, {
      build: 'tsc -p tsconfig.json',
      generate: 'drizzle-kit generate',
      migrate: 'drizzle-kit migrate',
      seed: 'tsx src/seed.ts',
      setup: 'drizzle-kit migrate && tsx src/seed.ts && tsc -p tsconfig.json',
      test: 'vitest run tests/repository.test.ts',
      typecheck: 'tsc --noEmit --pretty false',
    });
    assert.deepEqual(Object.keys(drizzleSnapshot.tables).sort(), [
      'public.app_variant',
      'public.app_variant_runtime_tenant_access',
      'public.runtime_tenant',
    ]);

    assert.equal(rootManifest.scripts['db:generate'], 'pnpm --dir packages/db run generate');
    assert.equal(rootManifest.scripts['db:migrate'], 'pnpm --dir packages/db run migrate');
    assert.equal(rootManifest.scripts['db:seed'], 'pnpm --dir packages/db run seed');
    assert.equal(rootManifest.scripts['db:setup'], 'pnpm --dir packages/db run setup');
    assert.match(readVirtualText(tree, 'pnpm-workspace.yaml'), /- 'packages\/db'/);
    assert.match(readVirtualText(tree, 'packages/db/drizzle.config.ts'), /dialect: 'postgresql'/);
    assert.match(
      readVirtualText(tree, 'packages/db/drizzle/0000_init.sql'),
      /CREATE TABLE "app_variant_runtime_tenant_access"/,
    );
    assert.match(readVirtualText(tree, 'packages/db/src/schema.ts'), /pgTable/);
    assert.match(readVirtualText(tree, 'packages/db/src/repository.ts'), /drizzle-orm/);
    assert.match(readVirtualText(tree, 'packages/db/tsconfig.json'), /"skipLibCheck": true/);
    assert.match(readVirtualText(tree, 'apps/server/tsconfig.json'), /"skipLibCheck": true/);
    assert.match(readVirtualText(tree, 'apps/server/src/business-profile.ts'), /@tenkit\/db/);
    assert.match(
      readVirtualText(tree, 'apps/server/src/server.ts'),
      /businessDataRepository\.close/,
    );
    assert.match(readVirtualText(tree, 'README.md'), /PostgreSQL and Drizzle/);
    assert.match(generatedText, /Auth: none/);
    assert.notMatch(
      generatedText,
      /better-auth|CLERK_|mysql2|packages\/auth|@clerk|sign-in|sign-up|prisma/i,
    );
  }
});
