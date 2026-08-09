/// <reference types="node" />

import { tmpdir } from 'node:os';

import fs from 'fs-extra';
import { join } from 'pathe';
import { afterEach, assert, expect, test } from 'vitest';

import type { GeneratedAppOptions } from '@tenkit/types/generated-app-option-definitions';
import { SUPPORTED_GENERATED_SETUP_TYPE_IDS } from '@tenkit/types/setup-type-definitions';

import { generateProject } from '../src/generator';
import { runGenerationProof } from '../src/local-proof';
import type { VirtualFileTree } from '../src/virtual-file-tree';

const EXPRESS_OPTIONS = {
  backend: 'express',
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

test('generates the exact Auth-free Database-free Express shape for every Setup Type', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const tree = generateProject({
      setupType,
      stylingChoice: 'bare',
      packageManager: 'pnpm',
      generatedAppOptions: EXPRESS_OPTIONS,
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
      'apps/server/package.json',
      'apps/server/src/app.ts',
      'apps/server/src/business-profile.ts',
      'apps/server/src/environment.ts',
      'apps/server/src/server.ts',
      'apps/server/tests/app.test.ts',
      'apps/server/tests/integration.test.ts',
      'apps/server/tsconfig.json',
      'src/business-data/use-business-profile.ts',
    ]);
    assert.notInclude(paths, 'packages/auth/package.json');
    assert.notInclude(paths, 'packages/db/package.json');

    assert.deepEqual(serverManifest.dependencies, {
      cors: '^2.8.5',
      dotenv: '^17.4.2',
      express: '^5.2.1',
      zod: '^4.4.3',
    });
    assert.deepEqual(serverManifest.devDependencies, {
      '@types/cors': '^2.8.19',
      '@types/express': '^5.0.6',
      '@types/node': '^25.9.3',
      '@types/supertest': '^6.0.3',
      supertest: '^7.2.2',
      tsx: '^4.22.4',
      typescript: '~6.0.3',
      vitest: '^4.1.9',
    });
    assert.deepEqual(serverManifest.scripts, {
      build: 'tsc -p tsconfig.json',
      dev: 'tsx watch src/server.ts',
      'start:prod': 'node dist/src/server.js',
      test: 'vitest run tests/app.test.ts',
      'test:integration': 'vitest run tests/integration.test.ts',
      typecheck: 'tsc --noEmit --pretty false',
    });
    assert.equal(rootManifest.devDependencies.concurrently, '^9.2.1');
    assert.equal(rootManifest.scripts.start, 'expo start');
    assert.equal(
      rootManifest.scripts.dev,
      'concurrently -k "expo start" "pnpm --dir apps/server run dev"',
    );
    assert.equal(rootManifest.scripts.build, 'pnpm --dir apps/server run build');
    assert.equal(
      rootManifest.scripts['server:start:prod'],
      'pnpm --dir apps/server run start:prod',
    );
    assert.equal(rootManifest.scripts.test, 'pnpm --dir apps/server run test');
    assert.equal(
      rootManifest.scripts['test:integration'],
      'pnpm --dir apps/server run test:integration',
    );
    assert.equal(
      rootManifest.scripts.typecheck,
      'tsc --noEmit --pretty false && pnpm --dir apps/server run typecheck',
    );

    assert.match(
      readVirtualText(tree, '.env.example'),
      /EXPO_PUBLIC_API_URL=http:\/\/192\.168\.1\.100:3000/,
    );
    assert.equal(
      readVirtualText(tree, 'apps/server/.env.example'),
      'PORT=3000\nCLIENT_ORIGIN=http://localhost:8081\n',
    );
    assert.match(readVirtualText(tree, 'pnpm-workspace.yaml'), /- 'apps\/server'/);
    assert.match(readVirtualText(tree, 'apps/server/src/app.ts'), /app\.get\('\/health'/);
    assert.match(
      readVirtualText(tree, 'apps/server/src/app.ts'),
      /app\.get\('\/api\/business-profile'/,
    );
    assert.match(
      readVirtualText(tree, 'src/business-data/use-business-profile.ts'),
      /from 'expo\/fetch'/,
    );
    assert.match(readVirtualText(tree, 'README.md'), /physical devices/);
    assert.match(readVirtualText(tree, 'README.md'), /http:\/\/10\.0\.2\.2:3000/);
    assert.match(generatedText, /Auth: none/);
    assert.notMatch(
      generatedText,
      /better-auth|CLERK_|DATABASE_URL|drizzle|mysql2|packages\/auth|packages\/db|from 'pg'|prisma/i,
    );
  }
});

test('writes each Express Setup Type as a fresh project outside the workspace', async () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const tempRoot = await fs.mkdtemp(join(tmpdir(), 'tenkit-express-proof-'));
    tempRoots.push(tempRoot);
    const targetDir = join(tempRoot, 'generated-app');

    await runGenerationProof({
      setupType,
      generatedAppOptions: EXPRESS_OPTIONS,
      stylingChoice: 'bare',
      packageManager: 'pnpm',
      targetDir,
      git: false,
      workspaceRoot: join(tempRoot, 'tenkit-workspace'),
    });

    expect(await fs.pathExists(join(targetDir, 'apps/server/package.json'))).toBe(true);
    expect(await fs.pathExists(join(targetDir, 'packages/auth'))).toBe(false);
    expect(await fs.pathExists(join(targetDir, 'packages/db'))).toBe(false);
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
  'generates coherent $packageManager workspace commands',
  ({ packageManager, serverRunCommand, usesManifestWorkspace }) => {
    const tree = generateProject({
      setupType: 'white-label-apps',
      stylingChoice: 'bare',
      packageManager,
      generatedAppOptions: EXPRESS_OPTIONS,
    });
    const rootManifest = readVirtualManifest(tree, 'package.json') as {
      scripts: Record<string, string>;
      workspaces?: string[];
    };

    assert.equal(
      rootManifest.scripts.dev,
      `concurrently -k "expo start" "${serverRunCommand} dev"`,
    );
    assert.equal(rootManifest.scripts.build, `${serverRunCommand} build`);
    assert.equal(rootManifest.scripts['server:start:prod'], `${serverRunCommand} start:prod`);
    assert.deepEqual(rootManifest.workspaces, usesManifestWorkspace ? ['apps/server'] : undefined);
    assert.equal(
      tree.some(({ path }) => path === 'pnpm-workspace.yaml'),
      packageManager === 'pnpm',
    );
  },
);
