/// <reference types="node" />

import { expect, test, vi } from 'vitest';

import { DEFAULT_GENERATED_APP_OPTIONS } from '@tenkit/types/generated-app-option-definitions';

import { GeneratedAppVerificationError } from '../src/generated-app-verification';
import {
  runGeneratedVerificationMatrix,
  type GeneratedVerificationCellEvidenceRecord,
  type GeneratedVerificationMatrixCell,
  type GeneratedVerificationMatrixReport,
} from '../src/generated-verification-matrix';
import {
  GENERATED_PROJECT_VERIFICATION_PHASES,
  type GeneratedProjectVerificationEvidence,
} from '../src/generated-project-verification';

function cell(id: string): GeneratedVerificationMatrixCell {
  return {
    id,
    environment: {
      values: { PATH: '/safe/bin', SECRET_VALUE: `${id}-secret` },
      evidence: {
        environmentKeys: ['PATH', 'SECRET_VALUE'],
        profile: 'deterministic',
        resourceClasses: [],
        sourceName: 'test-fixture',
      },
    },
    selection: {
      packageManager: 'pnpm',
      setupType: 'white-label-apps',
      stylingChoice: 'bare',
    },
    verificationProfile: 'deterministic',
  };
}

function evidence(
  id: string,
  options: { cleanup?: 'passed' | 'failed'; status?: 'passed' | 'failed' } = {},
): GeneratedProjectVerificationEvidence {
  const cleanup = options.cleanup ?? 'passed';
  const status = options.status ?? 'passed';

  return {
    environmentKeys: ['PATH', 'SECRET_VALUE'],
    failures:
      cleanup === 'failed'
        ? [
            {
              kind: 'cleanup-failed',
              message: 'Generated project filesystem cleanup failed.',
              phase: 'cleanup',
            },
          ]
        : [],
    phases: GENERATED_PROJECT_VERIFICATION_PHASES.map((phase) => ({
      durationMs: 1,
      phase,
      status: phase === 'cleanup' ? cleanup : 'passed',
    })),
    profile: 'deterministic',
    selection: {
      generatedAppOptions: DEFAULT_GENERATED_APP_OPTIONS,
      appVariantSlugs: ['first-tenant', 'second-tenant'],
      packageManager: 'pnpm',
      setupType: 'white-label-apps',
      stylingChoice: 'bare',
    },
    status,
    targetName: `tenkit-generated-${id}`,
  };
}

test('matrix cells run in stable order with bounded concurrency and machine-readable evidence', async () => {
  let active = 0;
  let maximumActive = 0;
  const started: string[] = [];
  const evidenceSink = vi.fn<(report: GeneratedVerificationMatrixReport) => Promise<void>>(
    async () => undefined,
  );

  const report = await runGeneratedVerificationMatrix({
    cells: [cell('charlie'), cell('alpha'), cell('bravo')],
    concurrency: 2,
    evidenceSink,
    sourceSha: 'a'.repeat(40),
    verifyCell: async ({ id }) => {
      started.push(id);
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise<void>((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return evidence(id);
    },
    workspaceRoot: '/workspace',
  });

  expect(started).toEqual(['alpha', 'bravo', 'charlie']);
  expect(maximumActive).toBe(2);
  expect(report.cells.map(({ cellId }) => cellId)).toEqual(['alpha', 'bravo', 'charlie']);
  expect(report.cells[0]).toEqual(
    expect.objectContaining({
      cellId: 'alpha',
      durationMs: expect.any(Number),
      evidence: expect.objectContaining({ targetName: 'tenkit-generated-alpha' }),
      status: 'passed',
    }),
  );
  expect(report.summary).toEqual({ failed: 0, passed: 3, skipped: 0, total: 3 });
  expect(report.finalReadiness).toBe('ready');
  expect(evidenceSink).toHaveBeenCalledWith(report);
  expect(JSON.stringify(report)).not.toContain('alpha-secret');
});

test('resume reuses same-source passed evidence and runs only missing or failed cells', async () => {
  const previousReport = await runGeneratedVerificationMatrix({
    cells: [cell('alpha'), cell('bravo'), cell('charlie')],
    concurrency: 1,
    sourceSha: 'b'.repeat(40),
    verifyCell: async ({ id }) => evidence(id, id === 'bravo' ? { status: 'failed' } : undefined),
    workspaceRoot: '/workspace',
  });
  const rerun = vi.fn(async ({ id }: GeneratedVerificationMatrixCell) => evidence(id));

  const resumedReport = await runGeneratedVerificationMatrix({
    cells: [cell('charlie'), cell('bravo'), cell('alpha')],
    concurrency: 2,
    resumeFrom: previousReport,
    sourceSha: 'b'.repeat(40),
    verifyCell: rerun,
    workspaceRoot: '/workspace',
  });

  expect(rerun.mock.calls.map(([matrixCell]) => matrixCell.id)).toEqual(['bravo']);
  expect(resumedReport.cells).toEqual([
    expect.objectContaining({ cellId: 'alpha', skipReason: 'already-passed', status: 'skipped' }),
    expect.objectContaining({ cellId: 'bravo', status: 'passed' }),
    expect.objectContaining({ cellId: 'charlie', skipReason: 'already-passed', status: 'skipped' }),
  ]);
  expect(resumedReport.finalReadiness).toBe('ready');
});

test('resume reruns a same-source cell when its managed resource contract changes', async () => {
  const resourceEvidenceCell = {
    ...cell('resource-contract'),
    environment: {
      ...cell('resource-contract').environment,
      evidence: {
        ...cell('resource-contract').environment.evidence,
        resourceClasses: ['disposable-postgresql'],
      },
    },
  } satisfies GeneratedVerificationMatrixCell;
  const previousReport = await runGeneratedVerificationMatrix({
    cells: [resourceEvidenceCell],
    concurrency: 1,
    sourceSha: '5'.repeat(40),
    verifyCell: async ({ id }) => evidence(id),
    workspaceRoot: '/workspace',
  });
  const acquire = vi.fn(async () => ({
    cleanup: async () => ({ leaked: false }),
    environment: {},
  }));
  const verifyCell = vi.fn(async ({ id }: GeneratedVerificationMatrixCell) => evidence(id));

  await runGeneratedVerificationMatrix({
    cells: [
      {
        ...resourceEvidenceCell,
        resources: [{ acquire, resourceClass: 'disposable-postgresql' }],
      },
    ],
    concurrency: 1,
    resumeFrom: previousReport,
    sourceSha: '5'.repeat(40),
    verifyCell,
    workspaceRoot: '/workspace',
  });

  expect(acquire).toHaveBeenCalledOnce();
  expect(verifyCell).toHaveBeenCalledOnce();
});

test('unselected required cells and cleanup failures block final readiness', async () => {
  const report = await runGeneratedVerificationMatrix({
    cells: [cell('alpha'), cell('bravo')],
    concurrency: 1,
    selectedCellIds: ['alpha'],
    sourceSha: 'c'.repeat(40),
    verifyCell: async ({ id }) => evidence(id, { cleanup: 'failed', status: 'passed' }),
    workspaceRoot: '/workspace',
  });

  expect(report.cells).toEqual([
    expect.objectContaining({ cellId: 'alpha', status: 'failed' }),
    expect.objectContaining({ cellId: 'bravo', skipReason: 'not-selected', status: 'skipped' }),
  ]);
  expect(report.cells[0]?.failures).toEqual([
    expect.objectContaining({ kind: 'cleanup-failed', phase: 'cleanup' }),
  ]);
  expect(report.finalReadiness).toBe('not-ready');
});

test('invalid identity, selection, and resume inputs fail before verification starts', async () => {
  const verifyCell = vi.fn(async ({ id }: GeneratedVerificationMatrixCell) => evidence(id));

  await expect(
    runGeneratedVerificationMatrix({
      cells: [cell('not stable')],
      concurrency: 1,
      sourceSha: 'd'.repeat(40),
      verifyCell,
      workspaceRoot: '/workspace',
    }),
  ).rejects.toThrow(/stable lowercase identity/);

  await expect(
    runGeneratedVerificationMatrix({
      cells: [cell('alpha')],
      concurrency: 1,
      selectedCellIds: ['missing'],
      sourceSha: 'd'.repeat(40),
      verifyCell,
      workspaceRoot: '/workspace',
    }),
  ).rejects.toThrow(/Unknown selected matrix cell/);

  const previousReport = await runGeneratedVerificationMatrix({
    cells: [cell('alpha')],
    concurrency: 1,
    sourceSha: 'e'.repeat(40),
    verifyCell,
    workspaceRoot: '/workspace',
  });
  verifyCell.mockClear();
  await expect(
    runGeneratedVerificationMatrix({
      cells: [cell('alpha')],
      concurrency: 1,
      resumeFrom: previousReport,
      sourceSha: 'f'.repeat(40),
      verifyCell,
      workspaceRoot: '/workspace',
    }),
  ).rejects.toThrow(/source SHA/);
  expect(verifyCell).not.toHaveBeenCalled();
});

test('temporary resources are acquired lazily and cleanup is part of cell readiness', async () => {
  const order: string[] = [];
  const cleanup = vi.fn(async () => ({ leaked: false }));
  const acquire = vi.fn(async () => ({
    cleanup,
    environment: { DATABASE_URL: 'postgresql://provider-secret' },
  }));
  const resourceCell = {
    ...cell('sql-cell'),
    environment: {
      values: { PATH: '/safe/bin' },
      evidence: {
        environmentKeys: ['DATABASE_URL', 'PATH'],
        profile: 'deterministic' as const,
        resourceClasses: ['disposable-postgresql'],
        sourceName: 'test-fixture',
      },
    },
    resources: [{ acquire, resourceClass: 'disposable-postgresql' }],
  } satisfies GeneratedVerificationMatrixCell;
  const verifyCell = vi.fn(
    async (
      matrixCell: GeneratedVerificationMatrixCell,
      execution: { environment: Readonly<Record<string, string>> },
    ) => {
      expect(matrixCell.id).toBe('sql-cell');
      expect(execution.environment).toEqual({
        DATABASE_URL: 'postgresql://provider-secret',
        PATH: '/safe/bin',
      });
      order.push('verify');
      return evidence(matrixCell.id);
    },
  );
  const cellEvidenceSink = vi.fn<
    (record: GeneratedVerificationCellEvidenceRecord) => Promise<void>
  >(async () => {
    order.push('sink');
    expect(cleanup).toHaveBeenCalledOnce();
  });

  const report = await runGeneratedVerificationMatrix({
    cells: [resourceCell],
    cellEvidenceSink,
    concurrency: 1,
    sourceSha: '1'.repeat(40),
    verifyCell,
    workspaceRoot: '/workspace',
  });

  expect(acquire).toHaveBeenCalledOnce();
  expect(cleanup).toHaveBeenCalledOnce();
  expect(order).toEqual(['verify', 'sink']);
  expect(cellEvidenceSink).toHaveBeenCalledWith(
    expect.objectContaining({
      cellId: 'sql-cell',
      sourceSha: '1111111111111111111111111111111111111111',
      status: 'completed',
      resources: [expect.objectContaining({ resourceClass: 'disposable-postgresql' })],
    }),
  );
  expect(report.cells[0]).toEqual(
    expect.objectContaining({
      resources: [
        expect.objectContaining({
          leaked: false,
          resourceClass: 'disposable-postgresql',
          status: 'passed',
        }),
      ],
      status: 'passed',
    }),
  );
  expect(JSON.stringify(report)).not.toContain('provider-secret');

  const completedRecord = cellEvidenceSink.mock.calls
    .map(([record]) => record)
    .find(({ status }) => status === 'completed') as
    GeneratedVerificationCellEvidenceRecord | undefined;
  expect(completedRecord).toBeDefined();
  verifyCell.mockClear();
  await runGeneratedVerificationMatrix({
    cells: [resourceCell],
    concurrency: 1,
    resumeFromCells: completedRecord === undefined ? [] : [completedRecord],
    sourceSha: '1'.repeat(40),
    verifyCell,
    workspaceRoot: '/workspace',
  });
  expect(acquire).toHaveBeenCalledOnce();
  expect(verifyCell).not.toHaveBeenCalled();
});

test('a leaked temporary resource fails the cell after verification', async () => {
  const resourceCell = {
    ...cell('leaked-resource'),
    resources: [
      {
        acquire: async () => ({
          cleanup: async () => ({ leaked: true }),
          environment: {},
        }),
        resourceClass: 'temporary-provider-records',
      },
    ],
    environment: {
      ...cell('leaked-resource').environment,
      evidence: {
        ...cell('leaked-resource').environment.evidence,
        resourceClasses: ['temporary-provider-records'],
      },
    },
  } satisfies GeneratedVerificationMatrixCell;

  const report = await runGeneratedVerificationMatrix({
    cells: [resourceCell],
    concurrency: 1,
    sourceSha: '2'.repeat(40),
    verifyCell: async ({ id }) => evidence(id),
    workspaceRoot: '/workspace',
  });

  expect(report.finalReadiness).toBe('not-ready');
  expect(report.cells[0]).toEqual(
    expect.objectContaining({
      failures: [expect.objectContaining({ kind: 'cleanup-failed', phase: 'cleanup' })],
      status: 'failed',
    }),
  );
});

test('unexpected verifier failure records bounded phase and target evidence', async () => {
  const report = await runGeneratedVerificationMatrix({
    cells: [cell('unexpected-failure')],
    concurrency: 1,
    sourceSha: '3'.repeat(40),
    verifyCell: async () => {
      throw new Error('/private/secret/provider-value');
    },
    workspaceRoot: '/workspace',
  });

  expect(report.cells[0]).toEqual(
    expect.objectContaining({
      evidence: expect.objectContaining({
        phases: expect.arrayContaining([
          expect.objectContaining({ phase: 'generation', status: 'failed' }),
          expect.objectContaining({ phase: 'cleanup', status: 'failed' }),
        ]),
        targetName: 'tenkit-generated-unexpected-failure',
      }),
      status: 'failed',
    }),
  );
  expect(JSON.stringify(report)).not.toContain('/private');
  expect(JSON.stringify(report)).not.toContain('provider-value');
});

test('unexpected post-generation failure preserves successful generation ownership', async () => {
  const report = await runGeneratedVerificationMatrix({
    cells: [cell('post-generation-failure')],
    concurrency: 1,
    sourceSha: '6'.repeat(40),
    verifyCell: async () => {
      throw new GeneratedAppVerificationError(
        'tenkit-generated-post-generation-failure-retained',
        'start',
      );
    },
    workspaceRoot: '/workspace',
  });

  expect(report.cells[0]?.evidence).toEqual(
    expect.objectContaining({
      phases: expect.arrayContaining([
        expect.objectContaining({ phase: 'generation', status: 'passed' }),
        expect.objectContaining({ phase: 'start', status: 'failed' }),
      ]),
      retainedTargetName: 'tenkit-generated-post-generation-failure-retained',
    }),
  );
});

test('default verification requires a durable cell evidence sink', async () => {
  await expect(
    runGeneratedVerificationMatrix({
      cells: [cell('durability-required')],
      concurrency: 1,
      sourceSha: '7'.repeat(40),
      workspaceRoot: '/workspace',
    }),
  ).rejects.toThrow(/durable cell evidence sink/);
});
