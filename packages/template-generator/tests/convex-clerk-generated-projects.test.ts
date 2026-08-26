/// <reference types="node" />

import { tmpdir } from 'node:os';

import fs from 'fs-extra';
import { join } from 'pathe';
import { afterEach, assert, expect, test } from 'vitest';

import type { GeneratedAppOptions } from '@tenkit/types/generated-app-option-definitions';
import { SUPPORTED_GENERATED_SETUP_TYPE_IDS } from '@tenkit/types/setup-type-definitions';
import { SUPPORTED_GENERATED_STYLING_CHOICES } from '@tenkit/types/styling-definitions';

import { generateProject } from '../src/generator';
import { runGenerationProof } from '../src/local-proof';
import type { VirtualFileTree } from '../src/virtual-file-tree';

const CONVEX_CLERK_OPTIONS = {
  backend: 'convex',
  auth: 'clerk',
  database: 'none',
  orm: 'none',
} as const satisfies GeneratedAppOptions;

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((tempRoot) => fs.remove(tempRoot)));
});

function readVirtualText(tree: VirtualFileTree, path: string): string {
  const file = tree.find((candidate) => candidate.path === path);
  if (!file || typeof file.contents !== 'string') throw new Error(`Missing ${path}.`);
  return file.contents;
}

function readVirtualManifest(tree: VirtualFileTree, path: string): Record<string, unknown> {
  return JSON.parse(readVirtualText(tree, path)) as Record<string, unknown>;
}

test('generates Clerk-verified Convex projects for every Setup Type and Styling owner', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    for (const stylingChoice of SUPPORTED_GENERATED_STYLING_CHOICES) {
      const tree = generateProject({
        setupType,
        stylingChoice,
        packageManager: 'pnpm',
        generatedAppOptions: CONVEX_CLERK_OPTIONS,
      });
      const paths = tree.map(({ path }) => path);
      const rootManifest = readVirtualManifest(tree, 'package.json') as {
        dependencies: Record<string, string>;
        scripts: Record<string, string>;
      };
      const serverManifest = readVirtualManifest(tree, 'apps/server/package.json') as {
        dependencies: Record<string, string>;
      };
      const generatedText = tree
        .flatMap(({ contents }) => (typeof contents === 'string' ? [contents] : []))
        .join('\n');

      assert.includeMembers(paths, [
        'apps/server/convex/auth.config.ts',
        'apps/server/convex/businessProfiles.ts',
        'src/app/(auth)/sign-in.tsx',
        'src/app/(auth)/sign-up.tsx',
        'src/auth/clerk-provider.tsx',
      ]);
      assert.notInclude(paths, 'packages/auth/package.json');
      assert.notInclude(paths, 'packages/db/package.json');
      assert.equal(rootManifest.dependencies['@clerk/expo'], '4.2.1');
      assert.equal(rootManifest.dependencies.convex, '1.43.0');
      assert.deepEqual(serverManifest.dependencies, { convex: '1.43.0' });
      assert.match(rootManifest.scripts.test, /test:mobile.*apps\/server run test/);
      assert.match(readVirtualText(tree, '.env.example'), /EXPO_PUBLIC_CONVEX_URL/);
      assert.match(readVirtualText(tree, '.env.example'), /EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY/);
      assert.notMatch(readVirtualText(tree, '.env.example'), /EXPO_PUBLIC_CONVEX_SITE_URL/);
      assert.equal(
        readVirtualText(tree, 'apps/server/.env.example'),
        'CONVEX_DEPLOYMENT=dev:your-deployment-name\n',
      );
      assert.match(
        readVirtualText(tree, 'apps/server/convex/auth.config.ts'),
        /CLERK_FRONTEND_API_URL/,
      );
      assert.match(
        readVirtualText(tree, 'apps/server/convex/auth.config.ts'),
        /applicationID: 'convex'/,
      );
      assert.match(
        readVirtualText(tree, 'apps/server/convex/businessProfiles.ts'),
        /ctx\.auth\.getUserIdentity\(\)/,
      );
      assert.match(
        readVirtualText(tree, 'apps/server/tests/business-profiles.test.ts'),
        /withIdentity/,
      );
      assert.match(
        readVirtualText(tree, 'apps/server/tests/business-profiles.test.ts'),
        /rejects\.toThrow\(\/UNAUTHENTICATED\/\)/,
      );
      assert.match(readVirtualText(tree, 'src/app/_layout.tsx'), /ConvexProviderWithClerk/);
      assert.match(readVirtualText(tree, 'src/app/_layout.tsx'), /useConvexAuth/);
      assert.match(readVirtualText(tree, 'README.md'), /CLERK_FRONTEND_API_URL/);
      assert.match(generatedText, /Auth: clerk/);
      assert.notMatch(
        generatedText,
        /better-auth|CLERK_SECRET_KEY|DATABASE_URL|drizzle|prisma|packages\/db|packages\/auth/i,
      );
    }
  }
});

test('writes every Bare Convex with Clerk Setup Type into a fresh target', async () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const tempRoot = await fs.mkdtemp(join(tmpdir(), 'tenkit-convex-clerk-proof-'));
    tempRoots.push(tempRoot);
    const targetDir = join(tempRoot, 'generated-app');

    await runGenerationProof({
      setupType,
      generatedAppOptions: CONVEX_CLERK_OPTIONS,
      stylingChoice: 'bare',
      packageManager: 'pnpm',
      targetDir,
      git: false,
      workspaceRoot: join(tempRoot, 'tenkit-workspace'),
    });

    expect(await fs.pathExists(join(targetDir, 'apps/server/convex/auth.config.ts'))).toBe(true);
    expect(await fs.pathExists(join(targetDir, 'src/auth/clerk-provider.tsx'))).toBe(true);
    expect(await fs.pathExists(join(targetDir, 'packages/auth'))).toBe(false);
    expect(await fs.pathExists(join(targetDir, 'packages/db'))).toBe(false);
  }
}, 15_000);
