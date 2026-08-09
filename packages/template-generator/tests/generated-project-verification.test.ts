/// <reference types="node" />

import { tmpdir } from 'node:os';

import fs from 'fs-extra';
import { join } from 'pathe';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { verifyGeneratedProject } from '../src/generated-project-verification';
import type { GeneratedAppCommandResult } from '../src/generated-app-command-runner';
import type { GeneratedAppProcess } from '../src/generated-app-process-runner';
import { generateProject } from '../src/generator';
import { writeProject } from '../src/writer';

const { runGeneratedAppCommand } = vi.hoisted(() => ({
  runGeneratedAppCommand: vi.fn(
    async (
      _cwd: string,
      command: string,
      args: string[],
      _options: { env: Readonly<Record<string, string>> },
    ): Promise<GeneratedAppCommandResult> => ({
      args,
      command,
      durationMs: 5,
      status: 'passed' as const,
    }),
  ),
}));
const { startGeneratedAppProcess } = vi.hoisted(() => ({
  startGeneratedAppProcess: vi.fn<() => Promise<GeneratedAppProcess>>(),
}));

vi.mock('../src/generated-app-command-runner', () => ({ runGeneratedAppCommand }));
vi.mock('../src/generated-app-process-runner', () => ({ startGeneratedAppProcess }));

const tempRoots: string[] = [];

function passingCommandResult(command: string, args: string[]) {
  return {
    args,
    command,
    durationMs: 5,
    status: 'passed' as const,
  };
}

beforeEach(() => {
  runGeneratedAppCommand.mockReset();
  runGeneratedAppCommand.mockImplementation(async (_cwd, command, args) =>
    passingCommandResult(command, args),
  );
  startGeneratedAppProcess.mockReset();
  startGeneratedAppProcess.mockResolvedValue({
    startEvidence: {
      args: ['run', 'server:start:prod'],
      command: 'pnpm',
      durationMs: 5,
      status: 'passed',
    },
    shutdown: vi.fn().mockResolvedValue({ durationMs: 5, forced: false, status: 'passed' }),
  });
});

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((tempRoot) => fs.remove(tempRoot)));
});

async function createWrittenGeneratedProject(
  selection: {
    setupType: 'white-label-apps' | 'single-app-runtime-tenants';
    stylingChoice: 'bare';
    packageManager: 'pnpm';
    appVariantNames?: readonly (string | undefined)[];
  } = {
    setupType: 'white-label-apps',
    stylingChoice: 'bare',
    packageManager: 'pnpm',
  },
): Promise<string> {
  const tempRoot = await fs.mkdtemp(join(tmpdir(), 'tenkit-project-verification-'));
  const targetDir = join(tempRoot, 'generated-project');
  tempRoots.push(tempRoot);
  await writeProject({
    targetDir,
    tree: generateProject(selection),
    overwrite: 'never',
  });
  return targetDir;
}

async function createWrittenNodeProject(): Promise<string> {
  const tempRoot = await fs.mkdtemp(join(tmpdir(), 'tenkit-node-verification-'));
  const targetDir = join(tempRoot, 'generated-project');
  tempRoots.push(tempRoot);
  const tree = generateProject({
    setupType: 'white-label-apps',
    stylingChoice: 'bare',
    packageManager: 'pnpm',
  }).map((file) => {
    if (file.path !== 'package.json' || typeof file.contents !== 'string') {
      return file;
    }
    const packageJson = JSON.parse(file.contents) as {
      scripts: Record<string, string>;
    };
    return {
      ...file,
      contents: `${JSON.stringify(
        {
          ...packageJson,
          scripts: {
            ...packageJson.scripts,
            build: 'tsc -b',
            'server:start:prod': 'node dist/server.js',
            'test:integration': 'vitest run',
          },
        },
        null,
        2,
      )}\n`,
    };
  });
  await writeProject({ targetDir, tree, overwrite: 'never' });
  return targetDir;
}

test('one written generated project returns ordered structured phase evidence', async () => {
  const selection = {
    setupType: 'white-label-apps' as const,
    stylingChoice: 'bare' as const,
    packageManager: 'pnpm' as const,
    appVariantNames: ['North Brand', 'South Brand'],
  };
  const targetDir = await createWrittenGeneratedProject(selection);

  const evidence = await verifyGeneratedProject({
    targetDir,
    selection,
    environment: { PATH: '/safe/bin', SAFE_PUBLIC_VALUE: 'not-recorded' },
    profile: 'deterministic',
  });

  expect(evidence.status).toBe('passed');
  expect(evidence.environmentKeys).toEqual(['PATH', 'SAFE_PUBLIC_VALUE']);
  expect(evidence.phases.map(({ phase, status }) => [phase, status])).toEqual([
    ['generation', 'not-applicable'],
    ['shape', 'passed'],
    ['install', 'passed'],
    ['typecheck', 'passed'],
    ['expo-config', 'passed'],
    ['build', 'not-applicable'],
    ['start', 'not-applicable'],
    ['runtime', 'not-applicable'],
    ['shutdown', 'not-applicable'],
    ['cleanup', 'passed'],
  ]);
  expect(evidence.selection.appVariantSlugs).toEqual(['north-brand', 'south-brand']);
  expect(JSON.stringify(evidence)).not.toContain('not-recorded');
  expect(runGeneratedAppCommand.mock.calls).toEqual([
    [targetDir, 'pnpm', ['install'], expect.objectContaining({ env: expect.any(Object) })],
    [targetDir, 'pnpm', ['run', 'typecheck'], expect.objectContaining({ env: expect.any(Object) })],
    [
      targetDir,
      'pnpm',
      ['run', 'expo:config'],
      expect.objectContaining({ env: expect.any(Object) }),
    ],
    [
      targetDir,
      'pnpm',
      ['run', 'expo:config'],
      expect.objectContaining({ env: expect.any(Object) }),
    ],
  ]);
  expect(runGeneratedAppCommand.mock.calls[2]?.[3]?.env).toEqual({
    PATH: '/safe/bin',
    SAFE_PUBLIC_VALUE: 'not-recorded',
    APP_VARIANT_SLUG: 'north-brand',
  });
  expect(runGeneratedAppCommand.mock.calls[3]?.[3]?.env).toEqual({
    PATH: '/safe/bin',
    SAFE_PUBLIC_VALUE: 'not-recorded',
    APP_VARIANT_SLUG: 'south-brand',
  });
});

test('a selection-specific shape mismatch stops commands and records cleanup', async () => {
  const targetDir = await createWrittenGeneratedProject({
    setupType: 'single-app-runtime-tenants',
    stylingChoice: 'bare',
    packageManager: 'pnpm',
  });
  await fs.writeFile(join(targetDir, 'README.md'), 'wrong selection');

  const evidence = await verifyGeneratedProject({
    targetDir,
    selection: {
      setupType: 'single-app-runtime-tenants',
      stylingChoice: 'bare',
      packageManager: 'pnpm',
    },
    environment: { PATH: '/safe/bin' },
    profile: 'deterministic',
  });

  expect(evidence.status).toBe('failed');
  expect(evidence.failures).toEqual([
    expect.objectContaining({ kind: 'invalid-shape', phase: 'shape' }),
  ]);
  expect(evidence.phases.map(({ phase, status }) => [phase, status])).toEqual([
    ['generation', 'not-applicable'],
    ['shape', 'failed'],
    ['install', 'skipped'],
    ['typecheck', 'skipped'],
    ['expo-config', 'skipped'],
    ['build', 'skipped'],
    ['start', 'skipped'],
    ['runtime', 'skipped'],
    ['shutdown', 'skipped'],
    ['cleanup', 'passed'],
  ]);
  expect(runGeneratedAppCommand).not.toHaveBeenCalled();
});

test.each([
  { args: ['install'], phase: 'install' },
  { args: ['run', 'typecheck'], phase: 'typecheck' },
  { args: ['run', 'expo:config'], phase: 'expo-config' },
] as const)('a $phase failure stops later commands', async ({ args: failedArgs, phase }) => {
  const targetDir = await createWrittenGeneratedProject();
  runGeneratedAppCommand.mockImplementation(async (_cwd, command, args) =>
    args.join('\0') === failedArgs.join('\0')
      ? {
          args,
          command,
          diagnostics: 'safe bounded failure',
          durationMs: 7,
          exitCode: 17,
          status: 'failed' as const,
        }
      : passingCommandResult(command, args),
  );

  const evidence = await verifyGeneratedProject({
    targetDir,
    selection: {
      setupType: 'white-label-apps',
      stylingChoice: 'bare',
      packageManager: 'pnpm',
    },
    environment: { PATH: '/safe/bin' },
    profile: 'deterministic',
  });

  expect(evidence.status).toBe('failed');
  expect(evidence.failures).toEqual([expect.objectContaining({ kind: 'command-failed', phase })]);
  expect(evidence.phases.find((phaseEvidence) => phaseEvidence.phase === phase)?.status).toBe(
    'failed',
  );
  expect(evidence.phases.at(-1)).toEqual(
    expect.objectContaining({ phase: 'cleanup', status: 'passed' }),
  );
});

test('a command timeout owns the failure and still records cleanup', async () => {
  const targetDir = await createWrittenGeneratedProject();
  runGeneratedAppCommand.mockResolvedValueOnce({
    args: ['install'],
    command: 'pnpm',
    durationMs: 25,
    signal: 'SIGTERM',
    status: 'timed-out',
  });

  const evidence = await verifyGeneratedProject({
    targetDir,
    selection: {
      setupType: 'white-label-apps',
      stylingChoice: 'bare',
      packageManager: 'pnpm',
    },
    environment: { PATH: '/safe/bin' },
    profile: 'deterministic',
  });

  expect(evidence.failures).toEqual([
    expect.objectContaining({ kind: 'timeout', phase: 'install' }),
  ]);
  expect(evidence.phases.at(-1)).toEqual(
    expect.objectContaining({ phase: 'cleanup', status: 'passed' }),
  );
});

test('the Node server profile proves build, readiness, runtime, and graceful shutdown', async () => {
  const targetDir = await createWrittenNodeProject();

  const evidence = await verifyGeneratedProject({
    targetDir,
    selection: {
      setupType: 'white-label-apps',
      stylingChoice: 'bare',
      packageManager: 'pnpm',
    },
    environment: { PATH: '/safe/bin', PORT: '43123' },
    profile: 'node-server',
  });

  expect(evidence.status).toBe('passed');
  expect(evidence.phases.find(({ phase }) => phase === 'build')?.status).toBe('passed');
  expect(evidence.phases.find(({ phase }) => phase === 'start')?.status).toBe('passed');
  expect(evidence.phases.find(({ phase }) => phase === 'runtime')?.status).toBe('passed');
  expect(evidence.phases.find(({ phase }) => phase === 'shutdown')?.status).toBe('passed');
  expect(startGeneratedAppProcess).toHaveBeenCalledWith(
    targetDir,
    'pnpm',
    ['run', 'server:start:prod'],
    expect.objectContaining({ readinessUrl: 'http://127.0.0.1:43123/health' }),
  );
});

test('readiness timeout stops runtime but always shuts down the process', async () => {
  const shutdown = vi.fn().mockResolvedValue({ durationMs: 5, forced: false, status: 'passed' });
  startGeneratedAppProcess.mockResolvedValueOnce({
    startEvidence: {
      args: ['run', 'server:start:prod'],
      command: 'pnpm',
      durationMs: 10,
      status: 'timed-out',
    },
    shutdown,
  });
  const targetDir = await createWrittenNodeProject();

  const evidence = await verifyGeneratedProject({
    targetDir,
    selection: {
      setupType: 'white-label-apps',
      stylingChoice: 'bare',
      packageManager: 'pnpm',
    },
    environment: { PATH: '/safe/bin', PORT: '43124' },
    profile: 'node-server',
  });

  expect(evidence.failures).toEqual([expect.objectContaining({ kind: 'timeout', phase: 'start' })]);
  expect(evidence.phases.find(({ phase }) => phase === 'runtime')?.status).toBe('skipped');
  expect(evidence.phases.find(({ phase }) => phase === 'shutdown')?.status).toBe('passed');
  expect(shutdown).toHaveBeenCalledOnce();
});

test.each([
  { failedArgs: ['run', 'build'], phase: 'build' },
  { failedArgs: ['run', 'test:integration'], phase: 'runtime' },
] as const)('a Node $phase command failure owns its phase', async ({ failedArgs, phase }) => {
  const targetDir = await createWrittenNodeProject();
  runGeneratedAppCommand.mockImplementation(async (_cwd, command, args) =>
    args.join('\0') === failedArgs.join('\0')
      ? { args, command, durationMs: 5, exitCode: 1, status: 'failed' as const }
      : passingCommandResult(command, args),
  );

  const evidence = await verifyGeneratedProject({
    targetDir,
    selection: {
      setupType: 'white-label-apps',
      stylingChoice: 'bare',
      packageManager: 'pnpm',
    },
    environment: { PATH: '/safe/bin', PORT: '43126' },
    profile: 'node-server',
  });

  expect(evidence.failures).toEqual([expect.objectContaining({ kind: 'command-failed', phase })]);
  expect(evidence.phases.find(({ phase: evidencePhase }) => evidencePhase === phase)?.status).toBe(
    'failed',
  );
});

test('premature server exit owns start and still runs shutdown cleanup', async () => {
  const shutdown = vi.fn().mockResolvedValue({ durationMs: 0, forced: false, status: 'passed' });
  startGeneratedAppProcess.mockResolvedValueOnce({
    startEvidence: {
      args: ['run', 'server:start:prod'],
      command: 'pnpm',
      durationMs: 5,
      exitCode: 9,
      status: 'failed',
    },
    shutdown,
  });
  const targetDir = await createWrittenNodeProject();

  const evidence = await verifyGeneratedProject({
    targetDir,
    selection: {
      setupType: 'white-label-apps',
      stylingChoice: 'bare',
      packageManager: 'pnpm',
    },
    environment: { PATH: '/safe/bin', PORT: '43127' },
    profile: 'node-server',
  });

  expect(evidence.failures).toEqual([
    expect.objectContaining({ kind: 'process-failed', phase: 'start' }),
  ]);
  expect(evidence.phases.find(({ phase }) => phase === 'runtime')?.status).toBe('skipped');
  expect(evidence.phases.find(({ phase }) => phase === 'shutdown')?.status).toBe('passed');
  expect(shutdown).toHaveBeenCalledOnce();
});

test('forced shutdown fails lifecycle proof after runtime passes', async () => {
  startGeneratedAppProcess.mockResolvedValueOnce({
    startEvidence: {
      args: ['run', 'server:start:prod'],
      command: 'pnpm',
      durationMs: 5,
      status: 'passed',
    },
    shutdown: vi.fn().mockResolvedValue({ durationMs: 15, forced: true, status: 'failed' }),
  });
  const targetDir = await createWrittenNodeProject();

  const evidence = await verifyGeneratedProject({
    targetDir,
    selection: {
      setupType: 'white-label-apps',
      stylingChoice: 'bare',
      packageManager: 'pnpm',
    },
    environment: { PATH: '/safe/bin', PORT: '43125' },
    profile: 'node-server',
  });

  expect(evidence.status).toBe('failed');
  expect(evidence.failures).toEqual([
    expect.objectContaining({ kind: 'cleanup-failed', phase: 'shutdown' }),
  ]);
  expect(evidence.phases.find(({ phase }) => phase === 'cleanup')?.status).toBe('passed');
});
