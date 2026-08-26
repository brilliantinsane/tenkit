import { assert, test } from 'vitest';

import type { GeneratedAppOptions } from '@tenkit/types/generated-app-option-definitions';
import { SUPPORTED_GENERATED_SETUP_TYPE_IDS } from '@tenkit/types/setup-type-definitions';
import { SUPPORTED_GENERATED_STYLING_CHOICES } from '@tenkit/types/styling-definitions';

import { generateProject } from '../src/generator';
import type { VirtualFileTree } from '../src/virtual-file-tree';

const OPTIONS = {
  backend: 'nestjs',
  auth: 'better-auth',
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

function readVirtualManifest(tree: VirtualFileTree, path: string) {
  return JSON.parse(readVirtualText(tree, path)) as {
    dependencies: Record<string, string>;
    scripts: Record<string, string>;
  };
}

test('generates the NestJS Better Auth MySQL Drizzle contract for every Setup Type', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const tree = generateProject({
      setupType,
      stylingChoice: 'bare',
      packageManager: 'pnpm',
      generatedAppOptions: OPTIONS,
    });
    const paths = tree.map(({ path }) => path);
    const rootManifest = readVirtualManifest(tree, 'package.json');
    const serverManifest = readVirtualManifest(tree, 'apps/server/package.json');
    const authManifest = readVirtualManifest(tree, 'packages/auth/package.json');
    const databaseManifest = readVirtualManifest(tree, 'packages/db/package.json');
    const drizzleSnapshot = JSON.parse(
      readVirtualText(tree, 'packages/db/drizzle/meta/0000_snapshot.json'),
    ) as { dialect: string; tables: Record<string, unknown> };
    const appModule = readVirtualText(tree, 'apps/server/src/app.module.ts');
    const businessProfileModule = readVirtualText(
      tree,
      'apps/server/src/business-profile/business-profile.module.ts',
    );
    const generatedText = tree
      .flatMap(({ contents }) => (typeof contents === 'string' ? [contents] : []))
      .join('\n');

    assert.deepEqual(
      paths,
      [...paths].sort((left, right) => left.localeCompare(right)),
    );
    assert.includeMembers(paths, [
      'packages/auth/package.json',
      'packages/auth/src/index.ts',
      'packages/db/MYSQL.md',
      'packages/db/drizzle/0000_init.sql',
      'src/app/(auth)/sign-in.tsx',
      'src/app/(auth)/sign-up.tsx',
      'src/auth/better-auth-boundary.tsx',
    ]);
    assert.notInclude(paths, 'packages/db/POSTGRESQL.md');
    assert.equal(rootManifest.dependencies['@better-auth/expo'], '1.6.25');
    assert.equal(serverManifest.dependencies['@tenkit/auth'], 'workspace:*');
    assert.equal(serverManifest.dependencies['@tenkit/db'], 'workspace:*');
    assert.equal(serverManifest.dependencies['@thallesp/nestjs-better-auth'], '2.7.0');
    assert.equal(authManifest.dependencies['@better-auth/drizzle-adapter'], '1.6.25');
    assert.equal(databaseManifest.dependencies['drizzle-orm'], '0.45.2');
    assert.equal(databaseManifest.dependencies.mysql2, '3.20.0');
    assert.equal(drizzleSnapshot.dialect, 'mysql');
    assert.deepEqual(Object.keys(drizzleSnapshot.tables).sort(), [
      'account',
      'app_variant',
      'app_variant_runtime_tenant_access',
      'runtime_tenant',
      'session',
      'user',
      'verification',
    ]);
    assert.equal(
      rootManifest.scripts.build,
      'pnpm --dir packages/db run build && pnpm --dir packages/auth run build && pnpm --dir apps/server run build',
    );
    assert.equal(
      readVirtualText(tree, 'apps/server/.env.example'),
      'PORT=3000\nCLIENT_ORIGIN=http://localhost:8081\nDATABASE_URL=mysql://tenkit:password@localhost:3306/tenkit\nBETTER_AUTH_URL=http://localhost:3000\nBETTER_AUTH_SECRET=replace-with-at-least-32-random-characters\n',
    );
    assert.match(readVirtualText(tree, 'packages/auth/src/index.ts'), /drizzleAdapter/);
    assert.match(readVirtualText(tree, 'packages/auth/src/index.ts'), /provider: 'mysql'/);
    assert.match(readVirtualText(tree, 'packages/db/src/schema.ts'), /export const user/);
    assert.match(readVirtualText(tree, 'packages/db/drizzle/0000_init.sql'), /CREATE TABLE `user`/);
    assert.match(appModule, /AuthModule\.forRootAsync/);
    assert.match(appModule, /inject: \[ConfigService, TENKIT_DATABASE\]/);
    assert.match(appModule, /createTenkitAuth\(\{\s+database,/);
    assert.notMatch(appModule, /databaseUrl|authRuntime\.close/);
    assert.match(businessProfileModule, /class DrizzleDatabaseRuntimeModule/);
    assert.match(businessProfileModule, /await this\.database\.\$client\.end\(\)/);
    assert.equal(
      `${appModule}\n${businessProfileModule}`.match(/createMysqlDrizzleDatabase\(/g)?.length,
      1,
    );
    assert.match(readVirtualText(tree, 'apps/server/tests/integration.test.ts'), /sign-up\/email/);
    assert.match(readVirtualText(tree, 'apps/server/tests/integration.test.ts'), /sign-out/);
    assert.match(readVirtualText(tree, 'README.md'), /MySQL and Drizzle/);
    assert.match(readVirtualText(tree, 'README.md'), /immediate durable session/);
    assert.notMatch(
      generatedText,
      /CLERK_|@clerk|prisma|express Backend|convex|fastify|prototype/i,
    );
  }
});

test('protects every Setup Type route set across every Styling Choice', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    for (const stylingChoice of SUPPORTED_GENERATED_STYLING_CHOICES) {
      const tree = generateProject({
        setupType,
        stylingChoice,
        packageManager: 'pnpm',
        generatedAppOptions: OPTIONS,
      });

      assert.match(readVirtualText(tree, 'src/app/_layout.tsx'), /BetterAuthBoundary/);
      assert.match(readVirtualText(tree, 'src/auth/better-auth-boundary.tsx'), /Stack\.Protected/);
      assert.match(readVirtualText(tree, 'src/auth/sign-out-button.tsx'), /signOut/);
    }
  }
});
