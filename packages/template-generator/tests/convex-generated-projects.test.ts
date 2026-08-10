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

const CONVEX_OPTIONS = {
  backend: 'convex',
  auth: 'none',
  database: 'none',
  orm: 'none',
} as const satisfies GeneratedAppOptions;

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((tempRoot) => fs.remove(tempRoot)));
});

function readVirtualText(tree: VirtualFileTree, path: string): string {
  const file = tree.find((candidate) => candidate.path === path);
  if (!file || typeof file.contents !== 'string') {
    throw new Error(`Missing generated text file ${path}.`);
  }
  return file.contents;
}

function readVirtualManifest(tree: VirtualFileTree, path: string): Record<string, unknown> {
  return JSON.parse(readVirtualText(tree, path)) as Record<string, unknown>;
}

test('generates the exact Auth-free Convex-managed shape for every Setup Type', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const tree = generateProject({
      setupType,
      stylingChoice: 'bare',
      packageManager: 'pnpm',
      generatedAppOptions: CONVEX_OPTIONS,
    });
    const paths = tree.map(({ path }) => path);
    const rootManifest = readVirtualManifest(tree, 'package.json') as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    const serverManifest = readVirtualManifest(tree, 'apps/server/package.json') as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    const generatedText = tree
      .flatMap(({ contents }) => (typeof contents === 'string' ? [contents] : []))
      .join('\n');

    assert.deepEqual(
      paths,
      [...paths].sort((left, right) => left.localeCompare(right)),
    );
    assert.includeMembers(paths, [
      'apps/server/.env.example',
      'apps/server/convex.json',
      'apps/server/convex/_generated/api.d.ts',
      'apps/server/convex/_generated/api.js',
      'apps/server/convex/_generated/dataModel.d.ts',
      'apps/server/convex/_generated/server.d.ts',
      'apps/server/convex/_generated/server.js',
      'apps/server/convex/businessProfileAccess.ts',
      'apps/server/convex/businessProfiles.ts',
      'apps/server/convex/health.ts',
      'apps/server/convex/schema.ts',
      'apps/server/convex/starterData.ts',
      'apps/server/convex/tsconfig.json',
      'apps/server/package.json',
      'apps/server/tests/business-profiles.test.ts',
      'apps/server/tsconfig.json',
      'src/business-data/use-business-profile.ts',
    ]);
    assert.notInclude(paths, 'packages/auth/package.json');
    assert.notInclude(paths, 'packages/db/package.json');

    assert.deepEqual(serverManifest.dependencies, { convex: '1.43.0' });
    assert.deepEqual(serverManifest.devDependencies, {
      'convex-test': '0.0.55',
      typescript: '~6.0.3',
      vitest: '^4.1.9',
    });
    assert.deepEqual(serverManifest.scripts, {
      codegen: 'convex codegen',
      dev: 'convex dev',
      seed: 'convex run starterData:seed',
      sync: 'convex dev --once',
      test: 'vitest run tests/business-profiles.test.ts',
      typecheck: 'tsc --noEmit --pretty false',
    });
    assert.equal(rootManifest.dependencies.convex, '1.43.0');
    assert.equal(rootManifest.devDependencies.concurrently, '^9.2.1');
    assert.equal(
      rootManifest.scripts.dev,
      'concurrently -k "expo start" "pnpm --dir apps/server run dev"',
    );
    assert.equal(rootManifest.scripts['convex:codegen'], 'pnpm --dir apps/server run codegen');
    assert.equal(rootManifest.scripts['convex:dev'], 'pnpm --dir apps/server run dev');
    assert.equal(rootManifest.scripts['convex:seed'], 'pnpm --dir apps/server run seed');
    assert.equal(rootManifest.scripts['convex:sync'], 'pnpm --dir apps/server run sync');
    assert.equal(rootManifest.scripts.test, 'pnpm --dir apps/server run test');
    assert.equal(rootManifest.scripts['test:integration'], 'pnpm --dir apps/server run test');
    assert.equal(
      rootManifest.scripts.typecheck,
      'tsc --noEmit --pretty false && pnpm --dir apps/server run typecheck',
    );
    assert.notProperty(rootManifest.scripts, 'build');
    assert.notProperty(rootManifest.scripts, 'server:start:prod');

    assert.equal(
      readVirtualText(tree, '.env.example').includes(
        'EXPO_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud',
      ),
      true,
    );
    assert.equal(
      readVirtualText(tree, 'apps/server/.env.example'),
      'CONVEX_DEPLOYMENT=dev:your-deployment-name\n',
    );
    assert.match(readVirtualText(tree, 'pnpm-workspace.yaml'), /- 'apps\/server'/);
    assert.match(readVirtualText(tree, 'src/app/_layout.tsx'), /new ConvexReactClient/);
    assert.match(
      readVirtualText(tree, 'src/app/_layout.tsx'),
      /<ConvexProvider client=\{convexClient\}>/,
    );
    assert.match(readVirtualText(tree, 'src/business-data/use-business-profile.ts'), /useQuery/);
    assert.match(readVirtualText(tree, 'apps/server/convex/schema.ts'), /defineSchema/);
    assert.match(readVirtualText(tree, 'apps/server/convex/schema.ts'), /\.index\(/);
    assert.match(
      readVirtualText(tree, 'apps/server/convex/businessProfiles.ts'),
      /export const get = query/,
    );
    assert.match(
      readVirtualText(tree, 'apps/server/convex/health.ts'),
      /export const check = query/,
    );
    assert.match(readVirtualText(tree, 'apps/server/convex/starterData.ts'), /internalMutation/);
    assert.match(readVirtualText(tree, 'README.md'), /## Convex Backend/);
    assert.match(generatedText, /Auth: none/);
    assert.notMatch(
      generatedText,
      /better-auth|CLERK_|DATABASE_URL|drizzle|express|nestjs|mysql2|packages\/auth|packages\/db|from 'pg'|prisma|prototype/i,
    );
  }
});

test('writes each Convex Setup Type as a fresh project outside the workspace', async () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const tempRoot = await fs.mkdtemp(join(tmpdir(), 'tenkit-convex-proof-'));
    tempRoots.push(tempRoot);
    const targetDir = join(tempRoot, 'generated-app');

    await runGenerationProof({
      setupType,
      generatedAppOptions: CONVEX_OPTIONS,
      stylingChoice: 'bare',
      packageManager: 'pnpm',
      targetDir,
      git: false,
      workspaceRoot: join(tempRoot, 'tenkit-workspace'),
    });

    expect(await fs.pathExists(join(targetDir, 'apps/server/convex/schema.ts'))).toBe(true);
    expect(await fs.pathExists(join(targetDir, 'packages/auth'))).toBe(false);
    expect(await fs.pathExists(join(targetDir, 'packages/db'))).toBe(false);
  }
});

test('wires the Convex provider through every Styling owner', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    for (const stylingChoice of SUPPORTED_GENERATED_STYLING_CHOICES) {
      const tree = generateProject({
        setupType,
        stylingChoice,
        packageManager: 'pnpm',
        generatedAppOptions: CONVEX_OPTIONS,
      });
      const rootLayout = readVirtualText(tree, 'src/app/_layout.tsx');

      assert.match(rootLayout, /new ConvexReactClient/);
      assert.match(rootLayout, /<ConvexProvider client=\{convexClient\}>/);
    }
  }
});

test.each([
  {
    packageManager: 'pnpm',
    serverRunCommand: 'pnpm --dir apps/server run',
    usesManifestWorkspace: false,
  },
  {
    packageManager: 'npm',
    serverRunCommand: 'npm --prefix apps/server run',
    usesManifestWorkspace: true,
  },
  {
    packageManager: 'bun',
    serverRunCommand: 'bun --cwd apps/server run',
    usesManifestWorkspace: true,
  },
] as const)(
  'generates coherent $packageManager Convex workspace commands',
  ({ packageManager, serverRunCommand, usesManifestWorkspace }) => {
    const tree = generateProject({
      setupType: 'white-label-apps',
      stylingChoice: 'bare',
      packageManager,
      generatedAppOptions: CONVEX_OPTIONS,
    });
    const rootManifest = readVirtualManifest(tree, 'package.json') as {
      scripts: Record<string, string>;
      workspaces?: string[];
    };

    assert.equal(
      rootManifest.scripts.dev,
      `concurrently -k "expo start" "${serverRunCommand} dev"`,
    );
    assert.equal(rootManifest.scripts['convex:codegen'], `${serverRunCommand} codegen`);
    assert.equal(rootManifest.scripts['convex:sync'], `${serverRunCommand} sync`);
    assert.equal(rootManifest.scripts['convex:seed'], `${serverRunCommand} seed`);
    assert.notProperty(rootManifest.scripts, 'server:start:prod');
    assert.deepEqual(rootManifest.workspaces, usesManifestWorkspace ? ['apps/server'] : undefined);
    assert.equal(
      tree.some(({ path }) => path === 'pnpm-workspace.yaml'),
      packageManager === 'pnpm',
    );
  },
);
