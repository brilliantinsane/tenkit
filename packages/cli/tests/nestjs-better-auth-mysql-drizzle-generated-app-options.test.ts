/// <reference types="node" />

import fs from 'fs-extra';
import { join } from 'pathe';
import { expect, test, vi } from 'vitest';

import { generateProject } from '@tenkit/template-generator';

import { runCreateFlow } from '../src/create/run-create';
import type { PromptAdapter } from '../src/create/types';
import { createEnvironment, createTempRoot } from './generated-app-options-test-helpers';

test('interactive creation resolves NestJS with Better Auth, MySQL, and Drizzle', async () => {
  const tempRoot = await createTempRoot();
  const prompts: PromptAdapter = {
    text: vi.fn(async () => {
      throw new Error('Unexpected text prompt.');
    }),
    select: vi.fn(async (options) => {
      if (options.message === 'Backend') return 'nestjs';
      if (options.message === 'Auth') return 'better-auth';
      if (options.message === 'Database') return 'mysql';
      if (options.message === 'ORM') return 'drizzle';
      return options.initialValue;
    }),
    confirm: vi.fn(async () => false),
  };

  const result = await runCreateFlow(
    {
      name: 'interactive-nestjs-better-auth-mysql-drizzle',
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
    backend: 'nestjs',
    auth: 'better-auth',
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

test('explicit flags write the protected NestJS MySQL Drizzle stack', async () => {
  const tempRoot = await createTempRoot();
  const generate = vi.fn(generateProject);
  const environment = createEnvironment(tempRoot, { generate });

  const result = await runCreateFlow(
    {
      name: 'nestjs-better-auth-mysql-drizzle-app',
      backend: 'nestjs',
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
    backend: 'nestjs',
    auth: 'better-auth',
    database: 'mysql',
    orm: 'drizzle',
  });
  expect(generate).toHaveBeenCalledWith(
    expect.objectContaining({ generatedAppOptions: result.generatedAppOptions }),
  );
  expect(environment.lines).toEqual(
    expect.arrayContaining([
      '- Backend: nestjs',
      '- Auth: better-auth',
      '- Database: mysql',
      '- ORM: drizzle',
      '- Set BETTER_AUTH_URL and a 32-character BETTER_AUTH_SECRET in apps/server/.env.local',
      '- Set DATABASE_URL in apps/server/.env.local to your MySQL database',
      '- pnpm run db:setup',
    ]),
  );
  await expect(
    fs.readJson(join(tempRoot, 'nestjs-better-auth-mysql-drizzle-app/apps/server/package.json')),
  ).resolves.toMatchObject({
    dependencies: {
      '@tenkit/auth': 'workspace:*',
      '@tenkit/db': 'workspace:*',
      '@thallesp/nestjs-better-auth': '2.7.0',
    },
  });
  await expect(
    fs.readJson(join(tempRoot, 'nestjs-better-auth-mysql-drizzle-app/packages/auth/package.json')),
  ).resolves.toMatchObject({ dependencies: { '@better-auth/drizzle-adapter': '1.6.25' } });
  await expect(
    fs.readJson(join(tempRoot, 'nestjs-better-auth-mysql-drizzle-app/packages/db/package.json')),
  ).resolves.toMatchObject({ dependencies: { 'drizzle-orm': '0.45.2', mysql2: '3.20.0' } });
});
