/// <reference types="node" />

import fs from 'fs-extra';
import { join } from 'pathe';
import { expect, test, vi } from 'vitest';

import { generateProject } from '@tenkit/template-generator';

import { runCreateFlow } from '../src/create/run-create';
import type { PromptAdapter } from '../src/create/types';
import { createEnvironment, createTempRoot } from './generated-app-options-test-helpers';

test('interactive creation resolves NestJS with MySQL and Prisma without Auth', async () => {
  const tempRoot = await createTempRoot();
  const prompts: PromptAdapter = {
    text: vi.fn(async () => {
      throw new Error('Unexpected text prompt.');
    }),
    select: vi.fn(async (options) => {
      if (options.message === 'Backend') return 'nestjs';
      if (options.message === 'Auth') return 'none';
      if (options.message === 'Database') return 'mysql';
      if (options.message === 'ORM') return 'prisma';
      return options.initialValue;
    }),
    confirm: vi.fn(async () => false),
  };

  const result = await runCreateFlow(
    {
      name: 'interactive-nestjs-mysql-prisma',
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
    backend: 'nestjs',
    auth: 'none',
    database: 'mysql',
    orm: 'prisma',
  });
  expect(prompts.select).toHaveBeenCalledWith({
    message: 'Database',
    initialValue: 'none',
    options: [
      { value: 'none', label: 'None' },
      { value: 'postgresql', label: 'PostgreSQL' },
      { value: 'mysql', label: 'MySQL' },
    ],
  });
});

test('explicit flags write the Auth-free NestJS MySQL Prisma stack', async () => {
  const tempRoot = await createTempRoot();
  const generate = vi.fn(generateProject);
  const environment = createEnvironment(tempRoot, { generate });

  const result = await runCreateFlow(
    {
      name: 'nestjs-mysql-prisma-app',
      backend: 'nestjs',
      auth: 'none',
      database: 'mysql',
      orm: 'prisma',
      yes: true,
      install: false,
      git: false,
    },
    environment,
  );

  expect(result.generatedAppOptions).toEqual({
    backend: 'nestjs',
    auth: 'none',
    database: 'mysql',
    orm: 'prisma',
  });
  expect(environment.lines).toContain('- Backend: nestjs');
  expect(environment.lines).toContain('- Auth: none');
  expect(environment.lines).toContain('- Database: mysql');
  expect(environment.lines).toContain('- ORM: prisma');
  expect(environment.lines).toContain('- pnpm run db:setup');
  expect(
    await fs.readJson(join(tempRoot, 'nestjs-mysql-prisma-app/apps/server/package.json')),
  ).toMatchObject({ dependencies: { '@tenkit/db': 'workspace:*' } });
  expect(
    await fs.readJson(join(tempRoot, 'nestjs-mysql-prisma-app/packages/db/package.json')),
  ).toMatchObject({
    dependencies: {
      '@prisma/adapter-mariadb': '7.5.0',
      '@prisma/client': '7.5.0',
    },
  });
  expect(await fs.pathExists(join(tempRoot, 'nestjs-mysql-prisma-app/packages/auth'))).toBe(false);
});
