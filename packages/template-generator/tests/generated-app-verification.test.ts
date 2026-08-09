/// <reference types="node" />

import fs from 'fs-extra';
import { dirname } from 'pathe';
import { afterEach, expect, test, vi } from 'vitest';

import { verifyGeneratedApp } from '../src/generated-app-verification';
import {
  GENERATED_PROJECT_VERIFICATION_PHASES,
  type GeneratedProjectVerificationEvidence,
} from '../src/generated-project-verification';

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
      stylingChoice: 'bare',
      packageManager: 'pnpm',
      appVariantAccents: ['#123ABC', '#F59E0B'],
      appVariantNames: ['North Brand', 'South Brand'],
    },
    environment: { PATH: '/safe/bin' },
    profile: 'deterministic',
  });
  expect(evidence.status).toBe('passed');
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
