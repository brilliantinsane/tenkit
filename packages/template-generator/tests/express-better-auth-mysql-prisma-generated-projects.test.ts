import { assert, test } from 'vitest';

import type { GeneratedAppOptions } from '@tenkit/types/generated-app-option-definitions';
import { SUPPORTED_GENERATED_SETUP_TYPE_IDS } from '@tenkit/types/setup-type-definitions';
import { SUPPORTED_GENERATED_STYLING_CHOICES } from '@tenkit/types/styling-definitions';

import { generateProject } from '../src/generator';
import type { VirtualFileTree } from '../src/virtual-file-tree';

const EXPRESS_BETTER_AUTH_MYSQL_PRISMA_OPTIONS = {
  backend: 'express',
  auth: 'better-auth',
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

test('generates the Express Better Auth MySQL Prisma contract for every Setup Type', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const tree = generateProject({
      setupType,
      stylingChoice: 'bare',
      packageManager: 'pnpm',
      generatedAppOptions: EXPRESS_BETTER_AUTH_MYSQL_PRISMA_OPTIONS,
    });
    const paths = tree.map(({ path }) => path);
    const rootManifest = readVirtualManifest(tree, 'package.json');
    const serverManifest = readVirtualManifest(tree, 'apps/server/package.json');
    const authManifest = readVirtualManifest(tree, 'packages/auth/package.json');
    const databaseManifest = readVirtualManifest(tree, 'packages/db/package.json');
    const authSource = readVirtualText(tree, 'packages/auth/src/index.ts');
    const migration = readVirtualText(
      tree,
      'packages/db/prisma/migrations/20260810000000_init/migration.sql',
    );
    const generatedText = tree
      .flatMap(({ contents }) => (typeof contents === 'string' ? [contents] : []))
      .join('\n');

    assert.includeMembers(paths, [
      'packages/auth/package.json',
      'packages/auth/src/index.ts',
      'packages/db/MYSQL.md',
      'packages/db/prisma/schema.prisma',
      'src/app/(auth)/sign-in.tsx',
      'src/app/(auth)/sign-up.tsx',
      'src/auth/better-auth-boundary.tsx',
    ]);
    assert.notInclude(paths, 'packages/db/POSTGRESQL.md');
    assert.equal(rootManifest.dependencies['better-auth'], '1.6.25');
    assert.equal(serverManifest.dependencies['@tenkit/auth'], 'workspace:*');
    assert.equal(authManifest.dependencies['@tenkit/db'], 'workspace:*');
    assert.equal(authManifest.dependencies['better-auth'], '1.6.25');
    assert.deepEqual(databaseManifest.dependencies, {
      '@prisma/adapter-mariadb': '7.5.0',
      '@prisma/client': '7.5.0',
      dotenv: '^17.4.2',
    });
    assert.equal(
      readVirtualText(tree, 'apps/server/.env.example'),
      'PORT=3000\nCLIENT_ORIGIN=http://localhost:8081\nDATABASE_URL=mysql://tenkit:password@localhost:3306/tenkit\nBETTER_AUTH_URL=http://localhost:3000\nBETTER_AUTH_SECRET=replace-with-at-least-32-random-characters\n',
    );
    assert.match(authSource, /createMysqlPrismaClient/);
    assert.match(authSource, /prismaAdapter\(database, \{ provider: 'mysql' \}\)/);
    assert.notMatch(authSource, /createPostgresqlPrismaClient|provider: 'postgresql'/);
    assert.match(readVirtualText(tree, 'packages/db/prisma/schema.prisma'), /provider = "mysql"/);
    assert.match(migration, /CREATE TABLE `user`/);
    assert.match(migration, /CREATE TABLE `session`/);
    assert.match(migration, /CREATE TABLE `account`/);
    assert.match(migration, /CREATE TABLE `verification`/);
    assert.match(migration, /CONSTRAINT `session_userId_fkey`/);
    assert.match(migration, /CONSTRAINT `account_userId_fkey`/);
    assert.match(migration, /DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci/);
    assert.match(readVirtualText(tree, 'src/app/_layout.tsx'), /BetterAuthBoundary/);
    assert.match(readVirtualText(tree, 'apps/server/src/app.ts'), /auth\.api\.getSession/);
    assert.match(readVirtualText(tree, 'apps/server/tests/integration.test.ts'), /sign-up\/email/);
    assert.match(readVirtualText(tree, 'README.md'), /immediate durable session/);
    assert.match(generatedText, /Auth: better-auth/);
    assert.notMatch(
      generatedText,
      /CLERK_|@clerk|@prisma\/adapter-pg|drizzle|nestjs|convex|prototype/i,
    );
  }
});

test('keeps Better Auth UI protected across every Setup Type and Styling Choice', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    for (const stylingChoice of SUPPORTED_GENERATED_STYLING_CHOICES) {
      const tree = generateProject({
        setupType,
        stylingChoice,
        packageManager: 'pnpm',
        generatedAppOptions: EXPRESS_BETTER_AUTH_MYSQL_PRISMA_OPTIONS,
      });

      assert.match(readVirtualText(tree, 'src/app/_layout.tsx'), /BetterAuthBoundary/);
      assert.match(readVirtualText(tree, 'src/auth/better-auth-boundary.tsx'), /Stack\.Protected/);
      assert.match(readVirtualText(tree, 'src/auth/sign-out-button.tsx'), /signOut/);
    }
  }
});
