import { assert, test } from 'vitest';

import type { GeneratedAppOptions } from '@tenkit/types/generated-app-option-definitions';
import { SUPPORTED_GENERATED_SETUP_TYPE_IDS } from '@tenkit/types/setup-type-definitions';
import { SUPPORTED_GENERATED_STYLING_CHOICES } from '@tenkit/types/styling-definitions';

import { generateProject } from '../src/generator';
import type { VirtualFileTree } from '../src/virtual-file-tree';
import { assertClerkProtectedRoutes } from './clerk-generated-project-test-helpers';

const EXPRESS_CLERK_POSTGRESQL_DRIZZLE_OPTIONS = {
  backend: 'express',
  auth: 'clerk',
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
    workspaces?: string[];
  };
}

test('generates the Express Clerk PostgreSQL Drizzle contract for every Setup Type', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const tree = generateProject({
      setupType,
      stylingChoice: 'bare',
      packageManager: 'pnpm',
      generatedAppOptions: EXPRESS_CLERK_POSTGRESQL_DRIZZLE_OPTIONS,
    });
    const paths = tree.map(({ path }) => path);
    const rootManifest = readVirtualManifest(tree, 'package.json');
    const serverManifest = readVirtualManifest(tree, 'apps/server/package.json');
    const databaseManifest = readVirtualManifest(tree, 'packages/db/package.json');
    const rootLayout = readVirtualText(tree, 'src/app/_layout.tsx');
    const mobileRequest = readVirtualText(tree, 'src/business-data/use-business-profile.ts');
    const expressApp = readVirtualText(tree, 'apps/server/src/app.ts');
    const drizzleSchema = readVirtualText(tree, 'packages/db/src/schema.ts');
    const migration = readVirtualText(tree, 'packages/db/drizzle/0000_init.sql');
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
      'packages/db/drizzle.config.ts',
      'packages/db/drizzle/0000_init.sql',
      'packages/db/src/repository.ts',
      'src/app/(auth)/_layout.tsx',
      'src/app/(auth)/sign-in.tsx',
      'src/app/(auth)/sign-up.tsx',
      'src/auth/clerk-business-profile-client.ts',
      'src/auth/clerk-provider.tsx',
      'src/auth/use-clerk-auth-form.ts',
    ]);
    assert.notInclude(paths, 'packages/auth/package.json');

    assert.equal(rootManifest.dependencies['@clerk/expo'], '4.2.1');
    assert.equal(rootManifest.dependencies['expo-secure-store'], '~57.0.1');
    assert.equal(serverManifest.dependencies['@clerk/express'], '2.1.50');
    assert.equal(serverManifest.dependencies['@tenkit/db'], 'workspace:*');
    assert.equal(databaseManifest.dependencies['drizzle-orm'], '0.45.2');
    assert.equal(databaseManifest.dependencies.pg, '8.16.3');
    assert.equal(databaseManifest.devDependencies['drizzle-kit'], '0.31.10');
    assert.equal(rootManifest.workspaces, undefined);
    assert.equal(
      rootManifest.scripts.build,
      'pnpm --dir packages/db run build && pnpm --dir apps/server run build',
    );
    assert.match(readVirtualText(tree, 'pnpm-workspace.yaml'), /- 'packages\/db'/);
    assert.notMatch(readVirtualText(tree, 'pnpm-workspace.yaml'), /packages\/auth/);

    assert.match(readVirtualText(tree, '.env.example'), /EXPO_PUBLIC_API_URL=/);
    assert.match(readVirtualText(tree, '.env.example'), /EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_/);
    assert.equal(
      readVirtualText(tree, 'apps/server/.env.example'),
      'PORT=3000\nCLIENT_ORIGIN=http://localhost:8081\nDATABASE_URL=postgresql://postgres:password@localhost:5432/tenkit\nCLERK_PUBLISHABLE_KEY=pk_test_replace_me\nCLERK_SECRET_KEY=sk_test_replace_me\n',
    );

    assert.match(rootLayout, /ClerkAppProvider/);
    assert.match(rootLayout, /Stack\.Protected/);
    assert.match(mobileRequest, /getToken/);
    assert.match(mobileRequest, /requestClerkBusinessProfile/);
    assert.match(readVirtualText(tree, 'src/auth/use-clerk-auth-form.ts'), /sendEmailCode/);
    assert.match(readVirtualText(tree, 'src/auth/use-clerk-auth-form.ts'), /verifyEmailCode/);

    assert.ok(expressApp.indexOf('clerkMiddleware()') < expressApp.indexOf('cors('));
    assert.match(expressApp, /getAuth\(request\)/);
    assert.match(expressApp, /status\(401\)/);
    assert.match(
      readVirtualText(tree, 'apps/server/src/server.ts'),
      /createPostgresqlDrizzleDatabase/,
    );
    assert.match(
      readVirtualText(tree, 'apps/server/src/server.ts'),
      /businessDataRepository\.close/,
    );
    assert.match(readVirtualText(tree, 'apps/server/tests/app.test.ts'), /authenticated/);
    assert.match(
      readVirtualText(tree, 'apps/server/tests/integration.test.ts'),
      /inspectPostgresqlTableNames/,
    );

    assert.match(drizzleSchema, /pgTable\('app_variant'/);
    assert.match(drizzleSchema, /pgTable\('runtime_tenant'/);
    assert.deepEqual(Object.keys(drizzleSnapshot.tables).sort(), [
      'public.app_variant',
      'public.app_variant_runtime_tenant_access',
      'public.runtime_tenant',
    ]);
    assert.notMatch(drizzleSchema, /export const (user|session|account|verification)/);
    assert.notMatch(migration, /CREATE TABLE "(user|session|account|verification)"/);
    assert.match(readVirtualText(tree, 'README.md'), /Email verification/);
    assert.match(readVirtualText(tree, 'README.md'), /PostgreSQL and Drizzle/);
    assert.match(generatedText, /Auth: clerk/);
    assert.notMatch(
      generatedText,
      /better-auth|packages\/auth|prisma|mysql2|nestjs|convex|prototype/i,
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
      generatedAppOptions: EXPRESS_CLERK_POSTGRESQL_DRIZZLE_OPTIONS,
    });

    assert.match(readVirtualText(tree, 'src/auth/auth-form.tsx'), stylingSignatures[stylingChoice]);
    assert.match(
      readVirtualText(tree, 'src/auth/sign-out-button.tsx'),
      stylingSignatures[stylingChoice],
    );
  }
});

test('protects every Setup Type route set across every Styling Choice', () => {
  assertClerkProtectedRoutes(EXPRESS_CLERK_POSTGRESQL_DRIZZLE_OPTIONS);
});
