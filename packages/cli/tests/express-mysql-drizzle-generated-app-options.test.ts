/// <reference types="node" />

import fs from 'fs-extra';
import { join } from 'pathe';
import { expect, test, vi } from 'vitest';

import { generateProject } from '@tenkit/template-generator';

import { runCreateFlow } from '../src/create/run-create';
import type { PromptAdapter } from '../src/create/types';
import { createEnvironment, createTempRoot } from './generated-app-options-test-helpers';

test('interactive creation resolves Express with MySQL and Drizzle without Auth', async () => {
  const tempRoot = await createTempRoot();
  const prompts: PromptAdapter = {
    text: vi.fn(async () => {
      throw new Error('Unexpected text prompt.');
    }),
    select: vi.fn(async (options) => {
      if (options.message === 'Backend') return 'express';
      if (options.message === 'Auth') return 'none';
      if (options.message === 'Database') return 'mysql';
      if (options.message === 'ORM') return 'drizzle';
      return options.initialValue;
    }),
    confirm: vi.fn(async () => false),
  };

  const result = await runCreateFlow(
    {
      name: 'interactive-express-mysql-drizzle',
      setup: 'white-label',
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
    auth: 'none',
    database: 'mysql',
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

test('explicit flags write the Auth-free Express MySQL Drizzle stack', async () => {
  const tempRoot = await createTempRoot();
  const generate = vi.fn(generateProject);
  const environment = createEnvironment(tempRoot, { generate });

  const result = await runCreateFlow(
    {
      name: 'express-mysql-drizzle-app',
      backend: 'express',
      auth: 'none',
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
    auth: 'none',
    database: 'mysql',
    orm: 'drizzle',
  });
  expect(environment.lines).toContain('- Backend: express');
  expect(environment.lines).toContain('- Auth: none');
  expect(environment.lines).toContain('- Database: mysql');
  expect(environment.lines).toContain('- ORM: drizzle');
  expect(environment.lines).toContain('- pnpm run db:setup');
  expect(
    await fs.readJson(join(tempRoot, 'express-mysql-drizzle-app/packages/db/package.json')),
  ).toMatchObject({
    dependencies: {
      'drizzle-orm': '0.45.2',
      mysql2: '3.20.0',
    },
  });
  expect(await fs.pathExists(join(tempRoot, 'express-mysql-drizzle-app/packages/auth'))).toBe(
    false,
  );
});
