import { assert, test } from 'vitest';

import type { GeneratedAppOptions } from '@tenkit/types/generated-app-option-definitions';
import { SUPPORTED_GENERATED_SETUP_TYPE_IDS } from '@tenkit/types/setup-type-definitions';
import { SUPPORTED_GENERATED_STYLING_CHOICES } from '@tenkit/types/styling-definitions';

import { generateProject } from '../src/generator';
import type { VirtualFileTree } from '../src/virtual-file-tree';
import { assertClerkProtectedRoutes } from './clerk-generated-project-test-helpers';

const OPTIONS = {
  backend: 'nestjs',
  auth: 'clerk',
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

test('generates the NestJS Clerk MySQL Drizzle contract for every Setup Type', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const tree = generateProject({
      setupType,
      stylingChoice: 'bare',
      packageManager: 'pnpm',
      generatedAppOptions: OPTIONS,
    });
    const paths = tree.map(({ path }) => path);
    const serverManifest = JSON.parse(readVirtualText(tree, 'apps/server/package.json')) as {
      dependencies: Record<string, string>;
    };
    const databaseManifest = JSON.parse(readVirtualText(tree, 'packages/db/package.json')) as {
      dependencies: Record<string, string>;
    };
    const drizzleSnapshot = JSON.parse(
      readVirtualText(tree, 'packages/db/drizzle/meta/0000_snapshot.json'),
    ) as { dialect: string; tables: Record<string, unknown> };
    const generatedText = tree
      .flatMap(({ contents }) => (typeof contents === 'string' ? [contents] : []))
      .join('\n');

    assert.deepEqual(
      paths,
      [...paths].sort((left, right) => left.localeCompare(right)),
    );
    assert.includeMembers(paths, [
      'packages/db/MYSQL.md',
      'packages/db/drizzle/0000_init.sql',
      'src/app/(auth)/sign-in.tsx',
      'src/app/(auth)/sign-up.tsx',
      'src/auth/clerk-provider.tsx',
    ]);
    assert.notInclude(paths, 'packages/auth/package.json');
    assert.notInclude(paths, 'packages/db/POSTGRESQL.md');
    assert.equal(serverManifest.dependencies['@clerk/express'], '2.1.50');
    assert.equal(serverManifest.dependencies['@tenkit/db'], 'workspace:*');
    assert.equal(databaseManifest.dependencies['drizzle-orm'], '0.45.2');
    assert.equal(databaseManifest.dependencies.mysql2, '3.20.0');
    assert.equal(drizzleSnapshot.dialect, 'mysql');
    assert.deepEqual(Object.keys(drizzleSnapshot.tables).sort(), [
      'app_variant',
      'app_variant_runtime_tenant_access',
      'runtime_tenant',
    ]);
    assert.equal(
      readVirtualText(tree, 'apps/server/.env.example'),
      'PORT=3000\nCLIENT_ORIGIN=http://localhost:8081\nDATABASE_URL=mysql://tenkit:password@localhost:3306/tenkit\nCLERK_PUBLISHABLE_KEY=pk_test_replace_me\nCLERK_SECRET_KEY=sk_test_replace_me\n',
    );
    assert.match(
      readVirtualText(tree, 'apps/server/src/configure-application.ts'),
      /clerkMiddleware\(\)/,
    );
    assert.match(
      readVirtualText(tree, 'apps/server/src/business-profile/business-profile.module.ts'),
      /createMysqlDrizzleDatabase/,
    );
    assert.match(
      readVirtualText(tree, 'apps/server/tests/integration.test.ts'),
      /inspectMysqlTableNames/,
    );
    assert.match(readVirtualText(tree, 'README.md'), /Email verification/);
    assert.match(readVirtualText(tree, 'README.md'), /MySQL and Drizzle/);
    assert.match(generatedText, /Auth: clerk/);
    assert.notMatch(
      generatedText,
      /better-auth|packages\/auth|prisma|express Backend|convex|fastify|prototype/i,
    );
  }
});

test('keeps Clerk Auth UI inside every selected Styling option layer', () => {
  const stylingSignatures = {
    bare: /@\/theme\/ThemeContext/,
    uniwind: /className=/,
    unistyles: /from 'react-native-unistyles'/,
  } as const;

  for (const stylingChoice of SUPPORTED_GENERATED_STYLING_CHOICES) {
    const tree = generateProject({
      setupType: 'white-label-apps',
      stylingChoice,
      packageManager: 'pnpm',
      generatedAppOptions: OPTIONS,
    });

    assert.match(readVirtualText(tree, 'src/auth/auth-form.tsx'), stylingSignatures[stylingChoice]);
    assert.match(
      readVirtualText(tree, 'src/auth/sign-out-button.tsx'),
      stylingSignatures[stylingChoice],
    );
  }
});

test('protects every Setup Type route set across every Styling Choice', () => {
  assertClerkProtectedRoutes(OPTIONS);
});
