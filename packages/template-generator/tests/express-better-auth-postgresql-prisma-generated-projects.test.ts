import { assert, test } from 'vitest';

import type { GeneratedAppOptions } from '@tenkit/types/generated-app-option-definitions';
import { SUPPORTED_GENERATED_SETUP_TYPE_IDS } from '@tenkit/types/setup-type-definitions';
import { SUPPORTED_GENERATED_STYLING_CHOICES } from '@tenkit/types/styling-definitions';

import { generateProject } from '../src/generator';
import type { VirtualFileTree } from '../src/virtual-file-tree';

const EXPRESS_BETTER_AUTH_POSTGRESQL_PRISMA_OPTIONS = {
  backend: 'express',
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
    workspaces?: string[];
  };
}

test('generates the Express Better Auth PostgreSQL Prisma contract for every Setup Type', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const tree = generateProject({
      setupType,
      stylingChoice: 'bare',
      packageManager: 'pnpm',
      generatedAppOptions: EXPRESS_BETTER_AUTH_POSTGRESQL_PRISMA_OPTIONS,
    });
    const paths = tree.map(({ path }) => path);
    const rootManifest = readVirtualManifest(tree, 'package.json');
    const serverManifest = readVirtualManifest(tree, 'apps/server/package.json');
    const authManifest = readVirtualManifest(tree, 'packages/auth/package.json');
    const databaseManifest = readVirtualManifest(tree, 'packages/db/package.json');
    const rootLayout = readVirtualText(tree, 'src/app/_layout.tsx');
    const authBoundary = readVirtualText(tree, 'src/auth/better-auth-boundary.tsx');
    const generatedText = tree
      .flatMap(({ contents }) => (typeof contents === 'string' ? [contents] : []))
      .join('\n');

    assert.includeMembers(paths, [
      'packages/auth/package.json',
      'packages/auth/src/index.ts',
      'packages/auth/tsconfig.json',
      'src/app/(auth)/_layout.tsx',
      'src/app/(auth)/sign-in.tsx',
      'src/app/(auth)/sign-up.tsx',
      'src/auth/auth-client.ts',
      'src/auth/auth-form.tsx',
      'src/auth/auth-session-boundary.test.ts',
      'src/auth/auth-session-boundary.ts',
      'src/auth/sign-out-button.tsx',
      'src/auth/use-better-auth-form.ts',
    ]);

    assert.equal(rootManifest.dependencies['@better-auth/expo'], '1.6.25');
    assert.equal(rootManifest.dependencies['better-auth'], '1.6.25');
    assert.equal(rootManifest.dependencies['expo-network'], '~57.0.1');
    assert.equal(rootManifest.dependencies['expo-secure-store'], '~57.0.1');
    assert.equal(authManifest.dependencies['@better-auth/expo'], '1.6.25');
    assert.equal(authManifest.dependencies['@tenkit/db'], 'workspace:*');
    assert.equal(authManifest.dependencies['better-auth'], '1.6.25');
    assert.equal(serverManifest.dependencies['@tenkit/auth'], 'workspace:*');
    assert.equal(databaseManifest.dependencies['@prisma/client'], '7.5.0');
    assert.equal(
      rootManifest.scripts['test:mobile'],
      'vitest run src/auth/auth-session-boundary.test.ts',
    );
    assert.equal(
      rootManifest.scripts.build,
      'pnpm --dir packages/db run build && pnpm --dir packages/auth run build && pnpm --dir apps/server run build',
    );

    const pnpmWorkspace = readVirtualText(tree, 'pnpm-workspace.yaml');
    assert.match(pnpmWorkspace, /- 'packages\/auth'/);
    assert.match(
      pnpmWorkspace,
      /minimumReleaseAgeExclude:\n  - '@cloudflare\/workers-types@5\.20260812\.1'/,
    );
    assert.match(readVirtualText(tree, '.env.example'), /EXPO_PUBLIC_API_URL=/);
    assert.equal(
      readVirtualText(tree, 'apps/server/.env.example'),
      'PORT=3000\nCLIENT_ORIGIN=http://localhost:8081\nDATABASE_URL=postgresql://postgres:password@localhost:5432/tenkit\nBETTER_AUTH_URL=http://localhost:3000\nBETTER_AUTH_SECRET=replace-with-at-least-32-random-characters\n',
    );
    assert.match(readVirtualText(tree, 'app.config.ts'), /'expo-secure-store'/);
    assert.match(readVirtualText(tree, 'packages/auth/src/index.ts'), /prismaAdapter/);
    assert.match(readVirtualText(tree, 'packages/auth/src/index.ts'), /emailAndPassword/);
    assert.match(readVirtualText(tree, 'packages/auth/src/index.ts'), /trustedOrigins/);
    assert.match(readVirtualText(tree, 'packages/db/prisma/schema.prisma'), /model User/);
    assert.match(readVirtualText(tree, 'packages/db/prisma/schema.prisma'), /model Session/);
    assert.match(
      readVirtualText(tree, 'packages/db/prisma/migrations/20260810000000_init/migration.sql'),
      /CREATE TABLE "user"/,
    );

    assert.match(rootLayout, /BetterAuthBoundary/);
    assert.match(authBoundary, /authClient\.useSession/);
    assert.match(authBoundary, /Stack\.Protected/);
    assert.match(authBoundary, /name="\(auth\)"/);
    assert.match(readVirtualText(tree, 'src/auth/auth-client.ts'), /expoClient/);
    assert.match(readVirtualText(tree, 'src/auth/auth-client.ts'), /getCookie/);
    assert.match(readVirtualText(tree, 'src/auth/use-better-auth-form.ts'), /signUp\.email/);
    assert.match(readVirtualText(tree, 'src/auth/use-better-auth-form.ts'), /confirmPassword/);
    assert.match(readVirtualText(tree, 'src/auth/sign-out-button.tsx'), /signOut/);

    const expressApp = readVirtualText(tree, 'apps/server/src/app.ts');
    assert.match(expressApp, /toNodeHandler/);
    assert.match(expressApp, /fromNodeHeaders/);
    assert.match(expressApp, /auth\.api\.getSession/);
    assert.match(expressApp, /status\(401\)/);
    assert.ok(
      expressApp.indexOf("app.all('/api/auth/*splat'") < expressApp.indexOf('express.json()'),
    );
    const integrationTest = readVirtualText(tree, 'apps/server/tests/integration.test.ts');
    assert.match(integrationTest, /sign-up\/email/);
    assert.match(integrationTest, /sign-in\/email/);
    assert.match(integrationTest, /get-session/);
    assert.match(integrationTest, /sign-out/);
    assert.match(readVirtualText(tree, 'README.md'), /immediate durable session/);
    assert.match(generatedText, /Auth: better-auth/);
    assert.notMatch(generatedText, /CLERK_|@clerk|drizzle|mysql2|nestjs|convex|prototype/i);
  }
});

test('keeps Better Auth UI inside every selected Styling option layer', () => {
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
      generatedAppOptions: EXPRESS_BETTER_AUTH_POSTGRESQL_PRISMA_OPTIONS,
    });

    assert.match(readVirtualText(tree, 'src/auth/auth-form.tsx'), stylingSignatures[stylingChoice]);
    assert.match(
      readVirtualText(tree, 'src/auth/sign-out-button.tsx'),
      stylingSignatures[stylingChoice],
    );
  }
});

test('protects every Setup Type route set across every Styling Choice with Better Auth', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const expectedSecondRoute = setupType === 'white-label-apps' ? 'explore' : 'settings';

    for (const stylingChoice of SUPPORTED_GENERATED_STYLING_CHOICES) {
      const tree = generateProject({
        setupType,
        stylingChoice,
        packageManager: 'pnpm',
        generatedAppOptions: EXPRESS_BETTER_AUTH_POSTGRESQL_PRISMA_OPTIONS,
      });
      const rootLayout = readVirtualText(tree, 'src/app/_layout.tsx');
      const authBoundary = readVirtualText(tree, 'src/auth/better-auth-boundary.tsx');

      assert.match(rootLayout, /BetterAuthBoundary/);
      assert.match(authBoundary, /Stack\.Protected/);
      assert.match(authBoundary, /name="index"/);
      assert.match(authBoundary, new RegExp(`name="${expectedSecondRoute}"`));
      assert.match(authBoundary, /sessionRouteState === 'app'/);
    }
  }
});
