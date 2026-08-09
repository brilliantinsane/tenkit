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

test('interactive and non-interactive creation resolve omitted service values without prompts', async () => {
  const tempRoot = await createTempRoot();
  const prompts: PromptAdapter = {
    text: vi.fn(async () => {
      throw new Error('Unexpected text prompt.');
    }),
    select: vi.fn(async () => {
      throw new Error('Unexpected select prompt.');
    }),
    confirm: vi.fn(async () => false),
  };

  const interactive = await runCreateFlow(
    {
      name: 'interactive-zero',
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

  expect(interactive.generatedAppOptions).toEqual(DEFAULT_GENERATED_APP_OPTIONS);
  expect(nonInteractive.generatedAppOptions).toEqual(DEFAULT_GENERATED_APP_OPTIONS);
  expect(prompts.text).not.toHaveBeenCalled();
  expect(prompts.select).not.toHaveBeenCalled();
  expect(prompts.confirm).toHaveBeenCalledOnce();
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
    runCreateFlow({ name: 'unsupported-combination', backend: 'express', yes: true }, environment),
  ).rejects.toThrow(
    /Unsupported Generated App Option combination: Backend express, Auth none, Database none, ORM none.*Backend none, Auth none, Database none, ORM none/,
  );

  expect(generate).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
  expect(await fs.pathExists(join(tempRoot, 'invalid-value'))).toBe(false);
  expect(await fs.pathExists(join(tempRoot, 'unsupported-combination'))).toBe(false);
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
      ['--name', 'invalid-cli-options', '--backend', 'express', '--yes', '--dry-run'],
      { from: 'user' },
    ),
  ).rejects.toThrow(/Unsupported Generated App Option combination/);
});
