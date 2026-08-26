import { assert, test } from 'vitest';

import type { GeneratedAppOptions } from '@tenkit/types/generated-app-option-definitions';
import { SUPPORTED_GENERATED_SETUP_TYPE_IDS } from '@tenkit/types/setup-type-definitions';

import { generateProject } from '../src/generator';
import type { VirtualFileTree } from '../src/virtual-file-tree';

const NESTJS_MYSQL_PRISMA_OPTIONS = {
  backend: 'nestjs',
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

function readVirtualManifest(tree: VirtualFileTree, path: string) {
  return JSON.parse(readVirtualText(tree, path)) as {
    dependencies: Record<string, string>;
    scripts: Record<string, string>;
  };
}

test('generates the exact Auth-free NestJS MySQL Prisma shape for every Setup Type', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const tree = generateProject({
      setupType,
      stylingChoice: 'bare',
      packageManager: 'pnpm',
      generatedAppOptions: NESTJS_MYSQL_PRISMA_OPTIONS,
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
      'packages/db/MYSQL.md',
      'packages/db/prisma/migrations/20260810000000_init/migration.sql',
      'packages/db/prisma/schema.prisma',
      'packages/db/src/repository.ts',
      'packages/db/src/seed.ts',
    ]);
    assert.notInclude(paths, 'packages/auth/package.json');
    assert.notInclude(paths, 'packages/db/POSTGRESQL.md');

    assert.equal(serverManifest.dependencies['@tenkit/db'], 'workspace:*');
    assert.deepEqual(databaseManifest.dependencies, {
      '@prisma/adapter-mariadb': '7.5.0',
      '@prisma/client': '7.5.0',
      dotenv: '^17.4.2',
    });
    assert.equal(
      rootManifest.scripts.build,
      'pnpm --dir packages/db run build && pnpm --dir apps/server run build',
    );
    assert.equal(
      readVirtualText(tree, 'apps/server/.env.example'),
      'PORT=3000\nCLIENT_ORIGIN=http://localhost:8081\nDATABASE_URL=mysql://tenkit:password@localhost:3306/tenkit\n',
    );
    assert.match(
      readVirtualText(tree, 'apps/server/src/server-environment.ts'),
      /DATABASE_URL.*MySQL/s,
    );
    assert.match(
      readVirtualText(tree, 'apps/server/src/business-profile/business-profile.service.ts'),
      /BUSINESS_DATA_REPOSITORY.*await .*findAppVariant/s,
    );
    assert.match(
      readVirtualText(tree, 'apps/server/src/business-profile/business-profile.module.ts'),
      /createBusinessDataRepository.*onApplicationShutdown/s,
    );
    assert.match(readVirtualText(tree, 'packages/db/prisma/schema.prisma'), /provider = "mysql"/);
    assert.match(readVirtualText(tree, 'packages/db/src/repository.ts'), /PrismaMariaDb/);
    assert.match(
      readVirtualText(tree, 'packages/db/prisma/migrations/20260810000000_init/migration.sql'),
      /DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci/,
    );
    assert.match(
      readVirtualText(tree, 'apps/server/tests/integration.test.ts'),
      /inspectMysqlTableNames/,
    );
    assert.match(readVirtualText(tree, 'README.md'), /MySQL/);
    assert.match(generatedText, /Auth: none/);
    assert.notMatch(
      generatedText,
      /better-auth|CLERK_|drizzle|packages\/auth|@clerk|sign-in|sign-up|@prisma\/adapter-pg|fastify|prototype/i,
    );
  }
});
