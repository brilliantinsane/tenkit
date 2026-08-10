import { assert, test } from 'vitest';

import type { GeneratedAppOptions } from '@tenkit/types/generated-app-option-definitions';
import { SUPPORTED_GENERATED_SETUP_TYPE_IDS } from '@tenkit/types/setup-type-definitions';

import { generateProject } from '../src/generator';
import type { VirtualFileTree } from '../src/virtual-file-tree';

const EXPRESS_POSTGRESQL_PRISMA_OPTIONS = {
  backend: 'express',
  auth: 'none',
  database: 'postgresql',
  orm: 'prisma',
} as const satisfies GeneratedAppOptions;

function readVirtualText(tree: VirtualFileTree, path: string): string {
  const file = tree.find((candidate) => candidate.path === path);
  if (!file || typeof file.contents !== 'string') {
    throw new Error(`Missing generated text file ${path}.`);
  }

  return file.contents;
}

function readVirtualManifest(
  tree: VirtualFileTree,
  path: string,
): {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  workspaces?: string[];
} {
  return JSON.parse(readVirtualText(tree, path)) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    scripts: Record<string, string>;
    workspaces?: string[];
  };
}

test('generates the exact Auth-free Express PostgreSQL Prisma shape for every Setup Type', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const tree = generateProject({
      setupType,
      stylingChoice: 'bare',
      packageManager: 'pnpm',
      generatedAppOptions: EXPRESS_POSTGRESQL_PRISMA_OPTIONS,
    });
    const paths = tree.map(({ path }) => path);
    const rootManifest = readVirtualManifest(tree, 'package.json');
    const serverManifest = readVirtualManifest(tree, 'apps/server/package.json');
    const databaseManifest = readVirtualManifest(tree, 'packages/db/package.json');
    const generatedText = tree
      .flatMap(({ contents }) => (typeof contents === 'string' ? [contents] : []))
      .join('\n');

    assert.deepEqual(
      paths,
      [...paths].sort((left, right) => left.localeCompare(right)),
    );
    assert.includeMembers(paths, [
      'packages/db/POSTGRESQL.md',
      'packages/db/package.json',
      'packages/db/prisma.config.ts',
      'packages/db/prisma/migrations/20260810000000_init/migration.sql',
      'packages/db/prisma/migrations/migration_lock.toml',
      'packages/db/prisma/schema.prisma',
      'packages/db/src/index.ts',
      'packages/db/src/repository.ts',
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
      '@prisma/adapter-pg': '7.5.0',
      '@prisma/client': '7.5.0',
      dotenv: '^17.4.2',
      pg: '8.16.3',
    });
    assert.deepEqual(databaseManifest.devDependencies, {
      '@types/node': '^25.9.3',
      '@types/pg': '8.16.0',
      prisma: '7.5.0',
      tsx: '^4.22.4',
      typescript: '~6.0.3',
      vitest: '^4.1.9',
    });
    assert.deepEqual(databaseManifest.scripts, {
      build: 'tsc -p tsconfig.json',
      generate: 'prisma generate',
      migrate: 'prisma migrate deploy',
      seed: 'tsx src/seed.ts',
      setup: 'prisma generate && prisma migrate deploy && tsx src/seed.ts && tsc -p tsconfig.json',
      test: 'vitest run tests/repository.test.ts',
      typecheck: 'tsc --noEmit --pretty false',
    });

    assert.equal(rootManifest.scripts['db:generate'], 'pnpm --dir packages/db run generate');
    assert.equal(rootManifest.scripts['db:migrate'], 'pnpm --dir packages/db run migrate');
    assert.equal(rootManifest.scripts['db:seed'], 'pnpm --dir packages/db run seed');
    assert.equal(rootManifest.scripts['db:setup'], 'pnpm --dir packages/db run setup');
    assert.equal(
      rootManifest.scripts.build,
      'pnpm --dir packages/db run build && pnpm --dir apps/server run build',
    );
    assert.equal(
      rootManifest.scripts.test,
      'pnpm --dir packages/db run test && pnpm --dir apps/server run test',
    );
    assert.equal(
      rootManifest.scripts.typecheck,
      'tsc --noEmit --pretty false && pnpm --dir packages/db run typecheck && pnpm --dir apps/server run typecheck',
    );

    assert.equal(
      readVirtualText(tree, 'apps/server/.env.example'),
      'PORT=3000\nCLIENT_ORIGIN=http://localhost:8081\nDATABASE_URL=postgresql://postgres:password@localhost:5432/tenkit\n',
    );
    assert.match(readVirtualText(tree, 'pnpm-workspace.yaml'), /- 'packages\/db'/);
    assert.match(readVirtualText(tree, 'pnpm-workspace.yaml'), /'@prisma\/engines': true/);
    assert.match(readVirtualText(tree, '.gitignore'), /packages\/db\/src\/generated\//);
    assert.match(
      readVirtualText(tree, 'packages/db/prisma/schema.prisma'),
      /provider = "postgresql"/,
    );
    assert.match(
      readVirtualText(tree, 'packages/db/prisma.config.ts'),
      /databaseUrl \? \{ datasource: \{ url: databaseUrl \} \} : \{\}/,
    );
    assert.match(
      readVirtualText(tree, 'packages/db/prisma.config.ts'),
      /config\(\{ path: '\.\.\/\.\.\/apps\/server\/\.env\.local', quiet: true \}\)/,
    );
    assert.notMatch(readVirtualText(tree, 'packages/db/prisma.config.ts'), /env\('DATABASE_URL'\)/);
    assert.match(
      readVirtualText(tree, 'packages/db/src/seed.ts'),
      /config\(\{ path: '\.\.\/\.\.\/apps\/server\/\.env\.local', quiet: true \}\)/,
    );
    assert.match(
      readVirtualText(tree, 'packages/db/prisma/migrations/20260810000000_init/migration.sql'),
      /CREATE TABLE "app_variant_runtime_tenant_access"/,
    );
    assert.match(readVirtualText(tree, 'apps/server/src/business-profile.ts'), /@tenkit\/db/);
    if (setupType === 'white-label-apps') {
      assert.notMatch(
        readVirtualText(tree, 'apps/server/src/business-profile.ts'),
        /Runtime Tenant context is required/,
      );
    }
    assert.match(
      readVirtualText(tree, 'apps/server/src/server.ts'),
      /businessDataRepository\.close/,
    );
    assert.match(readVirtualText(tree, 'README.md'), /pnpm run db:setup/);
    assert.match(readVirtualText(tree, 'README.md'), /PostgreSQL/);
    assert.match(generatedText, /Auth: none/);
    assert.notMatch(
      generatedText,
      /better-auth|CLERK_|drizzle|mysql2|packages\/auth|@clerk|sign-in|sign-up/i,
    );
  }
});
