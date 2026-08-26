/// <reference types="node" />

import fs from 'fs-extra';
import { dirname } from 'pathe';
import { afterEach, expect, test, vi } from 'vitest';

import { DEFAULT_GENERATED_APP_OPTIONS } from '@tenkit/types/generated-app-option-definitions';

import { verifyGeneratedApp } from '../src/generated-app-verification';
import {
  GENERATED_PROJECT_VERIFICATION_PHASES,
  GeneratedProjectVerificationError,
  type GeneratedProjectVerificationEvidence,
} from '../src/generated-project-verification';
import { runGeneratedVerificationMatrix } from '../src/generated-verification-matrix';

const { runGenerationProof, verifyGeneratedProject } = vi.hoisted(() => ({
  runGenerationProof: vi.fn().mockResolvedValue(undefined),
  verifyGeneratedProject: vi.fn(),
}));

vi.mock('../src/local-proof', () => ({ runGenerationProof }));
vi.mock('../src/generated-project-verification', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/generated-project-verification')>();
  return { ...original, verifyGeneratedProject };
});

const createdTargetRoots: string[] = [];

function coreEvidence(
  status: 'passed' | 'failed' = 'passed',
): GeneratedProjectVerificationEvidence {
  return {
    status,
    profile: 'deterministic',
    selection: {
      setupType: 'white-label-apps',
      generatedAppOptions: DEFAULT_GENERATED_APP_OPTIONS,
      stylingChoice: 'bare',
      packageManager: 'pnpm',
      appVariantSlugs: ['first-tenant', 'second-tenant'],
    },
    environmentKeys: ['PATH'],
    phases: GENERATED_PROJECT_VERIFICATION_PHASES.map((phase) => ({
      durationMs: 0,
      phase,
      status: status === 'failed' && phase === 'install' ? 'failed' : 'passed',
    })),
    failures:
      status === 'failed'
        ? [
            {
              kind: 'command-failed',
              message: 'The install command exited unsuccessfully.',
              phase: 'install',
            },
          ]
        : [],
  };
}

afterEach(async () => {
  vi.restoreAllMocks();
  runGenerationProof.mockReset();
  runGenerationProof.mockResolvedValue(undefined);
  verifyGeneratedProject.mockReset();
  await Promise.all(createdTargetRoots.splice(0).map((targetRoot) => fs.remove(targetRoot)));
});

test('generated app verification records generation through filesystem cleanup', async () => {
  verifyGeneratedProject.mockResolvedValue(coreEvidence());

  const evidence = await verifyGeneratedApp({
    setupType: 'white-label-apps',
    appVariantNames: ['North Brand', 'South Brand'],
    appVariantAccents: ['#123ABC', '#F59E0B'],
    stylingChoice: 'bare',
    workspaceRoot: '/workspace',
    environment: { PATH: '/safe/bin' },
    profile: 'deterministic',
  });

  const targetDir = runGenerationProof.mock.calls[0]?.[0]?.targetDir;
  expect(targetDir).toEqual(expect.any(String));
  createdTargetRoots.push(dirname(targetDir));
  expect(await fs.pathExists(targetDir)).toBe(false);
  expect(verifyGeneratedProject).toHaveBeenCalledWith({
    targetDir,
    selection: {
      setupType: 'white-label-apps',
      generatedAppOptions: DEFAULT_GENERATED_APP_OPTIONS,
      stylingChoice: 'bare',
      packageManager: 'pnpm',
      appVariantAccents: ['#123ABC', '#F59E0B'],
      appVariantNames: ['North Brand', 'South Brand'],
    },
    environment: { PATH: '/safe/bin' },
    profile: 'deterministic',
  });
  expect(evidence.status).toBe('passed');
  expect(evidence.targetName).toMatch(/^tenkit-generated-white-label-apps-bare-/);
  expect(evidence.phases.find(({ phase }) => phase === 'generation')).toEqual(
    expect.objectContaining({ phase: 'generation', status: 'passed' }),
  );
  expect(evidence.phases.at(-1)).toEqual(
    expect.objectContaining({ phase: 'cleanup', status: 'passed' }),
  );
});

test('generation failure stops verification and retains the temporary project', async () => {
  runGenerationProof.mockRejectedValueOnce(new Error('/private/path secret generation detail'));

  const evidence = await verifyGeneratedApp({
    setupType: 'white-label-apps',
    stylingChoice: 'bare',
    workspaceRoot: '/workspace',
    environment: { PATH: '/safe/bin' },
    profile: 'deterministic',
  });

  const targetDir = runGenerationProof.mock.calls[0]?.[0]?.targetDir;
  createdTargetRoots.push(dirname(targetDir));
  expect(await fs.pathExists(dirname(targetDir))).toBe(true);
  expect(verifyGeneratedProject).not.toHaveBeenCalled();
  expect(evidence.status).toBe('failed');
  expect(evidence.failures).toEqual([
    expect.objectContaining({ kind: 'generation-failed', phase: 'generation' }),
  ]);
  expect(JSON.stringify(evidence)).not.toContain('/private/path');
  expect(evidence.phases.at(-1)).toEqual(
    expect.objectContaining({ phase: 'cleanup', status: 'passed' }),
  );
  expect(evidence.retainedTargetName).toEqual(expect.stringMatching(/^tenkit-generated-/));
  expect(evidence.retainedTargetName).not.toContain('/');
});

test('a failed verification phase retains the temporary project', async () => {
  verifyGeneratedProject.mockResolvedValue(coreEvidence('failed'));

  const evidence = await verifyGeneratedApp({
    setupType: 'white-label-apps',
    stylingChoice: 'bare',
    workspaceRoot: '/workspace',
    environment: { PATH: '/safe/bin' },
    profile: 'deterministic',
  });

  const targetDir = runGenerationProof.mock.calls[0]?.[0]?.targetDir;
  createdTargetRoots.push(dirname(targetDir));
  expect(await fs.pathExists(dirname(targetDir))).toBe(true);
  expect(evidence.status).toBe('failed');
  expect(evidence.failures).toEqual([
    expect.objectContaining({ kind: 'command-failed', phase: 'install' }),
  ]);
  expect(evidence.phases.at(-1)).toEqual(
    expect.objectContaining({ phase: 'cleanup', status: 'passed' }),
  );
});

test('an unexpected verifier failure is bounded without false phase ownership', async () => {
  verifyGeneratedProject.mockRejectedValueOnce(new Error('/private/path verifier secret'));

  const failure: unknown = await verifyGeneratedApp({
    setupType: 'white-label-apps',
    stylingChoice: 'bare',
    workspaceRoot: '/workspace',
    environment: { PATH: '/safe/bin' },
    profile: 'deterministic',
  }).catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(Error);
  const message = failure instanceof Error ? failure.message : String(failure);
  expect(message).toMatch(
    /^Generated project verification terminated unexpectedly\. Failed target retained in the system temporary directory as tenkit-generated-/,
  );
  expect(message).not.toContain('/private/path');
  expect(message).not.toContain('secret');

  const targetDir = runGenerationProof.mock.calls[0]?.[0]?.targetDir;
  createdTargetRoots.push(dirname(targetDir));
  expect(await fs.pathExists(dirname(targetDir))).toBe(true);
});

test('matrix evidence preserves completed phases and failure ownership across target retention', async () => {
  verifyGeneratedProject.mockRejectedValueOnce(
    new GeneratedProjectVerificationError('start', [
      { durationMs: 1, phase: 'generation', status: 'not-applicable' },
      { durationMs: 2, phase: 'shape', status: 'passed' },
      { durationMs: 3, phase: 'install', status: 'passed' },
      { durationMs: 4, phase: 'typecheck', status: 'passed' },
      { durationMs: 5, phase: 'expo-config', status: 'passed' },
      { durationMs: 6, phase: 'build', status: 'passed' },
    ]),
  );

  const report = await runGeneratedVerificationMatrix({
    cells: [
      {
        environment: {
          evidence: {
            environmentKeys: ['PATH'],
            profile: 'deterministic',
            resourceClasses: [],
            sourceName: 'test-fixture',
          },
          values: { PATH: '/safe/bin' },
        },
        id: 'phase-ownership',
        selection: {
          packageManager: 'pnpm',
          setupType: 'white-label-apps',
          stylingChoice: 'bare',
        },
        verificationProfile: 'deterministic',
      },
    ],
    cellEvidenceSink: async () => undefined,
    concurrency: 1,
    sourceSha: '8888888888888888888888888888888888888888',
    workspaceRoot: '/workspace',
  });

  const targetDir = runGenerationProof.mock.calls[0]?.[0]?.targetDir;
  createdTargetRoots.push(dirname(targetDir));
  expect(report.cells[0]?.evidence).toEqual(
    expect.objectContaining({
      phases: expect.arrayContaining([
        expect.objectContaining({ phase: 'generation', status: 'passed' }),
        expect.objectContaining({ phase: 'shape', status: 'passed' }),
        expect.objectContaining({ phase: 'build', status: 'passed' }),
        expect.objectContaining({ phase: 'start', status: 'failed' }),
      ]),
      failures: expect.arrayContaining([
        expect.objectContaining({
          message: 'Generated project verification terminated unexpectedly during start.',
          phase: 'start',
        }),
      ]),
      retainedTargetName: expect.stringMatching(/^tenkit-generated-phase-ownership-/),
    }),
  );
});

test('filesystem cleanup failure makes successful verification fail', async () => {
  verifyGeneratedProject.mockResolvedValue(coreEvidence());
  const remove = vi.spyOn(fs, 'remove').mockRejectedValueOnce(new Error('cleanup secret path'));

  const evidence = await verifyGeneratedApp({
    setupType: 'white-label-apps',
    stylingChoice: 'bare',
    workspaceRoot: '/workspace',
    environment: { PATH: '/safe/bin' },
    profile: 'deterministic',
  });

  const targetDir = runGenerationProof.mock.calls[0]?.[0]?.targetDir;
  createdTargetRoots.push(dirname(targetDir));
  remove.mockRestore();
  expect(evidence.status).toBe('failed');
  expect(evidence.failures).toEqual([
    expect.objectContaining({ kind: 'cleanup-failed', phase: 'cleanup' }),
  ]);
  expect(JSON.stringify(evidence)).not.toContain('cleanup secret path');
  expect(evidence.phases.at(-1)).toEqual(
    expect.objectContaining({ phase: 'cleanup', status: 'failed' }),
  );
});

test('process cleanup failure remains failed when the generated target is retained', async () => {
  const failedCleanupEvidence = coreEvidence('failed');
  verifyGeneratedProject.mockResolvedValue({
    ...failedCleanupEvidence,
    failures: [
      {
        kind: 'cleanup-failed',
        message: 'The generated server process tree leaked after forced shutdown.',
        phase: 'shutdown',
      },
    ],
    phases: failedCleanupEvidence.phases.map((phase) =>
      phase.phase === 'cleanup' ? { ...phase, status: 'failed' as const } : phase,
    ),
  });

  const evidence = await verifyGeneratedApp({
    setupType: 'white-label-apps',
    stylingChoice: 'bare',
    workspaceRoot: '/workspace',
    environment: { PATH: '/safe/bin' },
    profile: 'deterministic',
  });

  const targetDir = runGenerationProof.mock.calls[0]?.[0]?.targetDir;
  createdTargetRoots.push(dirname(targetDir));
  expect(evidence.status).toBe('failed');
  expect(evidence.phases.find(({ phase }) => phase === 'cleanup')?.status).toBe('failed');
  expect(evidence.failures).toEqual([
    expect.objectContaining({ kind: 'cleanup-failed', phase: 'shutdown' }),
  ]);

  const report = await runGeneratedVerificationMatrix({
    cells: [
      {
        environment: {
          evidence: {
            environmentKeys: ['PATH'],
            profile: 'deterministic',
            resourceClasses: [],
            sourceName: 'test-fixture',
          },
          values: { PATH: '/safe/bin' },
        },
        id: 'cleanup-propagation',
        selection: {
          packageManager: 'pnpm',
          setupType: 'white-label-apps',
          stylingChoice: 'bare',
        },
        verificationProfile: 'deterministic',
      },
    ],
    concurrency: 1,
    sourceSha: '4444444444444444444444444444444444444444',
    verifyCell: async () => evidence,
    workspaceRoot: '/workspace',
  });
  expect(report.finalReadiness).toBe('not-ready');
  expect(report.cells[0]).toEqual(
    expect.objectContaining({
      status: 'failed',
      failures: [expect.objectContaining({ kind: 'cleanup-failed', phase: 'shutdown' })],
    }),
  );
});

test('verified evidence is durable before a successful target is deleted', async () => {
  verifyGeneratedProject.mockResolvedValue(coreEvidence());
  const order: string[] = [];
  const beforeSuccessfulTargetCleanup = vi.fn(async () => {
    order.push('evidence');
  });
  const remove = vi.spyOn(fs, 'remove').mockImplementation(async () => {
    order.push('remove');
  });

  const evidence = await verifyGeneratedApp({
    setupType: 'white-label-apps',
    stylingChoice: 'bare',
    workspaceRoot: '/workspace',
    environment: { PATH: '/safe/bin' },
    profile: 'deterministic',
    beforeSuccessfulTargetCleanup,
  });

  const targetDir = runGenerationProof.mock.calls[0]?.[0]?.targetDir;
  createdTargetRoots.push(dirname(targetDir));
  remove.mockRestore();
  expect(evidence.status).toBe('passed');
  expect(order).toEqual(['evidence', 'remove']);
  expect(beforeSuccessfulTargetCleanup).toHaveBeenCalledWith(
    expect.objectContaining({ status: 'passed', targetName: expect.any(String) }),
  );
});
