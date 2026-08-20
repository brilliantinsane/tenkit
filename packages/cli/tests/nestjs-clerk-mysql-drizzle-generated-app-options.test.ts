/// <reference types="node" />

import fs from 'fs-extra';
import { join } from 'pathe';
import { expect, test, vi } from 'vitest';

import { generateProject } from '@tenkit/template-generator';

import { runCreateFlow } from '../src/create/run-create';
import type { PromptAdapter } from '../src/create/types';
import { createEnvironment, createTempRoot } from './generated-app-options-test-helpers';

const OPTIONS = {
  backend: 'nestjs',
  auth: 'clerk',
  database: 'mysql',
  orm: 'drizzle',
} as const;

test('interactive creation resolves NestJS with Clerk, MySQL, and Drizzle', async () => {
  const tempRoot = await createTempRoot();
  const prompts: PromptAdapter = {
    text: vi.fn(async () => {
      throw new Error('Unexpected text prompt.');
    }),
    select: vi.fn(async (options) => {
      if (options.message === 'Backend') return 'nestjs';
      if (options.message === 'Auth') return 'clerk';
      if (options.message === 'Database') return 'mysql';
      if (options.message === 'ORM') return 'drizzle';
      return options.initialValue;
    }),
    confirm: vi.fn(async () => false),
  };

  const result = await runCreateFlow(
    {
      name: 'interactive-nestjs-clerk-mysql-drizzle',
      setup: 'generic-standalone',
      styling: 'bare',
      packageManager: 'pnpm',
      install: false,
      git: false,
      dryRun: true,
    },
    createEnvironment(tempRoot, { isInteractive: true, prompts }),
  );

  expect(result.generatedAppOptions).toEqual(OPTIONS);
});

test('explicit flags write the protected NestJS Clerk MySQL Drizzle stack', async () => {
  const tempRoot = await createTempRoot();
  const generate = vi.fn(generateProject);
  const environment = createEnvironment(tempRoot, { generate });

  const result = await runCreateFlow(
    {
      name: 'nestjs-clerk-mysql-drizzle-app',
      ...OPTIONS,
      yes: true,
      install: false,
      git: false,
    },
    environment,
  );

  expect(result.generatedAppOptions).toEqual(OPTIONS);
  expect(generate).toHaveBeenCalledWith(expect.objectContaining({ generatedAppOptions: OPTIONS }));
  expect(environment.lines).toEqual(
    expect.arrayContaining([
      '- Backend: nestjs',
      '- Auth: clerk',
      '- Database: mysql',
      '- ORM: drizzle',
      '- Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in .env.local',
      '- Set CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in apps/server/.env.local',
      '- Set DATABASE_URL in apps/server/.env.local to your MySQL database',
      '- pnpm run db:setup',
    ]),
  );
  await expect(
    fs.readJson(join(tempRoot, 'nestjs-clerk-mysql-drizzle-app/apps/server/package.json')),
  ).resolves.toMatchObject({
    dependencies: {
      '@clerk/express': '2.1.50',
      '@tenkit/db': 'workspace:*',
    },
  });
  await expect(
    fs.readJson(join(tempRoot, 'nestjs-clerk-mysql-drizzle-app/packages/db/package.json')),
  ).resolves.toMatchObject({ dependencies: { 'drizzle-orm': '0.45.2', mysql2: '3.20.0' } });
  await expect(
    fs.pathExists(join(tempRoot, 'nestjs-clerk-mysql-drizzle-app/packages/auth')),
  ).resolves.toBe(false);
});
