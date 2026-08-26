import { assert, test } from 'vitest';

import type { GeneratedAppOptions } from '@tenkit/types/generated-app-option-definitions';
import { SUPPORTED_GENERATED_SETUP_TYPE_IDS } from '@tenkit/types/setup-type-definitions';

import { generateProject } from '../src/generator';
import type { VirtualFileTree } from '../src/virtual-file-tree';

const EXPRESS_BETTER_AUTH_MYSQL_DRIZZLE_OPTIONS = {
  backend: 'express',
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

test('generates the Express Better Auth MySQL Drizzle contract for every Setup Type', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const tree = generateProject({
      setupType,
      stylingChoice: 'bare',
      packageManager: 'pnpm',
      generatedAppOptions: EXPRESS_BETTER_AUTH_MYSQL_DRIZZLE_OPTIONS,
    });
    const snapshot = JSON.parse(
      readVirtualText(tree, 'packages/db/drizzle/meta/0000_snapshot.json'),
    ) as { dialect: string; tables: Record<string, unknown> };
    const generatedText = tree
      .flatMap(({ contents }) => (typeof contents === 'string' ? [contents] : []))
      .join('\n');

    assert.equal(snapshot.dialect, 'mysql');
    assert.deepEqual(Object.keys(snapshot.tables).sort(), [
      'account',
      'app_variant',
      'app_variant_runtime_tenant_access',
      'runtime_tenant',
      'session',
      'user',
      'verification',
    ]);
    assert.match(readVirtualText(tree, 'packages/auth/src/index.ts'), /provider: 'mysql'/);
    assert.match(readVirtualText(tree, 'packages/db/src/schema.ts'), /export const user/);
    assert.match(readVirtualText(tree, 'packages/db/drizzle/0000_init.sql'), /CREATE TABLE `user`/);
    assert.match(readVirtualText(tree, 'apps/server/src/server.ts'), /createMysqlDrizzleDatabase/);
    assert.match(readVirtualText(tree, 'src/app/_layout.tsx'), /BetterAuthBoundary/);
    assert.match(generatedText, /Auth: better-auth/);
    assert.notMatch(generatedText, /CLERK_|@clerk|prisma|nestjs|convex|prototype/i);
  }
});
