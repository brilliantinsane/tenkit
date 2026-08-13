/// <reference types="node" />

import fs from 'fs-extra';
import { join } from 'pathe';
import { expect, test, vi } from 'vitest';

import { generateProject } from '@tenkit/template-generator';

import { runCreateFlow } from '../src/create/run-create';
import type { PromptAdapter } from '../src/create/types';
import { createEnvironment, createTempRoot } from './generated-app-options-test-helpers';

test('interactive creation resolves Express with Clerk, MySQL, and Prisma', async () => {
  const tempRoot = await createTempRoot();
  const prompts: PromptAdapter = {
    text: vi.fn(async () => {
      throw new Error('Unexpected text prompt.');
    }),
    select: vi.fn(async (options) => {
      if (options.message === 'Backend') return 'express';
      if (options.message === 'Auth') return 'clerk';
      if (options.message === 'Database') return 'mysql';
      return options.initialValue;
    }),
    confirm: vi.fn(async () => false),
  };

  const result = await runCreateFlow(
    {
      name: 'interactive-express-clerk-mysql-prisma',
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
    auth: 'clerk',
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
  expect(prompts.select).not.toHaveBeenCalledWith(expect.objectContaining({ message: 'ORM' }));
});

test('explicit flags write the protected Express Clerk MySQL Prisma stack', async () => {
  const tempRoot = await createTempRoot();
  const generate = vi.fn(generateProject);
  const environment = createEnvironment(tempRoot, { generate });

  const result = await runCreateFlow(
    {
      name: 'express-clerk-mysql-prisma-app',
      backend: 'express',
      auth: 'clerk',
      database: 'mysql',
      orm: 'prisma',
      yes: true,
      install: false,
      git: false,
    },
    environment,
  );

  expect(result.generatedAppOptions).toEqual({
    backend: 'express',
    auth: 'clerk',
    database: 'mysql',
    orm: 'prisma',
  });
  expect(generate).toHaveBeenCalledWith(
    expect.objectContaining({ generatedAppOptions: result.generatedAppOptions }),
  );
  expect(environment.lines).toContain('- Backend: express');
  expect(environment.lines).toContain('- Auth: clerk');
  expect(environment.lines).toContain('- Database: mysql');
  expect(environment.lines).toContain('- ORM: prisma');
  expect(environment.lines).toContain('- Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in .env.local');
  expect(environment.lines).toContain(
    '- Set CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in apps/server/.env.local',
  );
  expect(environment.lines).toContain(
    '- Set DATABASE_URL in apps/server/.env.local to your MySQL database',
  );
  expect(environment.lines).toContain('- pnpm run db:setup');
  expect(
    await fs.readJson(join(tempRoot, 'express-clerk-mysql-prisma-app/apps/server/package.json')),
  ).toMatchObject({ dependencies: { '@clerk/express': '2.1.50', '@tenkit/db': 'workspace:*' } });
  expect(
    await fs.readJson(join(tempRoot, 'express-clerk-mysql-prisma-app/packages/db/package.json')),
  ).toMatchObject({ dependencies: { '@prisma/adapter-mariadb': '7.5.0' } });
  expect(await fs.pathExists(join(tempRoot, 'express-clerk-mysql-prisma-app/packages/auth'))).toBe(
    false,
  );
});
