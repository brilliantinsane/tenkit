/// <reference types="node" />

import fs from 'fs-extra';
import { join } from 'pathe';
import { expect, test, vi } from 'vitest';

import { generateProject } from '@tenkit/template-generator';

import { runCreateFlow } from '../src/create/run-create';
import type { PromptAdapter } from '../src/create/types';
import { createEnvironment, createTempRoot } from './generated-app-options-test-helpers';

const EXPRESS_CLERK_MYSQL_DRIZZLE_OPTIONS = {
  backend: 'express',
  auth: 'clerk',
  database: 'mysql',
  orm: 'drizzle',
} as const;

test('interactive creation resolves Express with Clerk, MySQL, and Drizzle', async () => {
  const tempRoot = await createTempRoot();
  const prompts: PromptAdapter = {
    text: vi.fn(async () => {
      throw new Error('Unexpected text prompt.');
    }),
    select: vi.fn(async (options) => {
      if (options.message === 'Backend') return 'express';
      if (options.message === 'Auth') return 'clerk';
      if (options.message === 'Database') return 'mysql';
      if (options.message === 'ORM') return 'drizzle';
      return options.initialValue;
    }),
    confirm: vi.fn(async () => false),
  };

  const result = await runCreateFlow(
    {
      name: 'interactive-express-clerk-mysql-drizzle',
      setup: 'generic-standalone',
      styling: 'bare',
      packageManager: 'pnpm',
      install: false,
      git: false,
      dryRun: true,
    },
    createEnvironment(tempRoot, { isInteractive: true, prompts }),
  );

  expect(result.generatedAppOptions).toEqual(EXPRESS_CLERK_MYSQL_DRIZZLE_OPTIONS);
  expect(prompts.select).toHaveBeenCalledWith({
    message: 'ORM',
    initialValue: 'prisma',
    options: [
      { value: 'prisma', label: 'Prisma' },
      { value: 'drizzle', label: 'Drizzle' },
    ],
  });
});

test('explicit flags write the protected Express Clerk MySQL Drizzle stack', async () => {
  const tempRoot = await createTempRoot();
  const generate = vi.fn(generateProject);
  const environment = createEnvironment(tempRoot, { generate });

  const result = await runCreateFlow(
    {
      name: 'express-clerk-mysql-drizzle-app',
      ...EXPRESS_CLERK_MYSQL_DRIZZLE_OPTIONS,
      yes: true,
      install: false,
      git: false,
    },
    environment,
  );

  expect(result.generatedAppOptions).toEqual(EXPRESS_CLERK_MYSQL_DRIZZLE_OPTIONS);
  expect(generate).toHaveBeenCalledWith(
    expect.objectContaining({ generatedAppOptions: EXPRESS_CLERK_MYSQL_DRIZZLE_OPTIONS }),
  );
  expect(environment.lines).toContain('- Auth: clerk');
  expect(environment.lines).toContain('- Database: mysql');
  expect(environment.lines).toContain('- ORM: drizzle');
  expect(environment.lines).toContain('- Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in .env.local');
  expect(environment.lines).toContain(
    '- Set CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in apps/server/.env.local',
  );
  expect(environment.lines).toContain(
    '- Set DATABASE_URL in apps/server/.env.local to your MySQL database',
  );
  expect(
    await fs.readJson(join(tempRoot, 'express-clerk-mysql-drizzle-app/packages/db/package.json')),
  ).toMatchObject({ dependencies: { 'drizzle-orm': '0.45.2', mysql2: '3.20.0' } });
  expect(await fs.pathExists(join(tempRoot, 'express-clerk-mysql-drizzle-app/packages/auth'))).toBe(
    false,
  );
});
