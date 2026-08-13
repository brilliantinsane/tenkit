import { assert, test } from 'vitest';

import type { GeneratedAppOptions } from '@tenkit/types/generated-app-option-definitions';
import { SUPPORTED_GENERATED_SETUP_TYPE_IDS } from '@tenkit/types/setup-type-definitions';
import { SUPPORTED_GENERATED_STYLING_CHOICES } from '@tenkit/types/styling-definitions';

import { generateProject } from '../src/generator';
import type { VirtualFileTree } from '../src/virtual-file-tree';
import { assertClerkProtectedRoutes } from './clerk-generated-project-test-helpers';

const NESTJS_CLERK_MYSQL_PRISMA_OPTIONS = {
  backend: 'nestjs',
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

function readVirtualManifest(tree: VirtualFileTree, path: string) {
  return JSON.parse(readVirtualText(tree, path)) as {
    dependencies: Record<string, string>;
    scripts: Record<string, string>;
  };
}

test('generates the NestJS Clerk MySQL Prisma contract for every Setup Type', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const tree = generateProject({
      setupType,
      stylingChoice: 'bare',
      packageManager: 'pnpm',
      generatedAppOptions: NESTJS_CLERK_MYSQL_PRISMA_OPTIONS,
    });
    const paths = tree.map(({ path }) => path);
    const rootManifest = readVirtualManifest(tree, 'package.json');
    const serverManifest = readVirtualManifest(tree, 'apps/server/package.json');
    const databaseManifest = readVirtualManifest(tree, 'packages/db/package.json');
    const configureApplication = readVirtualText(tree, 'apps/server/src/configure-application.ts');
    const businessProfileController = readVirtualText(
      tree,
      'apps/server/src/business-profile/business-profile.controller.ts',
    );
    const businessProfileModule = readVirtualText(
      tree,
      'apps/server/src/business-profile/business-profile.module.ts',
    );
    const prismaSchema = readVirtualText(tree, 'packages/db/prisma/schema.prisma');
    const migration = readVirtualText(
      tree,
      'packages/db/prisma/migrations/20260810000000_init/migration.sql',
    );
    const generatedText = tree
      .flatMap(({ contents }) => (typeof contents === 'string' ? [contents] : []))
      .join('\n');

    assert.deepEqual(
      paths,
      [...paths].sort((left, right) => left.localeCompare(right)),
    );
    assert.includeMembers(paths, [
      'packages/db/MYSQL.md',
      'packages/db/prisma/schema.prisma',
      'packages/db/src/repository.ts',
      'src/app/(auth)/_layout.tsx',
      'src/app/(auth)/sign-in.tsx',
      'src/app/(auth)/sign-up.tsx',
      'src/auth/clerk-business-profile-client.ts',
      'src/auth/clerk-provider.tsx',
      'src/auth/sign-out-button.tsx',
      'src/auth/use-clerk-auth-form.ts',
    ]);
    assert.notInclude(paths, 'packages/auth/package.json');
    assert.notInclude(paths, 'packages/db/POSTGRESQL.md');

    assert.equal(rootManifest.dependencies['@clerk/expo'], '4.2.1');
    assert.equal(rootManifest.dependencies['expo-secure-store'], '~57.0.1');
    assert.equal(serverManifest.dependencies['@clerk/express'], '2.1.50');
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
    assert.match(readVirtualText(tree, 'pnpm-workspace.yaml'), /- 'packages\/db'/);
    assert.notMatch(readVirtualText(tree, 'pnpm-workspace.yaml'), /packages\/auth/);

    assert.equal(
      readVirtualText(tree, 'apps/server/.env.example'),
      'PORT=3000\nCLIENT_ORIGIN=http://localhost:8081\nDATABASE_URL=mysql://tenkit:password@localhost:3306/tenkit\nCLERK_PUBLISHABLE_KEY=pk_test_replace_me\nCLERK_SECRET_KEY=sk_test_replace_me\n',
    );
    assert.match(readVirtualText(tree, 'src/app/_layout.tsx'), /ClerkAppProvider/);
    assert.ok(
      configureApplication.indexOf('app.use(authenticationMiddleware)') <
        configureApplication.indexOf('app.enableCors'),
    );
    assert.match(configureApplication, /clerkMiddleware\(\)/);
    assert.match(businessProfileController, /ClerkAuthenticationService/);
    assert.match(businessProfileController, /UnauthorizedException/);
    assert.match(businessProfileModule, /createBusinessDataRepository/);
    assert.match(businessProfileModule, /onApplicationShutdown/);
    assert.match(businessProfileModule, /repository\.close/);
    assert.match(readVirtualText(tree, 'apps/server/tests/app.test.ts'), /authenticated/);
    assert.match(
      readVirtualText(tree, 'apps/server/tests/integration.test.ts'),
      /inspectMysqlTableNames/,
    );

    assert.match(prismaSchema, /provider = "mysql"/);
    assert.match(prismaSchema, /model AppVariant/);
    assert.match(prismaSchema, /model RuntimeTenant/);
    assert.notMatch(prismaSchema, /model (User|Session|Account|Verification)/);
    assert.match(migration, /DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci/);
    assert.notMatch(migration, /CREATE TABLE `(user|session|account|verification)`/);
    assert.match(readVirtualText(tree, 'README.md'), /Email verification/);
    assert.match(readVirtualText(tree, 'README.md'), /MySQL and Prisma/);
    assert.match(generatedText, /Auth: clerk/);
    assert.notMatch(
      generatedText,
      /better-auth|packages\/auth|@prisma\/adapter-pg|drizzle|express Backend|convex|fastify|prototype/i,
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
      generatedAppOptions: NESTJS_CLERK_MYSQL_PRISMA_OPTIONS,
    });
    assert.match(readVirtualText(tree, 'src/auth/auth-form.tsx'), stylingSignatures[stylingChoice]);
    assert.match(
      readVirtualText(tree, 'src/auth/sign-out-button.tsx'),
      stylingSignatures[stylingChoice],
    );
  }
});

test('protects every Setup Type route set across every Styling Choice', () => {
  assertClerkProtectedRoutes(NESTJS_CLERK_MYSQL_PRISMA_OPTIONS);
});
