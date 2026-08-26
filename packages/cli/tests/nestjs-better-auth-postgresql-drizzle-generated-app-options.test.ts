/// <reference types="node" />

import fs from 'fs-extra';
import { join } from 'pathe';
import { expect, test, vi } from 'vitest';

import { generateProject } from '@tenkit/template-generator';

import { runCreateFlow } from '../src/create/run-create';
import type { PromptAdapter } from '../src/create/types';
import { createEnvironment, createTempRoot } from './generated-app-options-test-helpers';

test('interactive creation resolves NestJS with Better Auth, PostgreSQL, and Drizzle', async () => {
  const tempRoot = await createTempRoot();
  const prompts: PromptAdapter = {
    text: vi.fn(async () => {
      throw new Error('Unexpected text prompt.');
    }),
    select: vi.fn(async (options) => {
      if (options.message === 'Backend') return 'nestjs';
      if (options.message === 'Auth') return 'better-auth';
      if (options.message === 'ORM') return 'drizzle';
      return options.initialValue;
    }),
    confirm: vi.fn(async () => false),
  };

  const result = await runCreateFlow(
    {
      name: 'interactive-nestjs-better-auth-postgresql-drizzle',
      setup: 'runtime-tenants',
      styling: 'bare',
      packageManager: 'pnpm',
      install: false,
      git: false,
      dryRun: true,
    },
    createEnvironment(tempRoot, { isInteractive: true, prompts }),
  );

  expect(result.generatedAppOptions).toEqual({
    backend: 'nestjs',
    auth: 'better-auth',
    database: 'postgresql',
    orm: 'drizzle',
  });
  expect(prompts.select).toHaveBeenCalledWith({
    message: 'ORM',
    initialValue: 'prisma',
    options: [
      { value: 'prisma', label: 'Prisma' },
      { value: 'drizzle', label: 'Drizzle' },
    ],
  });
});

test('explicit flags write the protected NestJS PostgreSQL Drizzle stack', async () => {
  const tempRoot = await createTempRoot();
  const generate = vi.fn(generateProject);
  const environment = createEnvironment(tempRoot, { generate });

  const result = await runCreateFlow(
    {
      name: 'nestjs-better-auth-postgresql-drizzle-app',
      backend: 'nestjs',
      auth: 'better-auth',
      database: 'postgresql',
      orm: 'drizzle',
      yes: true,
      install: false,
      git: false,
    },
    environment,
  );

  expect(result.generatedAppOptions).toEqual({
    backend: 'nestjs',
    auth: 'better-auth',
    database: 'postgresql',
    orm: 'drizzle',
  });
  expect(generate).toHaveBeenCalledWith(
    expect.objectContaining({ generatedAppOptions: result.generatedAppOptions }),
  );
  expect(environment.lines).toContain('- Backend: nestjs');
  expect(environment.lines).toContain('- Auth: better-auth');
  expect(environment.lines).toContain('- Database: postgresql');
  expect(environment.lines).toContain('- ORM: drizzle');
  expect(environment.lines).toContain('- pnpm run db:setup');
  expect(
    await fs.readJson(
      join(tempRoot, 'nestjs-better-auth-postgresql-drizzle-app/apps/server/package.json'),
    ),
  ).toMatchObject({
    dependencies: {
      '@tenkit/auth': 'workspace:*',
      '@tenkit/db': 'workspace:*',
      '@thallesp/nestjs-better-auth': '2.7.0',
    },
  });
  expect(
    await fs.readJson(
      join(tempRoot, 'nestjs-better-auth-postgresql-drizzle-app/packages/auth/package.json'),
    ),
  ).toMatchObject({ dependencies: { '@better-auth/drizzle-adapter': '1.6.25' } });
  expect(
    await fs.readJson(
      join(tempRoot, 'nestjs-better-auth-postgresql-drizzle-app/packages/db/package.json'),
    ),
  ).toMatchObject({ dependencies: { 'drizzle-orm': '0.45.2', pg: '8.16.3' } });
});
