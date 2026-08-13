import { assert, test } from 'vitest';

import type { GeneratedAppOptions } from '@tenkit/types/generated-app-option-definitions';
import { SUPPORTED_GENERATED_SETUP_TYPE_IDS } from '@tenkit/types/setup-type-definitions';
import { SUPPORTED_GENERATED_STYLING_CHOICES } from '@tenkit/types/styling-definitions';

import { generateProject } from '../src/generator';
import type { VirtualFileTree } from '../src/virtual-file-tree';

const EXPRESS_BETTER_AUTH_POSTGRESQL_DRIZZLE_OPTIONS = {
  backend: 'express',
  auth: 'better-auth',
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
  };
}

test('generates the Express Better Auth PostgreSQL Drizzle contract for every Setup Type', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const tree = generateProject({
      setupType,
      stylingChoice: 'bare',
      packageManager: 'pnpm',
      generatedAppOptions: EXPRESS_BETTER_AUTH_POSTGRESQL_DRIZZLE_OPTIONS,
    });
    const rootManifest = readVirtualManifest(tree, 'package.json');
    const serverManifest = readVirtualManifest(tree, 'apps/server/package.json');
    const authManifest = readVirtualManifest(tree, 'packages/auth/package.json');
    const databaseManifest = readVirtualManifest(tree, 'packages/db/package.json');
    const drizzleSnapshot = JSON.parse(
      readVirtualText(tree, 'packages/db/drizzle/meta/0000_snapshot.json'),
    ) as { tables: Record<string, unknown> };
    const generatedText = tree
      .flatMap(({ contents }) => (typeof contents === 'string' ? [contents] : []))
      .join('\n');

    assert.equal(rootManifest.dependencies['@better-auth/expo'], '1.6.25');
    assert.equal(authManifest.dependencies['@better-auth/drizzle-adapter'], '1.6.25');
    assert.equal(authManifest.dependencies['@tenkit/db'], 'workspace:*');
    assert.equal(serverManifest.dependencies['@tenkit/auth'], 'workspace:*');
    assert.equal(databaseManifest.dependencies['drizzle-orm'], '0.45.2');
    assert.deepEqual(Object.keys(drizzleSnapshot.tables).sort(), [
      'public.account',
      'public.app_variant',
      'public.app_variant_runtime_tenant_access',
      'public.runtime_tenant',
      'public.session',
      'public.user',
      'public.verification',
    ]);
    assert.match(readVirtualText(tree, 'packages/auth/tsconfig.json'), /"skipLibCheck": true/);
    assert.match(readVirtualText(tree, 'packages/auth/src/index.ts'), /drizzleAdapter/);
    assert.match(readVirtualText(tree, 'packages/auth/src/index.ts'), /database: TenkitDatabase/);
    assert.match(readVirtualText(tree, 'packages/auth/src/index.ts'), /schema/);
    assert.match(readVirtualText(tree, 'packages/db/src/schema.ts'), /export const user/);
    assert.match(readVirtualText(tree, 'packages/db/src/schema.ts'), /export const session/);
    assert.match(readVirtualText(tree, 'packages/db/src/schema.ts'), /export const account/);
    assert.match(readVirtualText(tree, 'packages/db/src/schema.ts'), /export const verification/);
    assert.match(readVirtualText(tree, 'packages/db/drizzle/0000_init.sql'), /CREATE TABLE "user"/);
    assert.match(
      readVirtualText(tree, 'packages/db/drizzle/0000_init.sql'),
      /CREATE TABLE "session"/,
    );
    assert.match(readVirtualText(tree, 'src/app/_layout.tsx'), /BetterAuthBoundary/);
    assert.match(readVirtualText(tree, 'apps/server/src/app.ts'), /auth\.api\.getSession/);
    assert.match(
      readVirtualText(tree, 'apps/server/src/server.ts'),
      /createPostgresqlDrizzleDatabase/,
    );
    assert.match(readVirtualText(tree, 'apps/server/tests/integration.test.ts'), /sign-up\/email/);
    assert.match(readVirtualText(tree, 'README.md'), /immediate durable session/);
    assert.match(generatedText, /Auth: better-auth/);
    assert.notMatch(generatedText, /CLERK_|@clerk|prisma|mysql2|nestjs|convex|prototype/i);
  }
});

test('keeps Better Auth UI protected across every Setup Type and Styling Choice', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    for (const stylingChoice of SUPPORTED_GENERATED_STYLING_CHOICES) {
      const tree = generateProject({
        setupType,
        stylingChoice,
        packageManager: 'pnpm',
        generatedAppOptions: EXPRESS_BETTER_AUTH_POSTGRESQL_DRIZZLE_OPTIONS,
      });

      assert.match(readVirtualText(tree, 'src/app/_layout.tsx'), /BetterAuthBoundary/);
      assert.match(readVirtualText(tree, 'src/auth/better-auth-boundary.tsx'), /Stack\.Protected/);
      assert.match(readVirtualText(tree, 'src/auth/sign-out-button.tsx'), /signOut/);
    }
  }
});
