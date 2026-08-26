import { assert, test } from 'vitest';

import type { GeneratedAppOptions } from '@tenkit/types/generated-app-option-definitions';
import { SUPPORTED_GENERATED_SETUP_TYPE_IDS } from '@tenkit/types/setup-type-definitions';
import { SUPPORTED_GENERATED_STYLING_CHOICES } from '@tenkit/types/styling-definitions';

import { generateProject } from '../src/generator';
import type { VirtualFileTree } from '../src/virtual-file-tree';

const NESTJS_BETTER_AUTH_POSTGRESQL_PRISMA_OPTIONS = {
  backend: 'nestjs',
  auth: 'better-auth',
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

function readVirtualManifest(tree: VirtualFileTree, path: string) {
  return JSON.parse(readVirtualText(tree, path)) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    scripts: Record<string, string>;
  };
}

test('generates the NestJS Better Auth PostgreSQL Prisma contract for every Setup Type', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const tree = generateProject({
      setupType,
      stylingChoice: 'bare',
      packageManager: 'pnpm',
      generatedAppOptions: NESTJS_BETTER_AUTH_POSTGRESQL_PRISMA_OPTIONS,
    });
    const paths = tree.map(({ path }) => path);
    const rootManifest = readVirtualManifest(tree, 'package.json');
    const serverManifest = readVirtualManifest(tree, 'apps/server/package.json');
    const authManifest = readVirtualManifest(tree, 'packages/auth/package.json');
    const databaseManifest = readVirtualManifest(tree, 'packages/db/package.json');
    const rootLayout = readVirtualText(tree, 'src/app/_layout.tsx');
    const appModule = readVirtualText(tree, 'apps/server/src/app.module.ts');
    const main = readVirtualText(tree, 'apps/server/src/main.ts');
    const configureApplication = readVirtualText(tree, 'apps/server/src/configure-application.ts');
    const integrationTest = readVirtualText(tree, 'apps/server/tests/integration.test.ts');
    const generatedText = tree
      .flatMap(({ contents }) => (typeof contents === 'string' ? [contents] : []))
      .join('\n');

    assert.includeMembers(paths, [
      'packages/auth/package.json',
      'packages/auth/src/index.ts',
      'packages/db/package.json',
      'src/app/(auth)/sign-in.tsx',
      'src/app/(auth)/sign-up.tsx',
      'src/auth/auth-client.ts',
      'src/auth/better-auth-boundary.tsx',
    ]);
    assert.equal(rootManifest.dependencies['@better-auth/expo'], '1.6.25');
    assert.equal(serverManifest.dependencies['@tenkit/auth'], 'workspace:*');
    assert.equal(serverManifest.dependencies['@tenkit/db'], 'workspace:*');
    assert.equal(serverManifest.dependencies['@thallesp/nestjs-better-auth'], '2.7.0');
    assert.equal(serverManifest.dependencies['better-auth'], '1.6.25');
    assert.equal(authManifest.dependencies['@tenkit/db'], 'workspace:*');
    assert.equal(databaseManifest.dependencies['@prisma/client'], '7.5.0');
    assert.match(
      readVirtualText(tree, 'packages/auth/package.json'),
      /"development": "\.\/src\/index\.ts"/,
    );
    assert.match(
      readVirtualText(tree, 'packages/db/package.json'),
      /"development": "\.\/src\/index\.ts"/,
    );
    assert.equal(
      rootManifest.scripts.build,
      'pnpm --dir packages/db run build && pnpm --dir packages/auth run build && pnpm --dir apps/server run build',
    );
    assert.equal(
      readVirtualText(tree, 'apps/server/.env.example'),
      'PORT=3000\nCLIENT_ORIGIN=http://localhost:8081\nDATABASE_URL=postgresql://postgres:password@localhost:5432/tenkit\nBETTER_AUTH_URL=http://localhost:3000\nBETTER_AUTH_SECRET=replace-with-at-least-32-random-characters\n',
    );

    assert.match(appModule, /AuthModule\.forRootAsync/);
    assert.match(appModule, /TENKIT_AUTH/);
    assert.match(appModule, /createTenkitAuth/);
    assert.match(appModule, /onApplicationShutdown/);
    assert.match(appModule, /authRuntime\.close/);
    assert.match(main, /bodyParser: false/);
    assert.match(configureApplication, /credentials: true/);
    assert.match(rootLayout, /BetterAuthBoundary/);
    assert.match(readVirtualText(tree, 'packages/db/prisma/schema.prisma'), /model User/);
    assert.match(
      readVirtualText(tree, 'packages/db/prisma/migrations/20260810000000_init/migration.sql'),
      /CREATE TABLE "session"/,
    );
    assert.match(integrationTest, /sign-up\/email/);
    assert.match(integrationTest, /sign-in\/email/);
    assert.match(integrationTest, /get-session/);
    assert.match(integrationTest, /sign-out/);
    assert.match(
      integrationTest,
      setupType === 'white-label-apps'
        ? /White Label Apps do not accept Runtime Tenant context/
        : /Runtime Tenant is not allowed by this App Variant/,
    );
    assert.match(readVirtualText(tree, 'README.md'), /immediate durable session/);
    assert.match(generatedText, /Auth: better-auth/);
    assert.notMatch(generatedText, /CLERK_|@clerk|drizzle|mysql2|convex|fastify|prototype/i);
  }
});

test('protects every Setup Type route set across every Styling Choice with NestJS Better Auth', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const expectedSecondRoute = setupType === 'white-label-apps' ? 'explore' : 'settings';

    for (const stylingChoice of SUPPORTED_GENERATED_STYLING_CHOICES) {
      const tree = generateProject({
        setupType,
        stylingChoice,
        packageManager: 'pnpm',
        generatedAppOptions: NESTJS_BETTER_AUTH_POSTGRESQL_PRISMA_OPTIONS,
      });
      const authBoundary = readVirtualText(tree, 'src/auth/better-auth-boundary.tsx');

      assert.match(readVirtualText(tree, 'src/app/_layout.tsx'), /BetterAuthBoundary/);
      assert.match(authBoundary, /Stack\.Protected/);
      assert.match(authBoundary, /name="index"/);
      assert.match(authBoundary, new RegExp(`name="${expectedSecondRoute}"`));
    }
  }
});
