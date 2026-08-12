/// <reference types="node" />

import { tmpdir } from 'node:os';

import fs from 'fs-extra';
import { join } from 'pathe';
import { afterEach, expect, test, vi } from 'vitest';

import { generateProject } from '@tenkit/template-generator';
import { DEFAULT_GENERATED_APP_OPTIONS } from '@tenkit/types/generated-app-option-definitions';

import { createProgram } from '../src/commands/create';
import { runCreateFlow } from '../src/create/run-create';
import type { CreateFlowEnvironment, PromptAdapter } from '../src/create/types';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((tempRoot) => fs.remove(tempRoot)));
});

async function createTempRoot(): Promise<string> {
  const tempRoot = await fs.mkdtemp(join(tmpdir(), 'tenkit-cli-options-test-'));
  tempRoots.push(tempRoot);
  return tempRoot;
}

function createEnvironment(
  cwd: string,
  overrides: Partial<CreateFlowEnvironment> = {},
): CreateFlowEnvironment & { lines: string[] } {
  const lines: string[] = [];
  const prompts: PromptAdapter = {
    text: vi.fn(async () => {
      throw new Error('Unexpected text prompt.');
    }),
    select: vi.fn(async () => {
      throw new Error('Unexpected select prompt.');
    }),
    confirm: vi.fn(async () => false),
  };

  return {
    cwd,
    isInteractive: false,
    lines,
    output: {
      log(message = '') {
        lines.push(message);
      },
      error(message) {
        lines.push(message);
      },
    },
    prompts,
    ...overrides,
  };
}

test('plain --yes resolves the zero-service defaults and passes them into generation', async () => {
  const tempRoot = await createTempRoot();
  const generate = vi.fn(generateProject);
  const environment = createEnvironment(tempRoot, { generate });

  const result = await runCreateFlow(
    { yes: true, dryRun: true, install: false, git: false },
    environment,
  );

  expect(result.generatedAppOptions).toEqual(DEFAULT_GENERATED_APP_OPTIONS);
  expect(generate).toHaveBeenCalledWith(
    expect.objectContaining({ generatedAppOptions: DEFAULT_GENERATED_APP_OPTIONS }),
  );
  expect(environment.lines).toEqual(
    expect.arrayContaining([
      'Configuration:',
      '- Backend: none',
      '- Auth: none',
      '- Database: none',
      '- ORM: none',
      'Tenkit create plan is valid.',
    ]),
  );
  expect(environment.lines.indexOf('Configuration:')).toBeLessThan(
    environment.lines.indexOf('Tenkit create plan is valid.'),
  );
});

test('interactive creation can select Express while non-interactive creation keeps defaults', async () => {
  const tempRoot = await createTempRoot();
  const prompts: PromptAdapter = {
    text: vi.fn(async () => {
      throw new Error('Unexpected text prompt.');
    }),
    select: vi.fn(async (options) =>
      options.message === 'Backend' ? 'express' : options.initialValue,
    ),
    confirm: vi.fn(async () => false),
  };

  const interactive = await runCreateFlow(
    {
      name: 'interactive-express',
      setup: 'runtime-tenants',
      styling: 'bare',
      packageManager: 'pnpm',
      install: false,
      git: false,
      dryRun: true,
    },
    createEnvironment(tempRoot, { isInteractive: true, prompts }),
  );
  const nonInteractive = await runCreateFlow(
    {
      name: 'non-interactive-zero',
      setup: 'generic-standalone',
      install: false,
      git: false,
      dryRun: true,
    },
    createEnvironment(tempRoot),
  );

  expect(interactive.generatedAppOptions).toEqual({
    backend: 'express',
    auth: 'none',
    database: 'none',
    orm: 'none',
  });
  expect(nonInteractive.generatedAppOptions).toEqual(DEFAULT_GENERATED_APP_OPTIONS);
  expect(prompts.text).not.toHaveBeenCalled();
  expect(prompts.select).toHaveBeenCalledWith({
    message: 'Backend',
    initialValue: 'none',
    options: [
      { value: 'none', label: 'None' },
      { value: 'express', label: 'Express' },
      { value: 'nestjs', label: 'NestJS' },
      { value: 'convex', label: 'Convex' },
    ],
  });
  expect(prompts.confirm).toHaveBeenCalledOnce();
});

test('interactive creation exposes Clerk only after selecting Express', async () => {
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
      return options.initialValue;
    }),
    confirm: vi.fn(async () => false),
  };

  const result = await runCreateFlow(
    {
      name: 'interactive-express-clerk',
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
    database: 'none',
    orm: 'none',
  });
  expect(prompts.select).toHaveBeenCalledWith({
    message: 'Auth',
    initialValue: 'none',
    options: [
      { value: 'none', label: 'None' },
      { value: 'better-auth', label: 'Better Auth' },
      { value: 'clerk', label: 'Clerk' },
    ],
  });
});

test('interactive creation resolves Express with PostgreSQL and Prisma without Auth', async () => {
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
        return 'none';
      }
      if (options.message === 'Database') {
        return 'postgresql';
      }
      return options.initialValue;
    }),
    confirm: vi.fn(async () => false),
  };

  const result = await runCreateFlow(
    {
      name: 'interactive-express-postgresql-prisma',
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
    backend: 'express',
    auth: 'none',
    database: 'postgresql',
    orm: 'prisma',
  });
  expect(prompts.select).toHaveBeenCalledWith({
    message: 'Database',
    initialValue: 'none',
    options: [
      { value: 'none', label: 'None' },
      { value: 'postgresql', label: 'PostgreSQL' },
    ],
  });
  expect(prompts.select).not.toHaveBeenCalledWith(expect.objectContaining({ message: 'ORM' }));
});

test('interactive creation resolves Express with Better Auth, PostgreSQL, and Prisma', async () => {
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
        return 'better-auth';
      }
      return options.initialValue;
    }),
    confirm: vi.fn(async () => false),
  };

  const result = await runCreateFlow(
    {
      name: 'interactive-express-better-auth-postgresql-prisma',
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
    database: 'postgresql',
    orm: 'prisma',
  });
  expect(prompts.select).toHaveBeenCalledWith({
    message: 'Auth',
    initialValue: 'none',
    options: [
      { value: 'none', label: 'None' },
      { value: 'better-auth', label: 'Better Auth' },
      { value: 'clerk', label: 'Clerk' },
    ],
  });
  expect(prompts.select).not.toHaveBeenCalledWith(expect.objectContaining({ message: 'Database' }));
  expect(prompts.select).not.toHaveBeenCalledWith(expect.objectContaining({ message: 'ORM' }));
});

test('interactive creation exposes Clerk after selecting NestJS', async () => {
  const tempRoot = await createTempRoot();
  const prompts: PromptAdapter = {
    text: vi.fn(async () => {
      throw new Error('Unexpected text prompt.');
    }),
    select: vi.fn(async (options) => {
      if (options.message === 'Backend') {
        return 'nestjs';
      }
      if (options.message === 'Auth') {
        return 'clerk';
      }
      return options.initialValue;
    }),
    confirm: vi.fn(async () => false),
  };

  const result = await runCreateFlow(
    {
      name: 'interactive-nestjs-clerk',
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
    auth: 'clerk',
    database: 'none',
    orm: 'none',
  });
  expect(prompts.select).toHaveBeenCalledWith({
    message: 'Auth',
    initialValue: 'none',
    options: [
      { value: 'none', label: 'None' },
      { value: 'clerk', label: 'Clerk' },
    ],
  });
});

test('explicit Convex flags resolve managed persistence and write Convex-owned output', async () => {
  const tempRoot = await createTempRoot();
  const generate = vi.fn(generateProject);
  const environment = createEnvironment(tempRoot, { generate });

  const result = await runCreateFlow(
    {
      name: 'convex-app',
      backend: 'convex',
      auth: 'none',
      database: 'none',
      orm: 'none',
      yes: true,
      install: false,
      git: false,
    },
    environment,
  );

  expect(result.generatedAppOptions).toEqual({
    backend: 'convex',
    auth: 'none',
    database: 'none',
    orm: 'none',
  });
  expect(generate).toHaveBeenCalledWith(
    expect.objectContaining({ generatedAppOptions: result.generatedAppOptions }),
  );
  expect(environment.lines).toContain('- Backend: convex');
  expect(environment.lines).toContain('- Database: Convex-managed');
  expect(environment.lines).toContain('- ORM: not applicable');
  expect(environment.lines).toContain('- pnpm run convex:sync');
  expect(environment.lines).toContain(
    '- Set EXPO_PUBLIC_CONVEX_URL in .env.local to the synced deployment HTTPS URL',
  );
  expect(environment.lines).toContain('- pnpm run convex:seed');
  expect(environment.lines).toContain('- pnpm run dev');
  expect(await fs.pathExists(join(tempRoot, 'convex-app/apps/server/convex/schema.ts'))).toBe(true);
  expect(await fs.pathExists(join(tempRoot, 'convex-app/packages/auth'))).toBe(false);
  expect(await fs.pathExists(join(tempRoot, 'convex-app/packages/db'))).toBe(false);
});

test('rejects invalid values and unsupported combinations before generation or writing', async () => {
  const tempRoot = await createTempRoot();
  const generate = vi.fn(generateProject);
  const write = vi.fn();
  const environment = createEnvironment(tempRoot, { generate, write });

  await expect(
    runCreateFlow({ name: 'invalid-value', backend: 'hono', yes: true }, environment),
  ).rejects.toThrow(/Unsupported Backend "hono".*none, express, nestjs, convex/);
  await expect(
    runCreateFlow(
      { name: 'unsupported-combination', backend: 'express', auth: 'better-auth', yes: true },
      environment,
    ),
  ).rejects.toThrow(
    /Unsupported Generated App Option combination: Backend express, Auth better-auth/,
  );

  expect(generate).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
  expect(await fs.pathExists(join(tempRoot, 'invalid-value'))).toBe(false);
  expect(await fs.pathExists(join(tempRoot, 'unsupported-combination'))).toBe(false);
});

test('explicit Express and Clerk flags resolve the stack and write Clerk-owned output', async () => {
  const tempRoot = await createTempRoot();
  const generate = vi.fn(generateProject);
  const environment = createEnvironment(tempRoot, { generate });

  const result = await runCreateFlow(
    {
      name: 'express-clerk-app',
      backend: 'express',
      auth: 'clerk',
      database: 'none',
      orm: 'none',
      yes: true,
      install: false,
      git: false,
    },
    environment,
  );

  expect(result.generatedAppOptions).toEqual({
    backend: 'express',
    auth: 'clerk',
    database: 'none',
    orm: 'none',
  });
  expect(generate).toHaveBeenCalledWith(
    expect.objectContaining({ generatedAppOptions: result.generatedAppOptions }),
  );
  expect(environment.lines).toContain('- Backend: express');
  expect(environment.lines).toContain('- Auth: clerk');
  expect(environment.lines).toContain('- Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in .env.local');
  expect(environment.lines).toContain(
    '- Set CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in apps/server/.env.local',
  );
  expect(await fs.pathExists(join(tempRoot, 'express-clerk-app/src/app/(auth)/sign-in.tsx'))).toBe(
    true,
  );
  expect(await fs.pathExists(join(tempRoot, 'express-clerk-app/src/auth/clerk-provider.tsx'))).toBe(
    true,
  );
  expect(await fs.pathExists(join(tempRoot, 'express-clerk-app/packages/auth'))).toBe(false);
  expect(await fs.pathExists(join(tempRoot, 'express-clerk-app/packages/db'))).toBe(false);
});

test('explicit NestJS and Clerk flags resolve the stack and write composed output', async () => {
  const tempRoot = await createTempRoot();
  const generate = vi.fn(generateProject);
  const environment = createEnvironment(tempRoot, { generate });

  const result = await runCreateFlow(
    {
      name: 'nestjs-clerk-app',
      backend: 'nestjs',
      auth: 'clerk',
      database: 'none',
      orm: 'none',
      yes: true,
      install: false,
      git: false,
    },
    environment,
  );

  expect(result.generatedAppOptions).toEqual({
    backend: 'nestjs',
    auth: 'clerk',
    database: 'none',
    orm: 'none',
  });
  expect(generate).toHaveBeenCalledWith(
    expect.objectContaining({ generatedAppOptions: result.generatedAppOptions }),
  );
  expect(environment.lines).toContain('- Backend: nestjs');
  expect(environment.lines).toContain('- Auth: clerk');
  expect(environment.lines).toContain('- Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in .env.local');
  expect(environment.lines).toContain(
    '- Set CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in apps/server/.env.local',
  );
  expect(await fs.pathExists(join(tempRoot, 'nestjs-clerk-app/src/app/(auth)/sign-in.tsx'))).toBe(
    true,
  );
  expect(
    await fs.pathExists(
      join(tempRoot, 'nestjs-clerk-app/apps/server/src/configure-application.ts'),
    ),
  ).toBe(true);
  expect(await fs.pathExists(join(tempRoot, 'nestjs-clerk-app/packages/auth'))).toBe(false);
  expect(await fs.pathExists(join(tempRoot, 'nestjs-clerk-app/packages/db'))).toBe(false);
});

test('explicit Express flags resolve the stack and write Express-owned output', async () => {
  const tempRoot = await createTempRoot();
  const generate = vi.fn(generateProject);
  const environment = createEnvironment(tempRoot, { generate });

  const result = await runCreateFlow(
    {
      name: 'express-app',
      backend: 'express',
      auth: 'none',
      database: 'none',
      orm: 'none',
      yes: true,
      install: false,
      git: false,
    },
    environment,
  );

  expect(result.generatedAppOptions).toEqual({
    backend: 'express',
    auth: 'none',
    database: 'none',
    orm: 'none',
  });
  expect(generate).toHaveBeenCalledWith(
    expect.objectContaining({ generatedAppOptions: result.generatedAppOptions }),
  );
  expect(environment.lines).toContain('- Backend: express');
  expect(environment.lines).toContain('- pnpm run dev');
  expect(environment.lines).toContain('- cp .env.example .env.local');
  expect(environment.lines).toContain('- cp apps/server/.env.example apps/server/.env.local');
  expect(environment.lines).toContain(
    '- Set EXPO_PUBLIC_API_URL in .env.local to a Backend URL reachable by your target',
  );
  expect(environment.lines.indexOf('- cp .env.example .env.local')).toBeLessThan(
    environment.lines.indexOf('- pnpm run dev'),
  );
  expect(await fs.pathExists(join(tempRoot, 'express-app/apps/server/package.json'))).toBe(true);
  expect(await fs.pathExists(join(tempRoot, 'express-app/packages/auth'))).toBe(false);
  expect(await fs.pathExists(join(tempRoot, 'express-app/packages/db'))).toBe(false);
});

test('explicit Express, PostgreSQL, and Prisma flags resolve and write the SQL stack', async () => {
  const tempRoot = await createTempRoot();
  const generate = vi.fn(generateProject);
  const environment = createEnvironment(tempRoot, { generate });

  const result = await runCreateFlow(
    {
      name: 'express-postgresql-prisma-app',
      backend: 'express',
      auth: 'none',
      database: 'postgresql',
      orm: 'prisma',
      yes: true,
      install: false,
      git: false,
    },
    environment,
  );

  expect(result.generatedAppOptions).toEqual({
    backend: 'express',
    auth: 'none',
    database: 'postgresql',
    orm: 'prisma',
  });
  expect(generate).toHaveBeenCalledWith(
    expect.objectContaining({ generatedAppOptions: result.generatedAppOptions }),
  );
  expect(environment.lines).toContain('- Database: postgresql');
  expect(environment.lines).toContain('- ORM: prisma');
  expect(environment.lines).toContain(
    '- Set DATABASE_URL in apps/server/.env.local to your PostgreSQL database',
  );
  expect(environment.lines).toContain('- pnpm run db:setup');
  expect(await fs.pathExists(join(tempRoot, 'express-postgresql-prisma-app/packages/db'))).toBe(
    true,
  );
  expect(await fs.pathExists(join(tempRoot, 'express-postgresql-prisma-app/packages/auth'))).toBe(
    false,
  );
});

test('explicit Express, Better Auth, PostgreSQL, and Prisma flags write the protected SQL stack', async () => {
  const tempRoot = await createTempRoot();
  const generate = vi.fn(generateProject);
  const environment = createEnvironment(tempRoot, { generate });

  const result = await runCreateFlow(
    {
      name: 'express-better-auth-postgresql-prisma-app',
      backend: 'express',
      auth: 'better-auth',
      database: 'postgresql',
      orm: 'prisma',
      yes: true,
      install: false,
      git: false,
    },
    environment,
  );

  expect(result.generatedAppOptions).toEqual({
    backend: 'express',
    auth: 'better-auth',
    database: 'postgresql',
    orm: 'prisma',
  });
  expect(generate).toHaveBeenCalledWith(
    expect.objectContaining({ generatedAppOptions: result.generatedAppOptions }),
  );
  expect(environment.lines).toContain('- Auth: better-auth');
  expect(environment.lines).toContain(
    '- Set BETTER_AUTH_URL and a 32-character BETTER_AUTH_SECRET in apps/server/.env.local',
  );
  expect(environment.lines).toContain('- pnpm run db:setup');
  expect(
    await fs.pathExists(
      join(tempRoot, 'express-better-auth-postgresql-prisma-app/packages/auth/package.json'),
    ),
  ).toBe(true);
  expect(
    await fs.pathExists(
      join(tempRoot, 'express-better-auth-postgresql-prisma-app/packages/db/package.json'),
    ),
  ).toBe(true);
});

test('explicit NestJS flags resolve the stack and write NestJS-owned output', async () => {
  const tempRoot = await createTempRoot();
  const generate = vi.fn(generateProject);
  const environment = createEnvironment(tempRoot, { generate });

  const result = await runCreateFlow(
    {
      name: 'nestjs-app',
      backend: 'nestjs',
      auth: 'none',
      database: 'none',
      orm: 'none',
      yes: true,
      install: false,
      git: false,
    },
    environment,
  );

  expect(result.generatedAppOptions).toEqual({
    backend: 'nestjs',
    auth: 'none',
    database: 'none',
    orm: 'none',
  });
  expect(generate).toHaveBeenCalledWith(
    expect.objectContaining({ generatedAppOptions: result.generatedAppOptions }),
  );
  expect(environment.lines).toContain('- Backend: nestjs');
  expect(environment.lines).toContain('- pnpm run dev');
  expect(environment.lines).toContain('- cp .env.example .env.local');
  expect(environment.lines).toContain('- cp apps/server/.env.example apps/server/.env.local');
  expect(environment.lines).toContain(
    '- Set EXPO_PUBLIC_API_URL in .env.local to a Backend URL reachable by your target',
  );
  expect(await fs.pathExists(join(tempRoot, 'nestjs-app/apps/server/package.json'))).toBe(true);
  expect(await fs.pathExists(join(tempRoot, 'nestjs-app/packages/auth'))).toBe(false);
  expect(await fs.pathExists(join(tempRoot, 'nestjs-app/packages/db'))).toBe(false);
});

test('Commander exposes all public Generated App Option flags and validates their combination', async () => {
  const tempRoot = await createTempRoot();
  const environment = createEnvironment(tempRoot);
  const program = createProgram(environment);

  await expect(program.parseAsync(['--help'], { from: 'user' })).rejects.toMatchObject({
    code: 'commander.helpDisplayed',
  });
  const help = environment.lines.join('\n');
  expect(help).toContain('--backend <backend>');
  expect(help).toContain('--auth <auth>');
  expect(help).toContain('--database <database>');
  expect(help).toContain('--orm <orm>');
  expect(help).toContain('none, express, nestjs, convex');
  expect(help).toContain('none, better-auth, clerk');
  expect(help).toContain('none, postgresql, mysql');
  expect(help).toContain('none, prisma, drizzle');

  const invalidProgram = createProgram(createEnvironment(tempRoot));
  await expect(
    invalidProgram.parseAsync(
      [
        '--name',
        'invalid-cli-options',
        '--backend',
        'express',
        '--auth',
        'better-auth',
        '--yes',
        '--dry-run',
      ],
      { from: 'user' },
    ),
  ).rejects.toThrow(/Unsupported Generated App Option combination/);
});
