/// <reference types="node" />

import fs from 'fs-extra';
import { join } from 'pathe';
import { expect, test, vi } from 'vitest';

import { generateProject } from '@tenkit/template-generator';

import { runCreateFlow } from '../src/create/run-create';
import type { PromptAdapter } from '../src/create/types';
import { createEnvironment, createTempRoot } from './generated-app-options-test-helpers';

test('interactive creation resolves Express with Better Auth, MySQL, and Drizzle', async () => {
  const tempRoot = await createTempRoot();
  const prompts: PromptAdapter = {
    text: vi.fn(async () => {
      throw new Error('Unexpected text prompt.');
    }),
    select: vi.fn(async (options) => {
      if (options.message === 'Backend') return 'express';
      if (options.message === 'Auth') return 'better-auth';
      if (options.message === 'Database') return 'mysql';
      if (options.message === 'ORM') return 'drizzle';
      return options.initialValue;
    }),
    confirm: vi.fn(async () => false),
  };

  const result = await runCreateFlow(
    {
      name: 'interactive-express-better-auth-mysql-drizzle',
      setup: 'generic-standalone',
      styling: 'bare',
      packageManager: 'pnpm',
      install: false,
      git: false,
      dryRun: true,
    },
    createEnvironment(tempRoot, { isInteractive: true, prompts }),
  );

  expect(result.generatedAppOptions).toEqual({
    backend: 'express',
    auth: 'better-auth',
    database: 'mysql',
    orm: 'drizzle',
  });
});

test('explicit flags write the protected Express MySQL Drizzle stack', async () => {
  const tempRoot = await createTempRoot();
  const generate = vi.fn(generateProject);
  const environment = createEnvironment(tempRoot, { generate });

  const result = await runCreateFlow(
    {
      name: 'express-better-auth-mysql-drizzle-app',
      backend: 'express',
      auth: 'better-auth',
      database: 'mysql',
      orm: 'drizzle',
      yes: true,
      install: false,
      git: false,
    },
    environment,
  );

  expect(result.generatedAppOptions).toEqual({
    backend: 'express',
    auth: 'better-auth',
    database: 'mysql',
    orm: 'drizzle',
  });
  expect(environment.lines).toContain('- ORM: drizzle');
  expect(environment.lines).toContain('- pnpm run db:setup');
  expect(
    await fs.readJson(
      join(tempRoot, 'express-better-auth-mysql-drizzle-app/packages/auth/package.json'),
    ),
  ).toMatchObject({ dependencies: { '@better-auth/drizzle-adapter': '1.6.25' } });
  expect(
    await fs.readJson(
      join(tempRoot, 'express-better-auth-mysql-drizzle-app/packages/db/package.json'),
    ),
  ).toMatchObject({ dependencies: { 'drizzle-orm': '0.45.2', mysql2: '3.20.0' } });
});
