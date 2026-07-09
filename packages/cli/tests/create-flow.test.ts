import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

import fs from 'fs-extra';
import { join } from 'pathe';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { isDirectCliRun } from '../src/adapters/workspace';
import { createProgram } from '../src/commands/create';
import { DEFAULT_PROJECT_NAME, PROMPT_CANCELLED } from '../src/constants';
import { normalizePackageManagerInput } from '../src/create/package-manager';
import { runCreateFlow } from '../src/create/run-create';
import type {
  CreateFlowEnvironment,
  PromptAdapter,
  PromptSelectOptions,
} from '../src/create/types';
import {
  derivePackageName,
  normalizeAccentInput,
  normalizeSetupInput,
  normalizeStylingInput,
  validatePackageName,
  validateProjectName,
} from '../src/create/validation';

const tempRoots: string[] = [];

async function createTempRoot(): Promise<string> {
  const tempRoot = await fs.mkdtemp(join(tmpdir(), 'tenkit-cli-test-'));
  tempRoots.push(tempRoot);
  return tempRoot;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((tempRoot) => fs.remove(tempRoot)));
});

function createPrompts(overrides: Partial<PromptAdapter> = {}): PromptAdapter {
  return {
    text: vi.fn(async () => DEFAULT_PROJECT_NAME),
    async select<Value extends string>(options: PromptSelectOptions<Value>): Promise<Value> {
      return options.initialValue;
    },
    confirm: vi.fn(async () => false),
    ...overrides,
  };
}

function createOutput() {
  const lines: string[] = [];
  const errors: string[] = [];

  return {
    lines,
    errors,
    output: {
      log(message = '') {
        lines.push(message);
      },
      error(message: string) {
        errors.push(message);
      },
    },
  };
}

function createEnv(overrides: Partial<CreateFlowEnvironment> = {}): CreateFlowEnvironment {
  const output = createOutput();

  return {
    cwd: process.cwd(),
    isInteractive: false,
    isCi: true,
    output: output.output,
    prompts: createPrompts(),
    ...overrides,
  };
}

describe('create-flow validation', () => {
  test('maps public Setup slugs and canonical Setup Type IDs', () => {
    expect(normalizeSetupInput('white-label', undefined)).toBe('white-label-apps');
    expect(normalizeSetupInput('runtime-tenants', undefined)).toBe('single-app-runtime-tenants');
    expect(normalizeSetupInput('generic-standalone', undefined)).toBe(
      'generic-with-standalone-app-variants',
    );
    expect(normalizeSetupInput(undefined, 'single-app-runtime-tenants')).toBe(
      'single-app-runtime-tenants',
    );
  });

  test('reports public Setup slugs before canonical Setup Type IDs for invalid choices', () => {
    expect(() => normalizeSetupInput('unsupported', undefined)).toThrow(
      /public Setup slugs: white-label, runtime-tenants, generic-standalone; canonical Setup Type IDs:/,
    );
  });

  test('rejects explicitly empty Setup values instead of using defaults', () => {
    expect(() => normalizeSetupInput('', undefined)).toThrow(/Unsupported Setup Type ""/);
    expect(() => normalizeSetupInput(undefined, '')).toThrow(/Unsupported Setup Type ""/);
    expect(() => normalizeSetupInput('runtime-tenants', '')).toThrow(
      /Use either --setup or --setup-type/,
    );
  });

  test('rejects unsupported package manager options', () => {
    expect(() => normalizePackageManagerInput('')).toThrow(/Package manager must be one of:/);
    expect(() => normalizePackageManagerInput('yarn')).toThrow(
      /Unsupported package manager "yarn".*Expected one of: pnpm, npm, bun/,
    );
  });

  test('validates project folder names and derived package names', () => {
    expect(validateProjectName('My Tenkit App')).toBe('My Tenkit App');
    expect(derivePackageName('My Tenkit App')).toBe('my-tenkit-app');
    expect(validatePackageName('custom_app.name')).toBe('custom_app.name');

    expect(() => validateProjectName('../escape')).toThrow(/path separators/);
    expect(() => validateProjectName('bad:name')).toThrow(/unsafe/);
    expect(() => validatePackageName('BadName')).toThrow(/lowercase/);
  });

  test('normalizes Public CLI Styling and Accent inputs', () => {
    expect(normalizeStylingInput(undefined)).toBe('bare');
    expect(normalizeStylingInput('uniwind')).toBe('uniwind');
    expect(() => normalizeStylingInput('nativewind')).toThrow(
      /Unsupported Styling Choice "nativewind".*bare, uniwind/,
    );

    expect(normalizeAccentInput(undefined)).toBeUndefined();
    expect(normalizeAccentInput('#123ABC')).toBe('#123ABC');
    expect(() => normalizeAccentInput('blue')).toThrow(
      /Invalid accent color "blue".*six-digit hex color.*#208AEF/,
    );
  });
});

describe('non-interactive create', () => {
  test('uses --yes defaults and skips install and git when requested', async () => {
    const tempRoot = await createTempRoot();
    const result = await runCreateFlow(
      {
        yes: true,
        install: false,
        git: false,
      },
      createEnv({ cwd: tempRoot }),
    );

    expect(result.projectName).toBe(DEFAULT_PROJECT_NAME);
    expect(result.packageName).toBe(DEFAULT_PROJECT_NAME);
    expect(result.setupType).toBe('white-label-apps');
    expect(result.stylingChoice).toBe('bare');
    expect(result.accent).toBeUndefined();
    expect(await fs.pathExists(join(tempRoot, DEFAULT_PROJECT_NAME, 'package.json'))).toBe(true);
  });

  test('rejects explicitly empty create options instead of falling back to defaults', async () => {
    const tempRoot = await createTempRoot();

    await expect(
      runCreateFlow(
        { name: '', setup: 'white-label', install: false, git: false, yes: true },
        createEnv({ cwd: tempRoot }),
      ),
    ).rejects.toThrow(/Project name is required/);

    await expect(
      runCreateFlow(
        {
          name: 'empty-package-demo',
          packageName: '',
          setup: 'white-label',
          install: false,
          git: false,
          yes: true,
        },
        createEnv({ cwd: tempRoot }),
      ),
    ).rejects.toThrow(/Package name is required/);

    await expect(
      runCreateFlow(
        { name: 'empty-setup-demo', setup: '', install: false, git: false, yes: true },
        createEnv({ cwd: tempRoot }),
      ),
    ).rejects.toThrow(/Unsupported Setup Type ""/);

    await expect(
      runCreateFlow(
        { name: 'empty-setup-type-demo', setupType: '', install: false, git: false, yes: true },
        createEnv({ cwd: tempRoot }),
      ),
    ).rejects.toThrow(/Unsupported Setup Type ""/);

    expect(await fs.pathExists(join(tempRoot, DEFAULT_PROJECT_NAME))).toBe(false);
    expect(await fs.pathExists(join(tempRoot, 'empty-package-demo'))).toBe(false);
    expect(await fs.pathExists(join(tempRoot, 'empty-setup-demo'))).toBe(false);
    expect(await fs.pathExists(join(tempRoot, 'empty-setup-type-demo'))).toBe(false);
  });

  test('generates Single App Runtime Tenants output through the Template generator', async () => {
    const tempRoot = await createTempRoot();
    const result = await runCreateFlow(
      {
        name: 'runtime-demo',
        setup: 'runtime-tenants',
        install: false,
        git: false,
        yes: true,
      },
      createEnv({ cwd: tempRoot }),
    );
    const packageJson = await fs.readJson(join(tempRoot, 'runtime-demo/package.json'));

    expect(result.setupType).toBe('single-app-runtime-tenants');
    expect(packageJson.name).toBe('runtime-demo');
    expect(
      await fs.pathExists(join(tempRoot, 'runtime-demo/src/constants/runtime-tenants.ts')),
    ).toBe(true);
  });

  test('passes explicit Styling and Accent choices into generated output', async () => {
    const tempRoot = await createTempRoot();
    const result = await runCreateFlow(
      {
        name: 'styled-demo',
        setup: 'white-label',
        styling: 'uniwind',
        accent: '#123ABC',
        install: false,
        git: false,
        yes: true,
      },
      createEnv({ cwd: tempRoot }),
    );
    const packageJson = await fs.readJson(join(tempRoot, 'styled-demo/package.json'));
    const appVariants = await fs.readFile(
      join(tempRoot, 'styled-demo/src/constants/app-variants.ts'),
      'utf8',
    );
    const globalCss = await fs.readFile(join(tempRoot, 'styled-demo/src/global.css'), 'utf8');

    expect(result.stylingChoice).toBe('uniwind');
    expect(result.accent).toBe('#123ABC');
    expect(packageJson.dependencies.uniwind).toBe('^1.10.0');
    expect(appVariants.match(/accent: "#123ABC"/g)).toHaveLength(2);
    expect(globalCss.match(/--color-accent: #123ABC;/g)).toHaveLength(2);
  });

  test('rejects unsafe existing or protected targets', async () => {
    const tempRoot = await createTempRoot();
    await fs.ensureDir(join(tempRoot, 'taken'));
    await fs.writeFile(join(tempRoot, 'taken/package.json'), '{}\n');

    await expect(
      runCreateFlow(
        { name: 'taken', setup: 'white-label', install: false, git: false, yes: true },
        createEnv({ cwd: tempRoot }),
      ),
    ).rejects.toThrow(/not empty/);

    await expect(
      runCreateFlow(
        { name: 'inside', setup: 'white-label', install: false, git: false, yes: true },
        createEnv({ cwd: tempRoot, workspaceRoot: tempRoot }),
      ),
    ).rejects.toThrow(/protected project root/);
  });

  test('package name override changes only package.json name', async () => {
    const tempRoot = await createTempRoot();

    await runCreateFlow(
      {
        name: 'Folder Name',
        packageName: 'custom-package',
        setup: 'white-label',
        install: false,
        git: false,
        yes: true,
      },
      createEnv({ cwd: tempRoot }),
    );

    const packageJson = await fs.readJson(join(tempRoot, 'Folder Name/package.json'));

    expect(packageJson.name).toBe('custom-package');
  });

  test('dry run validates without writing files', async () => {
    const tempRoot = await createTempRoot();
    const result = await runCreateFlow(
      {
        name: 'dry-run-demo',
        setup: 'generic-standalone',
        install: false,
        git: false,
        dryRun: true,
        yes: true,
      },
      createEnv({ cwd: tempRoot }),
    );

    expect(result.status).toBe('dry-run');
    expect(await fs.pathExists(join(tempRoot, 'dry-run-demo'))).toBe(false);
  });

  test('dry run rejects protected targets through the writer boundary', async () => {
    const tempRoot = await createTempRoot();

    await expect(
      runCreateFlow(
        {
          name: 'dry-run-protected',
          setup: 'white-label',
          install: false,
          git: false,
          dryRun: true,
          yes: true,
        },
        createEnv({ cwd: tempRoot, workspaceRoot: tempRoot }),
      ),
    ).rejects.toThrow(/protected project root/);

    expect(await fs.pathExists(join(tempRoot, 'dry-run-protected'))).toBe(false);
  });

  test('quotes project folders with spaces in next-step commands', async () => {
    const tempRoot = await createTempRoot();
    const outputLines: string[] = [];

    await runCreateFlow(
      {
        name: 'My Tenkit App',
        setup: 'white-label',
        install: false,
        git: false,
        dryRun: true,
        yes: true,
      },
      createEnv({
        cwd: tempRoot,
        output: {
          log(message = '') {
            outputLines.push(message);
          },
          error(message) {
            outputLines.push(message);
          },
        },
      }),
    );

    expect(outputLines).toContain("- cd 'My Tenkit App'");
  });
});

describe('install and git planning', () => {
  test('runs detected package manager install and quiet git commit by default outside an existing worktree', async () => {
    const tempRoot = await createTempRoot();
    const calls: {
      command: string;
      args: readonly string[];
      stdio?: 'inherit' | 'ignore';
    }[] = [];

    await runCreateFlow(
      { name: 'git-demo', setup: 'white-label', yes: true },
      createEnv({
        cwd: tempRoot,
        runCommand: vi.fn(async (command, args, _cwd, options) => {
          calls.push({ command, args, stdio: options?.stdio });
          if (command === 'git' && args[0] === 'rev-parse') {
            return { ok: false, code: 1 };
          }

          return { ok: true, code: 0 };
        }),
      }),
    );

    expect(calls).toContainEqual({ command: 'pnpm', args: ['install'], stdio: 'ignore' });
    expect(calls).toContainEqual({ command: 'git', args: ['--version'], stdio: 'ignore' });
    expect(calls).toContainEqual({
      command: 'git',
      args: ['rev-parse', '--is-inside-work-tree'],
      stdio: 'ignore',
    });
    expect(calls).toContainEqual({ command: 'git', args: ['init'], stdio: 'ignore' });
    expect(calls).toContainEqual({ command: 'git', args: ['add', '--all'], stdio: 'ignore' });
    expect(calls).toContainEqual({
      command: 'git',
      args: ['commit', '-m', 'Initial commit'],
      stdio: 'ignore',
    });
  });

  test('uses Bun from the create launcher for install, generated output, and next steps', async () => {
    const tempRoot = await createTempRoot();
    const outputLines: string[] = [];
    const calls: {
      command: string;
      args: readonly string[];
      stdio?: 'inherit' | 'ignore';
    }[] = [];

    const result = await runCreateFlow(
      { name: 'bun-demo', setup: 'white-label', yes: true, git: false },
      createEnv({
        cwd: tempRoot,
        packageManagerUserAgent: 'bun/1.2.0',
        output: {
          log(message = '') {
            outputLines.push(message);
          },
          error(message) {
            outputLines.push(message);
          },
        },
        runCommand: vi.fn(async (command, args, _cwd, options) => {
          calls.push({ command, args, stdio: options?.stdio });
          return { ok: true, code: 0 };
        }),
      }),
    );

    const packageJson = await fs.readJson(join(tempRoot, 'bun-demo/package.json'));
    const readme = await fs.readFile(join(tempRoot, 'bun-demo/README.md'), 'utf8');
    const localCliCore = await fs.readFile(
      join(tempRoot, 'bun-demo/scripts/tenkit-cli-core.ts'),
      'utf8',
    );

    expect(result.packageManager).toBe('bun');
    expect(calls).toContainEqual({ command: 'bun', args: ['install'], stdio: 'ignore' });
    expect(packageJson.packageManager).toBeUndefined();
    expect(await fs.pathExists(join(tempRoot, 'bun-demo/pnpm-workspace.yaml'))).toBe(false);
    expect(readme).toContain('bun install');
    expect(readme).toContain('bun run tenkit build');
    expect(localCliCore).toContain("bin: 'bun'");
    expect(localCliCore).toContain("args: ['x', 'expo', ...args]");
    expect(outputLines).toContain('- bun run android');
  });

  test('allows explicit package manager override and renders npm-safe Generated App Local CLI commands', async () => {
    const tempRoot = await createTempRoot();

    const result = await runCreateFlow(
      {
        name: 'npm-demo',
        setup: 'generic-standalone',
        packageManager: 'npm',
        install: false,
        git: false,
        yes: true,
      },
      createEnv({
        cwd: tempRoot,
        packageManagerUserAgent: 'bun/1.2.0',
        runCommand: vi.fn(async () => ({ ok: true, code: 0 })),
      }),
    );

    const packageJson = await fs.readJson(join(tempRoot, 'npm-demo/package.json'));
    const readme = await fs.readFile(join(tempRoot, 'npm-demo/README.md'), 'utf8');
    const localCliCore = await fs.readFile(
      join(tempRoot, 'npm-demo/scripts/tenkit-cli-core.ts'),
      'utf8',
    );

    expect(result.packageManager).toBe('npm');
    expect(packageJson.packageManager).toBeUndefined();
    expect(readme).toContain('npm install');
    expect(readme).toContain('npm run tenkit -- build');
    expect(await fs.pathExists(join(tempRoot, 'npm-demo/pnpm-workspace.yaml'))).toBe(false);
    expect(localCliCore).toContain("bin: 'npm'");
    expect(localCliCore).toContain("args: ['exec', 'expo', '--', ...args]");
  });

  test('uses npm from the create launcher for install, generated output, and next steps', async () => {
    const tempRoot = await createTempRoot();
    const outputLines: string[] = [];
    const calls: {
      command: string;
      args: readonly string[];
      stdio?: 'inherit' | 'ignore';
    }[] = [];

    const result = await runCreateFlow(
      { name: 'npm-launcher-demo', setup: 'generic-standalone', yes: true, git: false },
      createEnv({
        cwd: tempRoot,
        packageManagerUserAgent: 'npm/11.0.0 node/v25.0.0 darwin arm64 workspaces/false',
        output: {
          log(message = '') {
            outputLines.push(message);
          },
          error(message) {
            outputLines.push(message);
          },
        },
        runCommand: vi.fn(async (command, args, _cwd, options) => {
          calls.push({ command, args, stdio: options?.stdio });
          return { ok: true, code: 0 };
        }),
      }),
    );

    const packageJson = await fs.readJson(join(tempRoot, 'npm-launcher-demo/package.json'));
    const readme = await fs.readFile(join(tempRoot, 'npm-launcher-demo/README.md'), 'utf8');

    expect(result.packageManager).toBe('npm');
    expect(calls).toContainEqual({ command: 'npm', args: ['install'], stdio: 'ignore' });
    expect(packageJson.packageManager).toBeUndefined();
    expect(readme).toContain('npm install');
    expect(readme).toContain('npm run tenkit -- build');
    expect(await fs.pathExists(join(tempRoot, 'npm-launcher-demo/pnpm-workspace.yaml'))).toBe(
      false,
    );
    expect(outputLines).toContain('- npm run android');
  });

  test('does not emit packageManager metadata in generated package.json', async () => {
    const tempRoot = await createTempRoot();

    await runCreateFlow(
      {
        name: 'unknown-version-demo',
        setup: 'white-label',
        packageManager: 'pnpm',
        install: false,
        git: false,
        yes: true,
      },
      createEnv({
        cwd: tempRoot,
        runCommand: vi.fn(async () => ({ ok: true, code: 0 })),
      }),
    );

    const packageJson = await fs.readJson(join(tempRoot, 'unknown-version-demo/package.json'));

    expect(packageJson.packageManager).toBeUndefined();
  });

  test('reports install and commit convenience failures without failing generation', async () => {
    const tempRoot = await createTempRoot();
    const result = await runCreateFlow(
      { name: 'follow-up-demo', setup: 'white-label', yes: true },
      createEnv({
        cwd: tempRoot,
        runCommand: vi.fn(async (command, args) => {
          if (command === 'pnpm') {
            return { ok: false, code: 1 };
          }

          if (command === 'git' && args[0] === 'rev-parse') {
            return { ok: false, code: 1 };
          }

          if (command === 'git' && args[0] === 'commit') {
            return { ok: false, code: 1 };
          }

          return { ok: true, code: 0 };
        }),
      }),
    );

    expect(result.status).toBe('created');
    expect(result.installFailed).toBe(true);
    expect(result.gitInitialized).toBe(true);
    expect(result.gitFailed).toBe(true);
  });

  test('skips implicit nested git initialization in non-interactive mode', async () => {
    const tempRoot = await createTempRoot();
    const calls: string[] = [];
    const result = await runCreateFlow(
      { name: 'nested-demo', setup: 'white-label', install: false, yes: true },
      createEnv({
        cwd: tempRoot,
        runCommand: vi.fn(async (command, args) => {
          calls.push([command, ...args].join(' '));
          return { ok: true, code: 0 };
        }),
      }),
    );

    expect(result.gitSkippedReason).toBe('nested-worktree');
    expect(calls).not.toContain('git init');
  });

  test('cancelling nested git confirmation happens before writing files', async () => {
    const tempRoot = await createTempRoot();
    const write = vi.fn(async () => ({
      targetDir: join(tempRoot, 'nested-cancel-demo'),
      filesWritten: [],
      filesSkipped: [],
    }));
    const cancelNestedGitPrompt: PromptAdapter['confirm'] = async () => PROMPT_CANCELLED;

    await expect(
      runCreateFlow(
        {
          name: 'nested-cancel-demo',
          setup: 'white-label',
          install: false,
          yes: true,
        },
        createEnv({
          cwd: tempRoot,
          isInteractive: true,
          isCi: false,
          prompts: createPrompts({
            confirm: cancelNestedGitPrompt,
          }),
          runCommand: vi.fn(async () => ({ ok: true, code: 0 })),
          write,
        }),
      ),
    ).rejects.toThrow(/Create cancelled/);

    expect(write).not.toHaveBeenCalled();
    expect(await fs.pathExists(join(tempRoot, 'nested-cancel-demo'))).toBe(false);
  });
});

describe('interactive prompts', () => {
  test('accepts prompt defaults when the user presses return', async () => {
    const tempRoot = await createTempRoot();
    const textPrompt = vi.fn(async () => DEFAULT_PROJECT_NAME);
    const selectPrompt: PromptAdapter['select'] = async <Value extends string>(
      options: PromptSelectOptions<Value>,
    ): Promise<Value> => options.initialValue;

    const result = await runCreateFlow(
      { install: false, git: false },
      createEnv({
        cwd: tempRoot,
        isInteractive: true,
        isCi: false,
        prompts: createPrompts({
          text: textPrompt,
          select: selectPrompt,
        }),
      }),
    );

    expect(result.projectName).toBe(DEFAULT_PROJECT_NAME);
    expect(result.packageName).toBe(DEFAULT_PROJECT_NAME);
    expect(result.setupType).toBe('white-label-apps');
    expect(result.stylingChoice).toBe('bare');
    expect(await fs.pathExists(join(tempRoot, DEFAULT_PROJECT_NAME, 'package.json'))).toBe(true);
  });

  test('asks for project name, Setup Type, and Styling Choice in order', async () => {
    const tempRoot = await createTempRoot();
    const promptOrder: string[] = [];
    const selectCalls = vi.fn();
    const textPrompt = vi.fn(async (options: { message: string }) => {
      promptOrder.push(options.message);
      return 'prompted-app';
    });
    const selectPrompt: PromptAdapter['select'] = async <Value extends string>(
      options: PromptSelectOptions<Value>,
    ): Promise<Value> => {
      promptOrder.push(options.message);
      selectCalls(options);
      const requestedValue =
        options.message === 'Styling Choice' ? 'uniwind' : 'generic-standalone';
      const selectedOption = options.options.find((option) => option.value === requestedValue);

      if (!selectedOption) {
        throw new Error(`Missing test prompt option ${requestedValue}.`);
      }

      return selectedOption.value;
    };
    const confirmPrompt = vi.fn(async () => false);

    const result = await runCreateFlow(
      { install: false, git: false },
      createEnv({
        cwd: tempRoot,
        isInteractive: true,
        isCi: false,
        prompts: createPrompts({
          text: textPrompt,
          select: selectPrompt,
          confirm: confirmPrompt,
        }),
      }),
    );

    expect(result.projectName).toBe('prompted-app');
    expect(result.setupType).toBe('generic-with-standalone-app-variants');
    expect(result.stylingChoice).toBe('uniwind');
    expect(promptOrder).toEqual(['Project name', 'Setup Type', 'Styling Choice']);
    expect(textPrompt).toHaveBeenCalledTimes(1);
    expect(textPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultValue: DEFAULT_PROJECT_NAME,
        message: 'Project name',
        placeholder: DEFAULT_PROJECT_NAME,
      }),
    );
    expect(selectCalls).toHaveBeenCalledTimes(2);
    expect(selectCalls).toHaveBeenNthCalledWith(1, {
      initialValue: 'white-label',
      message: 'Setup Type',
      options: [
        { label: 'White Label Apps', value: 'white-label' },
        { label: 'Runtime Tenant App', value: 'runtime-tenants' },
        { label: 'Generic + Standalone Apps', value: 'generic-standalone' },
      ],
    });
    expect(selectCalls).toHaveBeenNthCalledWith(2, {
      initialValue: 'bare',
      message: 'Styling Choice',
      options: [
        { label: 'Bare', value: 'bare' },
        { label: 'Uniwind', value: 'uniwind' },
      ],
    });
    expect(confirmPrompt).not.toHaveBeenCalled();
  });

  test('prompts only for missing values when options are partially provided', async () => {
    const tempRoot = await createTempRoot();
    const textPrompt = vi.fn(async () => 'mixed-app');
    const selectCalls = vi.fn();
    const selectPrompt: PromptAdapter['select'] = async <Value extends string>(
      options: PromptSelectOptions<Value>,
    ): Promise<Value> => {
      selectCalls(options);
      const selectedOption = options.options.find((option) => option.value === 'uniwind');

      if (!selectedOption) {
        throw new Error('Missing test prompt option uniwind.');
      }

      return selectedOption.value;
    };

    const result = await runCreateFlow(
      {
        setup: 'runtime-tenants',
        install: false,
        git: false,
      },
      createEnv({
        cwd: tempRoot,
        isInteractive: true,
        isCi: false,
        prompts: createPrompts({
          text: textPrompt,
          select: selectPrompt,
        }),
      }),
    );

    expect(result.projectName).toBe('mixed-app');
    expect(result.setupType).toBe('single-app-runtime-tenants');
    expect(result.stylingChoice).toBe('uniwind');
    expect(textPrompt).toHaveBeenCalledTimes(1);
    expect(selectCalls).toHaveBeenCalledTimes(1);
    expect(selectCalls).toHaveBeenCalledWith({
      initialValue: 'bare',
      message: 'Styling Choice',
      options: [
        { label: 'Bare', value: 'bare' },
        { label: 'Uniwind', value: 'uniwind' },
      ],
    });
  });

  test('cancelling a prompt exits before generation', async () => {
    const cancelledTextPrompt: PromptAdapter['text'] = async () => PROMPT_CANCELLED;

    await expect(
      runCreateFlow(
        { install: false, git: false },
        createEnv({
          isInteractive: true,
          prompts: createPrompts({
            text: cancelledTextPrompt,
          }),
        }),
      ),
    ).rejects.toThrow(/Create cancelled/);
  });

  test('cancelling the Styling Choice prompt exits before generation', async () => {
    const write = vi.fn();
    const cancelStylingPrompt: PromptAdapter['select'] = async () => PROMPT_CANCELLED;

    await expect(
      runCreateFlow(
        { name: 'cancelled-styling', setup: 'white-label', install: false, git: false },
        createEnv({
          isInteractive: true,
          prompts: createPrompts({
            select: cancelStylingPrompt,
          }),
          write,
        }),
      ),
    ).rejects.toThrow(/Create cancelled/);

    expect(write).not.toHaveBeenCalled();
  });
});

describe('Commander contract', () => {
  test('prints help and version without --json or positional target syntax', async () => {
    const lines: string[] = [];
    const env = createEnv({
      output: {
        log(message = '') {
          lines.push(message);
        },
        error(message) {
          lines.push(message);
        },
      },
    });
    const program = createProgram(env);

    await expect(program.parseAsync(['--help'], { from: 'user' })).rejects.toMatchObject({
      code: 'commander.helpDisplayed',
    });

    const help = lines.join('\n');

    expect(help).toContain('--name <name>');
    expect(help).toContain('--setup <setup>');
    expect(help).toContain('--styling <styling>');
    expect(help).toContain('--accent <color>');
    expect(help).toContain('--package-manager <manager>');
    expect(help).not.toContain('--json');
    expect(help).not.toContain('[target');

    lines.length = 0;
    await expect(program.parseAsync(['--version'], { from: 'user' })).rejects.toMatchObject({
      code: 'commander.version',
    });
    expect(lines.join('\n')).toContain('0.1.2');
  });

  test('rejects explicitly empty git mode from Commander options', async () => {
    const program = createProgram(createEnv());

    await expect(
      program.parseAsync(['--name', 'git-mode-demo', '--setup', 'white-label', '--git', ''], {
        from: 'user',
      }),
    ).rejects.toThrow(/Git mode must be one of/);
  });

  test.each([
    {
      args: ['--styling', 'nativewind'],
      message: /Unsupported Styling Choice "nativewind".*bare, uniwind/,
    },
    {
      args: ['--accent', 'blue'],
      message: /Invalid accent color "blue".*six-digit hex color.*#208AEF/,
    },
  ])('reports invalid public options through Commander', async ({ args, message }) => {
    const program = createProgram(createEnv());

    await expect(
      program.parseAsync(
        ['--name', 'invalid-option-demo', '--setup', 'white-label', '--yes', ...args],
        { from: 'user' },
      ),
    ).rejects.toThrow(message);
  });

  test('detects direct CLI execution through a symlinked bin path', async () => {
    const tempRoot = await createTempRoot();
    const realBinPath = join(tempRoot, 'dist/index.mjs');
    const symlinkedBinPath = join(tempRoot, 'node_modules/.bin/tenkit');

    await fs.ensureDir(join(tempRoot, 'dist'));
    await fs.ensureDir(join(tempRoot, 'node_modules/.bin'));
    await fs.writeFile(realBinPath, 'export {};\n');
    await fs.symlink(realBinPath, symlinkedBinPath);

    expect(isDirectCliRun(pathToFileURL(realBinPath).href, symlinkedBinPath)).toBe(true);
  });
});
