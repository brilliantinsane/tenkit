/// <reference types="node" />

import { tmpdir } from 'node:os';

import fs from 'fs-extra';
import { join } from 'pathe';
import { assert, test } from 'vitest';

import type { GeneratedAppOptions } from '@tenkit/types/generated-app-option-definitions';
import { SUPPORTED_GENERATED_SETUP_TYPE_IDS } from '@tenkit/types/setup-type-definitions';

import { generateProject } from '../src/generator';
import { runGenerationProof } from '../src/local-proof';
import type { VirtualFileTree } from '../src/virtual-file-tree';
import { assertClerkProtectedRoutes } from './clerk-generated-project-test-helpers';

const NESTJS_CLERK_OPTIONS = {
  backend: 'nestjs',
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

test('generates the NestJS and Clerk contract for every Setup Type', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const tree = generateProject({
      setupType,
      stylingChoice: 'bare',
      packageManager: 'pnpm',
      generatedAppOptions: NESTJS_CLERK_OPTIONS,
    });
    const paths = tree.map(({ path }) => path);
    const rootManifest = readVirtualManifest(tree, 'package.json');
    const serverManifest = readVirtualManifest(tree, 'apps/server/package.json');
    const configureApplication = readVirtualText(tree, 'apps/server/src/configure-application.ts');
    const businessProfileController = readVirtualText(
      tree,
      'apps/server/src/business-profile/business-profile.controller.ts',
    );
    const mobileRequest = readVirtualText(tree, 'src/business-data/use-business-profile.ts');
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
    assert.equal(serverManifest.dependencies['@clerk/express'], '2.1.50');
    assert.equal(serverManifest.dependencies['@clerk/backend'], undefined);
    assert.equal(serverManifest.devDependencies.typescript, '~5.9.3');
    assert.match(readVirtualText(tree, 'apps/server/tsconfig.json'), /"module": "ESNext"/);
    assert.match(
      readVirtualText(tree, 'apps/server/tsconfig.json'),
      /"moduleResolution": "Bundler"/,
    );
    assert.notMatch(readVirtualText(tree, 'apps/server/tsconfig.json'), /skipLibCheck/);

    assert.match(readVirtualText(tree, '.env.example'), /EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_/);
    assert.equal(
      readVirtualText(tree, 'apps/server/.env.example'),
      'PORT=3000\nCLIENT_ORIGIN=http://localhost:8081\nCLERK_PUBLISHABLE_KEY=pk_test_replace_me\nCLERK_SECRET_KEY=sk_test_replace_me\n',
    );
    assert.match(readVirtualText(tree, 'app.config.ts'), /'@clerk\/expo'/);
    assert.match(readVirtualText(tree, 'app.config.ts'), /'expo-secure-store'/);

    assert.ok(
      configureApplication.indexOf('app.use(authenticationMiddleware)') <
        configureApplication.indexOf('app.enableCors'),
    );
    assert.match(configureApplication, /clerkMiddleware\(\)/);
    assert.match(businessProfileController, /ClerkAuthenticationService/);
    assert.match(businessProfileController, /UnauthorizedException/);
    assert.match(businessProfileController, /@Req\(\)/);
    assert.match(mobileRequest, /getToken/);
    assert.match(mobileRequest, /requestClerkBusinessProfile/);
    assert.match(rootManifest.scripts.test, /test:mobile/);

    const serverTests = readVirtualText(tree, 'apps/server/tests/app.test.ts');
    assert.match(serverTests, /overrideProvider\(ClerkAuthenticationService\)/);
    assert.match(serverTests, /Authentication is required/);
    assert.match(serverTests, /authenticated requests validate context/);
    assert.notMatch(readVirtualText(tree, 'apps/server/tests/integration.test.ts'), /Bearer/);
    assert.match(readVirtualText(tree, 'README.md'), /## NestJS Backend/);
    assert.match(readVirtualText(tree, 'README.md'), /Email verification/);
    assert.match(generatedText, /Auth: clerk/);
    assert.notMatch(
      generatedText,
      /better-auth|DATABASE_URL|drizzle|mysql2|packages\/auth|packages\/db|from 'pg'|prisma|convex|prototype/i,
    );
  }
});

test('protects every Setup Type route set across every Styling Choice', () => {
  assertClerkProtectedRoutes(NESTJS_CLERK_OPTIONS);
});

test('writes each NestJS and Clerk Setup Type as a fresh project outside the workspace', async () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const tempRoot = await fs.mkdtemp(join(tmpdir(), 'tenkit-nestjs-clerk-proof-'));
    const targetDir = join(tempRoot, 'generated-app');

    try {
      await runGenerationProof({
        setupType,
        generatedAppOptions: NESTJS_CLERK_OPTIONS,
        stylingChoice: 'bare',
        packageManager: 'pnpm',
        targetDir,
        git: false,
        workspaceRoot: join(tempRoot, 'tenkit-workspace'),
      });

      assert.equal(await fs.pathExists(join(targetDir, 'apps/server/package.json')), true);
      assert.equal(await fs.pathExists(join(targetDir, 'src/auth/clerk-provider.tsx')), true);
      assert.equal(await fs.pathExists(join(targetDir, 'packages/auth')), false);
      assert.equal(await fs.pathExists(join(targetDir, 'packages/db')), false);
    } finally {
      await fs.remove(tempRoot);
    }
  }
});
