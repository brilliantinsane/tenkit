import { assert, test } from 'vitest';

import type { GeneratedAppOptions } from '@tenkit/types/generated-app-option-definitions';
import { SUPPORTED_GENERATED_SETUP_TYPE_IDS } from '@tenkit/types/setup-type-definitions';
import { SUPPORTED_GENERATED_STYLING_CHOICES } from '@tenkit/types/styling-definitions';

import { generateProject } from '../src/generator';
import type { VirtualFileTree } from '../src/virtual-file-tree';
import { assertClerkProtectedRoutes } from './clerk-generated-project-test-helpers';

const EXPRESS_CLERK_MYSQL_PRISMA_OPTIONS = {
  backend: 'express',
  auth: 'clerk',
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

test('generates the Express Clerk MySQL Prisma contract for every Setup Type', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const tree = generateProject({
      setupType,
      stylingChoice: 'bare',
      packageManager: 'pnpm',
      generatedAppOptions: EXPRESS_CLERK_MYSQL_PRISMA_OPTIONS,
    });
    const paths = tree.map(({ path }) => path);
    const serverManifest = JSON.parse(readVirtualText(tree, 'apps/server/package.json')) as {
      dependencies: Record<string, string>;
    };
    const databaseManifest = JSON.parse(readVirtualText(tree, 'packages/db/package.json')) as {
      dependencies: Record<string, string>;
    };
    const prismaSchema = readVirtualText(tree, 'packages/db/prisma/schema.prisma');
    const migration = readVirtualText(
      tree,
      'packages/db/prisma/migrations/20260810000000_init/migration.sql',
    );
    const generatedText = tree
      .flatMap(({ contents }) => (typeof contents === 'string' ? [contents] : []))
      .join('\n');

    assert.includeMembers(paths, [
      'packages/db/MYSQL.md',
      'packages/db/prisma/schema.prisma',
      'packages/db/src/repository.ts',
      'src/app/(auth)/sign-in.tsx',
      'src/app/(auth)/sign-up.tsx',
      'src/auth/clerk-provider.tsx',
    ]);
    assert.notInclude(paths, 'packages/auth/package.json');
    assert.notInclude(paths, 'packages/db/POSTGRESQL.md');
    assert.equal(serverManifest.dependencies['@clerk/express'], '2.1.50');
    assert.equal(serverManifest.dependencies['@tenkit/db'], 'workspace:*');
    assert.deepEqual(databaseManifest.dependencies, {
      '@prisma/adapter-mariadb': '7.5.0',
      '@prisma/client': '7.5.0',
      dotenv: '^17.4.2',
    });
    assert.equal(
      readVirtualText(tree, 'apps/server/.env.example'),
      'PORT=3000\nCLIENT_ORIGIN=http://localhost:8081\nDATABASE_URL=mysql://tenkit:password@localhost:3306/tenkit\nCLERK_PUBLISHABLE_KEY=pk_test_replace_me\nCLERK_SECRET_KEY=sk_test_replace_me\n',
    );
    assert.match(prismaSchema, /provider = "mysql"/);
    assert.notMatch(prismaSchema, /model (User|Session|Account|Verification)/);
    assert.match(migration, /DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci/);
    assert.notMatch(migration, /CREATE TABLE `(user|session|account|verification)`/);
    assert.match(readVirtualText(tree, 'apps/server/src/app.ts'), /clerkMiddleware\(\)/);
    assert.match(readVirtualText(tree, 'apps/server/src/app.ts'), /getAuth\(request\)/);
    assert.match(
      readVirtualText(tree, 'apps/server/src/server.ts'),
      /businessDataRepository\.close/,
    );
    assert.match(
      readVirtualText(tree, 'apps/server/tests/integration.test.ts'),
      /inspectMysqlTableNames/,
    );
    assert.match(readVirtualText(tree, 'README.md'), /Email verification/);
    assert.match(generatedText, /Auth: clerk/);
    assert.notMatch(
      generatedText,
      /better-auth|packages\/auth|@prisma\/adapter-pg|drizzle|nestjs|convex|prototype/i,
    );
  }
});

test('keeps Clerk routes protected across every Setup Type and Styling Choice', () => {
  for (const stylingChoice of SUPPORTED_GENERATED_STYLING_CHOICES) {
    const tree = generateProject({
      setupType: 'white-label-apps',
      stylingChoice,
      packageManager: 'pnpm',
      generatedAppOptions: EXPRESS_CLERK_MYSQL_PRISMA_OPTIONS,
    });

    assert.match(readVirtualText(tree, 'src/app/_layout.tsx'), /ClerkAppProvider/);
    assert.match(readVirtualText(tree, 'src/auth/sign-out-button.tsx'), /signOut/);
  }

  assertClerkProtectedRoutes(EXPRESS_CLERK_MYSQL_PRISMA_OPTIONS);
});
