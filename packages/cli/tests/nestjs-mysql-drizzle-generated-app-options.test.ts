/// <reference types="node" />

import fs from 'fs-extra';
import { join } from 'pathe';
import { expect, test, vi } from 'vitest';

import { generateProject } from '@tenkit/template-generator';

import { runCreateFlow } from '../src/create/run-create';
import type { PromptAdapter } from '../src/create/types';
import { createEnvironment, createTempRoot } from './generated-app-options-test-helpers';

test('interactive creation resolves NestJS with MySQL and Drizzle without Auth', async () => {
  const tempRoot = await createTempRoot();
  const prompts: PromptAdapter = {
    text: vi.fn(async () => {
      throw new Error('Unexpected text prompt.');
    }),
    select: vi.fn(async (options) => {
      if (options.message === 'Backend') return 'nestjs';
      if (options.message === 'Auth') return 'none';
      if (options.message === 'Database') return 'mysql';
      if (options.message === 'ORM') return 'drizzle';
      return options.initialValue;
    }),
    confirm: vi.fn(async () => false),
  };

  const result = await runCreateFlow(
    {
      name: 'interactive-nestjs-mysql-drizzle',
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

test('explicit flags write the Auth-free NestJS MySQL Drizzle stack', async () => {
  const tempRoot = await createTempRoot();
  const generate = vi.fn(generateProject);
  const environment = createEnvironment(tempRoot, { generate });

  const result = await runCreateFlow(
    {
      name: 'nestjs-mysql-drizzle-app',
      backend: 'nestjs',
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
    backend: 'nestjs',
    auth: 'none',
    database: 'mysql',
    orm: 'drizzle',
  });
  expect(generate).toHaveBeenCalledWith(
    expect.objectContaining({ generatedAppOptions: result.generatedAppOptions }),
  );
  expect(environment.lines).toEqual(
    expect.arrayContaining([
      '- Backend: nestjs',
      '- Auth: none',
      '- Database: mysql',
      '- ORM: drizzle',
      '- pnpm run db:setup',
    ]),
  );
  expect(
    await fs.readJson(join(tempRoot, 'nestjs-mysql-drizzle-app/packages/db/package.json')),
  ).toMatchObject({ dependencies: { 'drizzle-orm': '0.45.2', mysql2: '3.20.0' } });
  expect(await fs.pathExists(join(tempRoot, 'nestjs-mysql-drizzle-app/packages/auth'))).toBe(false);
});
