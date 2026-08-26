/// <reference types="node" />

import fs from 'fs-extra';
import { join } from 'pathe';
import { expect, test, vi } from 'vitest';

import { generateProject } from '@tenkit/template-generator';

import { runCreateFlow } from '../src/create/run-create';
import type { PromptAdapter } from '../src/create/types';
import { createEnvironment, createTempRoot } from './generated-app-options-test-helpers';

test('interactive creation resolves Express with Clerk, PostgreSQL, and Drizzle', async () => {
  const tempRoot = await createTempRoot();
  const prompts: PromptAdapter = {
    text: vi.fn(async () => {
      throw new Error('Unexpected text prompt.');
    }),
    select: vi.fn(async (options) => {
      if (options.message === 'Backend') {
        return 'express';
      }
      if (options.message === 'Auth') {
        return 'clerk';
      }
      if (options.message === 'Database') {
        return 'postgresql';
      }
      if (options.message === 'ORM') {
        return 'drizzle';
      }
      return options.initialValue;
    }),
    confirm: vi.fn(async () => false),
  };

  const result = await runCreateFlow(
    {
      name: 'interactive-express-clerk-postgresql-drizzle',
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
    auth: 'clerk',
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

test('explicit flags write the protected Express Clerk PostgreSQL Drizzle stack', async () => {
  const tempRoot = await createTempRoot();
  const generate = vi.fn(generateProject);
  const environment = createEnvironment(tempRoot, { generate });

  const result = await runCreateFlow(
    {
      name: 'express-clerk-postgresql-drizzle-app',
      backend: 'express',
      auth: 'clerk',
      database: 'postgresql',
      orm: 'drizzle',
      yes: true,
      install: false,
      git: false,
    },
    environment,
  );

  expect(result.generatedAppOptions).toEqual({
    backend: 'express',
    auth: 'clerk',
    database: 'postgresql',
    orm: 'drizzle',
  });
  expect(generate).toHaveBeenCalledWith(
    expect.objectContaining({ generatedAppOptions: result.generatedAppOptions }),
  );
  expect(environment.lines).toContain('- Backend: express');
  expect(environment.lines).toContain('- Auth: clerk');
  expect(environment.lines).toContain('- Database: postgresql');
  expect(environment.lines).toContain('- ORM: drizzle');
  expect(environment.lines).toContain('- Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in .env.local');
  expect(environment.lines).toContain(
    '- Set CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in apps/server/.env.local',
  );
  expect(environment.lines).toContain('- pnpm run db:setup');
  expect(
    await fs.readJson(
      join(tempRoot, 'express-clerk-postgresql-drizzle-app/apps/server/package.json'),
    ),
  ).toMatchObject({
    dependencies: {
      '@clerk/express': '2.1.50',
      '@tenkit/db': 'workspace:*',
    },
  });
  expect(
    await fs.readJson(
      join(tempRoot, 'express-clerk-postgresql-drizzle-app/packages/db/package.json'),
    ),
  ).toMatchObject({
    dependencies: {
      'drizzle-orm': '0.45.2',
      pg: '8.16.3',
    },
  });
  expect(
    await fs.pathExists(
      join(tempRoot, 'express-clerk-postgresql-drizzle-app/src/auth/clerk-provider.tsx'),
    ),
  ).toBe(true);
  expect(
    await fs.pathExists(join(tempRoot, 'express-clerk-postgresql-drizzle-app/packages/auth')),
  ).toBe(false);
});
