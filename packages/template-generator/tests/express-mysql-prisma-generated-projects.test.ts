import { assert, test } from 'vitest';

import type { GeneratedAppOptions } from '@tenkit/types/generated-app-option-definitions';
import { SUPPORTED_GENERATED_SETUP_TYPE_IDS } from '@tenkit/types/setup-type-definitions';

import { generateProject } from '../src/generator';
import type { VirtualFileTree } from '../src/virtual-file-tree';

const EXPRESS_MYSQL_PRISMA_OPTIONS = {
  backend: 'express',
  auth: 'none',
  database: 'mysql',
  orm: 'prisma',
} as const satisfies GeneratedAppOptions;

function readVirtualText(tree: VirtualFileTree, path: string): string {
  const file = tree.find((candidate) => candidate.path === path);
  if (!file || typeof file.contents !== 'string') {
    throw new Error(`Missing generated text file ${path}.`);
  }
  return file.contents;
}

test('generates the exact Auth-free Express MySQL Prisma shape for every Setup Type', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const tree = generateProject({
      setupType,
      stylingChoice: 'bare',
      packageManager: 'pnpm',
      generatedAppOptions: EXPRESS_MYSQL_PRISMA_OPTIONS,
    });
    const paths = tree.map(({ path }) => path);
    const databaseManifest = JSON.parse(readVirtualText(tree, 'packages/db/package.json')) as {
      dependencies: Record<string, string>;
    };
    const generatedText = tree
      .flatMap(({ contents }) => (typeof contents === 'string' ? [contents] : []))
      .join('\n');

    assert.deepEqual(
      paths,
      [...paths].sort((left, right) => left.localeCompare(right)),
    );
    assert.includeMembers(paths, [
      'packages/db/MYSQL.md',
      'packages/db/prisma/migrations/20260810000000_init/migration.sql',
      'packages/db/prisma/schema.prisma',
      'packages/db/src/repository.ts',
    ]);
    assert.notInclude(paths, 'packages/auth/package.json');
    assert.notInclude(paths, 'packages/db/POSTGRESQL.md');
    assert.deepEqual(databaseManifest.dependencies, {
      '@prisma/adapter-mariadb': '7.5.0',
      '@prisma/client': '7.5.0',
      dotenv: '^17.4.2',
    });
    assert.equal(
      readVirtualText(tree, 'apps/server/.env.example'),
      'PORT=3000\nCLIENT_ORIGIN=http://localhost:8081\nDATABASE_URL=mysql://tenkit:password@localhost:3306/tenkit\n',
    );
    assert.match(readVirtualText(tree, 'packages/db/prisma/schema.prisma'), /provider = "mysql"/);
    assert.match(readVirtualText(tree, 'packages/db/src/repository.ts'), /PrismaMariaDb/);
    assert.match(
      readVirtualText(tree, 'packages/db/src/repository.ts'),
      /validateMysqlDatabaseUrl/,
    );
    assert.match(
      readVirtualText(tree, 'packages/db/prisma/migrations/20260810000000_init/migration.sql'),
      /DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci/,
    );
    assert.match(readVirtualText(tree, 'README.md'), /MySQL/);
    assert.match(generatedText, /Auth: none/);
    assert.notMatch(
      generatedText,
      /better-auth|CLERK_|drizzle|packages\/auth|@clerk|sign-in|sign-up|@prisma\/adapter-pg/i,
    );
  }
});
