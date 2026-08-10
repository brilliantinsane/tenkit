/// <reference types="node" />

import { assert, test } from 'vitest';

import type { GeneratedAppOptions } from '@tenkit/types/generated-app-option-definitions';
import { SUPPORTED_GENERATED_SETUP_TYPE_IDS } from '@tenkit/types/setup-type-definitions';
import { SUPPORTED_GENERATED_STYLING_CHOICES } from '@tenkit/types/styling-definitions';

import { generateProject } from '../src/generator';
import type { VirtualFileTree } from '../src/virtual-file-tree';

const EXPRESS_CLERK_OPTIONS = {
  backend: 'express',
  auth: 'clerk',
  database: 'none',
  orm: 'none',
} as const satisfies GeneratedAppOptions;

function readVirtualText(tree: VirtualFileTree, path: string): string {
  const file = tree.find((candidate) => candidate.path === path);
  if (!file || typeof file.contents !== 'string') {
    throw new Error(`Missing generated text file ${path}.`);
  }

  return file.contents;
}

function readVirtualManifest(
  tree: VirtualFileTree,
  path: string,
): {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
} {
  return JSON.parse(readVirtualText(tree, path)) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    scripts: Record<string, string>;
  };
}

test('generates the Express and Clerk contract for every Setup Type', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const tree = generateProject({
      setupType,
      stylingChoice: 'bare',
      packageManager: 'pnpm',
      generatedAppOptions: EXPRESS_CLERK_OPTIONS,
    });
    const paths = tree.map(({ path }) => path);
    const rootManifest = readVirtualManifest(tree, 'package.json');
    const serverManifest = readVirtualManifest(tree, 'apps/server/package.json');
    const rootLayout = readVirtualText(tree, 'src/app/_layout.tsx');
    const mobileRequest = readVirtualText(tree, 'src/business-data/use-business-profile.ts');
    const clerkBusinessProfileClient = readVirtualText(
      tree,
      'src/auth/clerk-business-profile-client.ts',
    );
    const expressApp = readVirtualText(tree, 'apps/server/src/app.ts');
    const generatedText = tree
      .flatMap(({ contents }) => (typeof contents === 'string' ? [contents] : []))
      .join('\n');

    assert.includeMembers(paths, [
      'src/app/(auth)/_layout.tsx',
      'src/app/(auth)/sign-in.tsx',
      'src/app/(auth)/sign-up.tsx',
      'src/auth/auth-form.tsx',
      'src/auth/clerk-business-profile-client.test.ts',
      'src/auth/clerk-business-profile-client.ts',
      'src/auth/clerk-post-auth-navigation.test.ts',
      'src/auth/clerk-post-auth-navigation.ts',
      'src/auth/clerk-provider.tsx',
      'src/auth/clerk-session-boundary.test.ts',
      'src/auth/clerk-session-boundary.ts',
      'src/auth/sign-out-button.tsx',
      'src/auth/use-clerk-auth-form.ts',
    ]);
    assert.notInclude(paths, 'packages/auth/package.json');
    assert.notInclude(paths, 'packages/db/package.json');

    assert.equal(rootManifest.dependencies['@clerk/expo'], '4.2.1');
    assert.equal(rootManifest.dependencies['expo-secure-store'], '~57.0.1');
    assert.equal(rootManifest.devDependencies.vitest, '^4.1.9');
    assert.equal(serverManifest.dependencies['@clerk/express'], '2.1.50');
    assert.equal(serverManifest.devDependencies.typescript, '~5.9.3');
    assert.notMatch(readVirtualText(tree, 'apps/server/tsconfig.json'), /skipLibCheck/);
    assert.match(
      readVirtualText(tree, 'apps/server/tsconfig.json'),
      /"moduleResolution": "Bundler"/,
    );
    assert.equal(
      readVirtualText(tree, 'pnpm-workspace.yaml'),
      "packages:\n  - '.'\n  - 'apps/server'\n\nallowBuilds:\n  browser-tabs-lock: true\n  bufferutil: false\n  core-js: false\n  esbuild: true\n  utf-8-validate: false\n",
    );
    assert.equal(serverManifest.dependencies['@clerk/backend'], undefined);

    assert.match(readVirtualText(tree, '.env.example'), /EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_/);
    assert.equal(
      readVirtualText(tree, 'apps/server/.env.example'),
      'PORT=3000\nCLIENT_ORIGIN=http://localhost:8081\nCLERK_PUBLISHABLE_KEY=pk_test_replace_me\nCLERK_SECRET_KEY=sk_test_replace_me\n',
    );
    assert.match(readVirtualText(tree, 'app.config.ts'), /'@clerk\/expo'/);
    assert.match(readVirtualText(tree, 'app.config.ts'), /'expo-secure-store'/);

    assert.match(rootLayout, /ClerkAppProvider/);
    assert.match(rootLayout, /useAuth\(\)/);
    assert.match(rootLayout, /name="\(auth\)"/);
    assert.match(rootLayout, /Stack\.Protected/);
    assert.match(rootLayout, /resolveClerkSessionRouteState/);
    assert.match(readVirtualText(tree, 'src/auth/clerk-provider.tsx'), /tokenCache/);
    assert.match(readVirtualText(tree, 'src/auth/use-clerk-auth-form.ts'), /sendEmailCode/);
    assert.match(readVirtualText(tree, 'src/auth/use-clerk-auth-form.ts'), /verifyEmailCode/);
    assert.match(readVirtualText(tree, 'src/auth/use-clerk-auth-form.ts'), /confirmPassword/);
    assert.match(
      readVirtualText(tree, 'src/auth/use-clerk-auth-form.ts'),
      /firstName: name\.trim\(\)/,
    );
    assert.match(readVirtualText(tree, 'src/auth/sign-out-button.tsx'), /void signOut\(\)/);

    assert.match(mobileRequest, /getToken/);
    assert.match(mobileRequest, /AbortController/);
    assert.match(mobileRequest, /requestClerkBusinessProfile/);
    assert.match(clerkBusinessProfileClient, /Authorization: `Bearer \$\{token\}`/);
    assert.match(clerkBusinessProfileClient, /responseBody: unknown/);
    assert.match(clerkBusinessProfileClient, /response\.ok/);
    assert.match(rootManifest.scripts.test, /test:mobile/);

    assert.ok(expressApp.indexOf('clerkMiddleware()') < expressApp.indexOf('cors('));
    assert.match(expressApp, /interface ClerkAppearanceRegistry/);
    assert.match(expressApp, /getAuth\(request\)/);
    assert.match(expressApp, /status\(401\)/);
    assert.match(expressApp, /app\.get\('\/health'/);
    assert.match(expressApp, /app\.get\('\/api\/business-profile'/);
    assert.match(readVirtualText(tree, 'apps/server/tests/app.test.ts'), /authenticated/);
    assert.notMatch(readVirtualText(tree, 'apps/server/tests/integration.test.ts'), /Bearer/);
    assert.match(readVirtualText(tree, 'README.md'), /Email verification/);
    assert.match(generatedText, /Auth: clerk/);
    assert.notMatch(
      generatedText,
      /better-auth|DATABASE_URL|drizzle|mysql2|packages\/auth|packages\/db|from 'pg'|prisma|nestjs|convex/i,
    );
  }
});

test('keeps Clerk Auth UI inside the selected Styling option layer', () => {
  const stylingImports = {
    bare: /@\/theme\/ThemeContext/,
    uniwind: /className=/,
    unistyles: /from 'react-native-unistyles'/,
  } as const;

  for (const stylingChoice of SUPPORTED_GENERATED_STYLING_CHOICES) {
    const tree = generateProject({
      setupType: 'white-label-apps',
      stylingChoice,
      packageManager: 'pnpm',
      generatedAppOptions: EXPRESS_CLERK_OPTIONS,
    });

    assert.match(readVirtualText(tree, 'src/auth/auth-form.tsx'), stylingImports[stylingChoice]);
    assert.match(
      readVirtualText(tree, 'src/auth/sign-out-button.tsx'),
      stylingImports[stylingChoice],
    );
  }
});

test('protects every Setup Type route set across every Styling Choice', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const expectedSecondRoute = setupType === 'white-label-apps' ? 'explore' : 'settings';

    for (const stylingChoice of SUPPORTED_GENERATED_STYLING_CHOICES) {
      const tree = generateProject({
        setupType,
        stylingChoice,
        packageManager: 'pnpm',
        generatedAppOptions: EXPRESS_CLERK_OPTIONS,
      });
      const rootLayout = readVirtualText(tree, 'src/app/_layout.tsx');

      assert.match(rootLayout, /Stack\.Protected/);
      assert.match(rootLayout, /name="index"/);
      assert.match(rootLayout, new RegExp(`name="${expectedSecondRoute}"`));
      assert.match(rootLayout, /isSignedIn !== true/);
      assert.match(rootLayout, /sessionRouteState === 'app'/);
    }
  }
});
