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

const NESTJS_OPTIONS = {
  backend: 'nestjs',
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

test('generates the exact Auth-free Database-free NestJS shape for every Setup Type', () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const tree = generateProject({
      setupType,
      stylingChoice: 'bare',
      packageManager: 'pnpm',
      generatedAppOptions: NESTJS_OPTIONS,
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
      'apps/server/nest-cli.json',
      'apps/server/package.json',
      'apps/server/src/app.module.ts',
      'apps/server/src/business-profile/business-profile-query.dto.ts',
      'apps/server/src/business-profile/business-profile.controller.ts',
      'apps/server/src/business-profile/business-profile.module.ts',
      'apps/server/src/business-profile/business-profile.service.ts',
      'apps/server/src/configure-application.ts',
      'apps/server/src/health/health.controller.ts',
      'apps/server/src/health/health.module.ts',
      'apps/server/src/main.ts',
      'apps/server/src/server-environment.ts',
      'apps/server/tests/app.test.ts',
      'apps/server/tests/integration.test.ts',
      'apps/server/tsconfig.build.json',
      'apps/server/tsconfig.json',
      'src/business-data/use-business-profile.ts',
    ]);
    assert.notInclude(paths, 'packages/auth/package.json');
    assert.notInclude(paths, 'packages/db/package.json');

    assert.deepEqual(serverManifest.dependencies, {
      '@nestjs/common': '11.1.28',
      '@nestjs/config': '4.0.4',
      '@nestjs/core': '11.1.28',
      '@nestjs/platform-express': '11.1.28',
      '@nestjs/terminus': '11.1.1',
      'class-transformer': '0.5.1',
      'class-validator': '0.14.2',
      'reflect-metadata': '0.2.2',
      rxjs: '7.8.2',
      zod: '4.4.3',
    });
    assert.deepEqual(serverManifest.devDependencies, {
      '@nestjs/cli': '11.0.24',
      '@nestjs/testing': '11.1.28',
      '@types/node': '^25.9.3',
      '@types/supertest': '^6.0.3',
      supertest: '^7.2.2',
      typescript: '~6.0.3',
      vitest: '^4.1.9',
    });
    assert.deepEqual(serverManifest.scripts, {
      build: 'nest build',
      dev: 'nest start --watch',
      'start:prod': 'node dist/main.js',
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
    assert.match(readVirtualText(tree, 'apps/server/src/main.ts'), /enableShutdownHooks\(\)/);
    assert.match(
      readVirtualText(tree, 'apps/server/src/configure-application.ts'),
      /new ValidationPipe/,
    );
    assert.match(
      readVirtualText(tree, 'apps/server/src/business-profile/business-profile.controller.ts'),
      /@Controller\('api\/business-profile'\)/,
    );
    assert.match(
      readVirtualText(tree, 'src/business-data/use-business-profile.ts'),
      /from 'expo\/fetch'/,
    );
    assert.match(readVirtualText(tree, 'README.md'), /## NestJS Backend/);
    assert.match(readVirtualText(tree, 'README.md'), /physical devices/);
    assert.match(generatedText, /Auth: none/);
    assert.notMatch(
      generatedText,
      /better-auth|CLERK_|DATABASE_URL|drizzle|fastify|mysql2|packages\/auth|packages\/db|from 'pg'|prisma|prototype/i,
    );
  }
});

test('writes each NestJS Setup Type as a fresh project outside the workspace', async () => {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const tempRoot = await fs.mkdtemp(join(tmpdir(), 'tenkit-nestjs-proof-'));
    tempRoots.push(tempRoot);
    const targetDir = join(tempRoot, 'generated-app');

    await runGenerationProof({
      setupType,
      generatedAppOptions: NESTJS_OPTIONS,
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
    serverRunCommand: 'bun run --cwd apps/server',
    usesManifestWorkspace: true,
  },
] as const)(
  'generates coherent $packageManager NestJS workspace commands',
  ({ packageManager, serverRunCommand, usesManifestWorkspace }) => {
    const tree = generateProject({
      setupType: 'white-label-apps',
      stylingChoice: 'bare',
      packageManager,
      generatedAppOptions: NESTJS_OPTIONS,
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
