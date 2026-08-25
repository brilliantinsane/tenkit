import { assert, test } from 'vitest';

import type { GeneratedAppOptions } from '@tenkit/types/generated-app-option-definitions';
import { SUPPORTED_GENERATED_SETUP_TYPE_IDS } from '@tenkit/types/setup-type-definitions';
import { SUPPORTED_GENERATED_STYLING_CHOICES } from '@tenkit/types/styling-definitions';

import { generateProject } from '../src/generator';
import type { VirtualFileTree } from '../src/virtual-file-tree';

const CONVEX_BETTER_AUTH_OPTIONS = {
  backend: 'convex',
  auth: 'better-auth',
  database: 'none',
  orm: 'none',
} as const satisfies GeneratedAppOptions;

function readVirtualText(tree: VirtualFileTree, path: string): string {
  const file = tree.find((candidate) => candidate.path === path);
  if (!file || typeof file.contents !== 'string') throw new Error(`Missing ${path}.`);
  return file.contents;
}

test('generates Convex-owned Better Auth for every Setup Type without SQL artifacts', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    for (const stylingChoice of SUPPORTED_GENERATED_STYLING_CHOICES) {
      const tree = generateProject({
        setupType,
        stylingChoice,
        packageManager: 'pnpm',
        generatedAppOptions: CONVEX_BETTER_AUTH_OPTIONS,
      });
      const paths = tree.map(({ path }) => path);
      const generatedText = tree
        .flatMap(({ contents }) => (typeof contents === 'string' ? [contents] : []))
        .join('\n');
      assert.includeMembers(paths, [
        'apps/server/convex/auth.config.ts',
        'apps/server/convex/auth.ts',
        'apps/server/convex/convex.config.ts',
        'apps/server/convex/http.ts',
        'src/auth/auth-client.ts',
      ]);
      assert.notInclude(paths, 'packages/auth/package.json');
      assert.notInclude(paths, 'packages/db/package.json');
      assert.match(readVirtualText(tree, '.env.example'), /EXPO_PUBLIC_CONVEX_SITE_URL/);
      assert.match(readVirtualText(tree, 'README.md'), /BETTER_AUTH_SECRET/);
      assert.match(readVirtualText(tree, 'apps/server/convex/auth.ts'), /authComponent\.adapter/);
      assert.match(readVirtualText(tree, 'apps/server/convex/businessProfiles.ts'), /getAuthUser/);
      const authBoundary = readVirtualText(tree, 'src/auth/better-auth-boundary.tsx');
      const authClient = readVirtualText(tree, 'src/auth/auth-client.ts');
      assert.match(authBoundary, /Stack\.Protected/);
      assert.match(authBoundary, /name="\(auth\)"/);
      assert.match(authBoundary, /name="index"/);
      assert.match(authClient, /convexClient\(\)/);
      assert.match(authClient, /convexBetterAuthClient: ConvexBetterAuthClient = authClient/);
      assert.notMatch(authClient, /as unknown as/);
      assert.match(
        readVirtualText(tree, 'src/business-data/use-business-profile.ts'),
        /resolveProtectedConvexQueryState/,
      );
      assert.match(
        readVirtualText(tree, 'src/business-data/use-business-profile.ts'),
        /protectedQueryState === 'query'/,
      );
      assert.match(readVirtualText(tree, 'src/app/_layout.tsx'), /ConvexBetterAuthProvider/);
      assert.match(generatedText, /Auth: better-auth/);
      assert.notMatch(generatedText, /DATABASE_URL|drizzle|prisma|packages\/db|packages\/auth/i);
    }
  }
});
