import { assert, test } from 'vitest';

import type { GeneratedAppOptions } from '@tenkit/types/generated-app-option-definitions';
import { SUPPORTED_GENERATED_SETUP_TYPE_IDS } from '@tenkit/types/setup-type-definitions';

import { generateProject } from '../src/generator';
import type { VirtualFileTree } from '../src/virtual-file-tree';

const NESTJS_MYSQL_DRIZZLE_OPTIONS = {
  backend: 'nestjs',
  auth: 'none',
  database: 'mysql',
  orm: 'drizzle',
} as const satisfies GeneratedAppOptions;

function readVirtualText(tree: VirtualFileTree, path: string): string {
  const file = tree.find((candidate) => candidate.path === path);
  if (!file || typeof file.contents !== 'string') {
    throw new Error(`Missing generated text file ${path}.`);
  }

  return file.contents;
}

test('generates the exact Auth-free NestJS MySQL Drizzle shape for every Setup Type', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const tree = generateProject({
      setupType,
      stylingChoice: 'bare',
      packageManager: 'pnpm',
      generatedAppOptions: NESTJS_MYSQL_DRIZZLE_OPTIONS,
    });
    const paths = tree.map(({ path }) => path);
    const serverManifest = JSON.parse(readVirtualText(tree, 'apps/server/package.json')) as {
      dependencies: Record<string, string>;
    };
    const databaseManifest = JSON.parse(readVirtualText(tree, 'packages/db/package.json')) as {
      dependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    const drizzleSnapshot = JSON.parse(
      readVirtualText(tree, 'packages/db/drizzle/meta/0000_snapshot.json'),
    ) as { dialect: string; tables: Record<string, unknown> };
    const generatedText = tree
      .flatMap(({ contents }) => (typeof contents === 'string' ? [contents] : []))
      .join('\n');

    assert.includeMembers(paths, [
      'packages/db/MYSQL.md',
      'packages/db/drizzle.config.ts',
      'packages/db/drizzle/0000_init.sql',
      'packages/db/drizzle/meta/0000_snapshot.json',
      'packages/db/package.json',
      'packages/db/src/repository.ts',
      'packages/db/src/schema.ts',
      'packages/db/src/seed.ts',
    ]);
    assert.notInclude(paths, 'packages/auth/package.json');
    assert.notInclude(paths, 'packages/db/POSTGRESQL.md');
    assert.equal(serverManifest.dependencies['@tenkit/db'], 'workspace:*');
    assert.deepEqual(databaseManifest.dependencies, {
      'drizzle-orm': '0.45.2',
      dotenv: '^17.4.2',
      mysql2: '3.20.0',
    });
    assert.equal(
      databaseManifest.scripts.setup,
      'drizzle-kit migrate && tsx src/seed.ts && tsc -p tsconfig.json',
    );
    assert.equal(drizzleSnapshot.dialect, 'mysql');
    assert.deepEqual(Object.keys(drizzleSnapshot.tables).sort(), [
      'app_variant',
      'app_variant_runtime_tenant_access',
      'runtime_tenant',
    ]);
    assert.equal(
      readVirtualText(tree, 'apps/server/.env.example'),
      'PORT=3000\nCLIENT_ORIGIN=http://localhost:8081\nDATABASE_URL=mysql://tenkit:password@localhost:3306/tenkit\n',
    );
    assert.match(readVirtualText(tree, 'packages/db/drizzle.config.ts'), /dialect: 'mysql'/);
    assert.match(readVirtualText(tree, 'packages/db/src/schema.ts'), /mysqlTable/);
    assert.match(
      readVirtualText(tree, 'packages/db/src/repository.ts'),
      /createMysqlDrizzleDatabase/,
    );
    assert.match(
      readVirtualText(tree, 'apps/server/src/business-profile/business-profile.module.ts'),
      /createMysqlDrizzleDatabase/,
    );
    assert.match(
      readVirtualText(tree, 'apps/server/tests/integration.test.ts'),
      /inspectMysqlTableNames/,
    );
    assert.match(
      readVirtualText(tree, 'apps/server/tests/integration.test.ts'),
      /'__drizzle_migrations'/,
    );
    assert.match(readVirtualText(tree, 'README.md'), /MySQL and Drizzle/);
    assert.match(generatedText, /Auth: none/);
    assert.notMatch(
      generatedText,
      /better-auth|CLERK_|packages\/auth|@clerk|prisma|express Backend|convex|fastify|prototype/i,
    );
  }
});
