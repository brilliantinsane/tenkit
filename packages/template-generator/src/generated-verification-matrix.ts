import {
  GeneratedAppVerificationError,
  verifyGeneratedApp,
  type VerifyGeneratedAppOptions,
} from './generated-app-verification';
import type {
  GeneratedProjectVerificationEvidence,
  GeneratedProjectVerificationFailure,
  GeneratedProjectVerificationPhaseEvidence,
  GeneratedProjectVerificationProfile,
  GeneratedProjectVerificationSelection,
} from './generated-project-verification';
import {
  GENERATED_PROJECT_VERIFICATION_PHASES,
  resolveGeneratedProjectVerificationSelection,
} from './generated-project-verification';
import {
  createSkippedVerificationPhase,
  createVerificationPhaseEvidence,
} from './generated-project-verification-evidence';
import type { GeneratedVerificationEnvironment } from './provider-test-profiles';

const MAX_MATRIX_CONCURRENCY = 32;

export type GeneratedVerificationMatrixCell = {
  id: string;
  selection: GeneratedProjectVerificationSelection;
  verificationProfile: GeneratedProjectVerificationProfile;
  environment: GeneratedVerificationEnvironment;
  resources?: readonly GeneratedVerificationResourceFactory[];
  required?: boolean;
};

export type GeneratedVerificationResourceFactory = {
  resourceClass: string;
  acquire: () => Promise<{
    environment: Readonly<Record<string, string>>;
    cleanup: () => Promise<{ leaked: boolean }>;
  }>;
};

export type GeneratedVerificationResourceEvidence = {
  resourceClass: string;
  durationMs: number;
  status: 'passed' | 'failed';
  leaked: boolean;
};

export type GeneratedVerificationCellExecution = {
  environment: Readonly<Record<string, string>>;
};

export type GeneratedVerificationMatrixCellReport = {
  cellId: string;
  definition: {
    selection: GeneratedProjectVerificationSelection;
    verificationProfile: GeneratedProjectVerificationProfile;
  };
  status: 'passed' | 'failed' | 'skipped';
  required: boolean;
  durationMs: number;
  environment: GeneratedVerificationEnvironment['evidence'];
  evidence?: GeneratedProjectVerificationEvidence;
  failures: readonly GeneratedProjectVerificationFailure[];
  resources: readonly GeneratedVerificationResourceEvidence[];
  skipReason?: 'already-passed' | 'cancelled' | 'not-selected';
};

export type GeneratedVerificationMatrixReport = {
  schemaVersion: 1;
  sourceSha: string;
  concurrency: number;
  durationMs: number;
  finalReadiness: 'ready' | 'not-ready';
  cells: readonly GeneratedVerificationMatrixCellReport[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
};

export type GeneratedVerificationCellEvidenceRecord = {
  schemaVersion: 1;
  sourceSha: string;
  cellId: string;
  evidence: GeneratedProjectVerificationEvidence;
  resources: readonly GeneratedVerificationResourceEvidence[];
} & (
  | { status: 'verified-awaiting-target-cleanup' }
  | { status: 'completed'; cellReport: GeneratedVerificationMatrixCellReport }
);

export type RunGeneratedVerificationMatrixOptions = {
  cells: readonly GeneratedVerificationMatrixCell[];
  concurrency: number;
  sourceSha: string;
  workspaceRoot: string;
  signal?: AbortSignal;
  selectedCellIds?: readonly string[];
  resumeFrom?: GeneratedVerificationMatrixReport;
  resumeFromCells?: readonly GeneratedVerificationCellEvidenceRecord[];
  evidenceSink?: (report: GeneratedVerificationMatrixReport) => Promise<void>;
  cellEvidenceSink?: (record: GeneratedVerificationCellEvidenceRecord) => Promise<void>;
  verifyCell?: (
    cell: GeneratedVerificationMatrixCell,
    execution: GeneratedVerificationCellExecution,
  ) => Promise<GeneratedProjectVerificationEvidence>;
};

function createCellReportBase(matrixCell: GeneratedVerificationMatrixCell) {
  return {
    cellId: matrixCell.id,
    definition: {
      selection: {
        ...matrixCell.selection,
        ...(matrixCell.selection.appVariantAccents === undefined
          ? {}
          : { appVariantAccents: [...matrixCell.selection.appVariantAccents] }),
        ...(matrixCell.selection.appVariantNames === undefined
          ? {}
          : { appVariantNames: [...matrixCell.selection.appVariantNames] }),
      },
      verificationProfile: matrixCell.verificationProfile,
    },
    environment: {
      ...matrixCell.environment.evidence,
      environmentKeys: [...matrixCell.environment.evidence.environmentKeys],
      resourceClasses: [...matrixCell.environment.evidence.resourceClasses],
    },
    required: matrixCell.required ?? true,
  } satisfies Pick<
    GeneratedVerificationMatrixCellReport,
    'cellId' | 'definition' | 'environment' | 'required'
  >;
}

function assertMatrixInputs(options: RunGeneratedVerificationMatrixOptions): void {
  const { cells, concurrency, sourceSha, selectedCellIds, resumeFrom, resumeFromCells } = options;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > MAX_MATRIX_CONCURRENCY) {
    throw new Error(
      `Generated verification matrix concurrency must be between 1 and ${MAX_MATRIX_CONCURRENCY}.`,
    );
  }
  if (!/^[0-9a-f]{40}$/.test(sourceSha)) {
    throw new Error('Generated verification matrix source SHA must be a full lowercase Git SHA.');
  }
  if (options.verifyCell === undefined && options.cellEvidenceSink === undefined) {
    throw new Error('Default generated verification requires a durable cell evidence sink.');
  }

  const knownCellIds = new Set<string>();
  for (const matrixCell of cells) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(matrixCell.id)) {
      throw new Error(
        `Matrix cell ${JSON.stringify(matrixCell.id)} needs a stable lowercase identity.`,
      );
    }
    if (knownCellIds.has(matrixCell.id)) {
      throw new Error(`Duplicate generated verification matrix cell: ${matrixCell.id}.`);
    }
    knownCellIds.add(matrixCell.id);

    const knownResourceClasses = new Set<string>();
    for (const resource of matrixCell.resources ?? []) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(resource.resourceClass)) {
        throw new Error(
          `Matrix cell ${matrixCell.id} has an unsafe resource class ${JSON.stringify(resource.resourceClass)}.`,
        );
      }
      if (knownResourceClasses.has(resource.resourceClass)) {
        throw new Error(
          `Matrix cell ${matrixCell.id} has duplicate resource class ${resource.resourceClass}.`,
        );
      }
      if (!matrixCell.environment.evidence.resourceClasses.includes(resource.resourceClass)) {
        throw new Error(
          `Matrix cell ${matrixCell.id} does not declare resource class ${resource.resourceClass} in environment evidence.`,
        );
      }
      knownResourceClasses.add(resource.resourceClass);
    }
  }

  const selectedIds = new Set<string>();
  for (const cellId of selectedCellIds ?? []) {
    if (!knownCellIds.has(cellId)) {
      throw new Error(`Unknown selected matrix cell: ${cellId}.`);
    }
    if (selectedIds.has(cellId)) {
      throw new Error(`Duplicate selected matrix cell: ${cellId}.`);
    }
    selectedIds.add(cellId);
  }

  for (const record of resumeFromCells ?? []) {
    if (record.sourceSha !== sourceSha) {
      throw new Error('Generated verification cell resume evidence must use the same source SHA.');
    }
    if (!knownCellIds.has(record.cellId)) {
      throw new Error(`Unknown resumed matrix cell: ${record.cellId}.`);
    }
    if (record.status === 'completed' && record.cellReport.cellId !== record.cellId) {
      throw new Error(`Generated verification cell resume identity mismatch: ${record.cellId}.`);
    }
  }

  if (resumeFrom !== undefined && resumeFrom.sourceSha !== sourceSha) {
    throw new Error('Generated verification matrix resume evidence must use the same source SHA.');
  }
}

function findCleanupFailure(
  evidence: GeneratedProjectVerificationEvidence,
): GeneratedProjectVerificationFailure | undefined {
  const cleanup = evidence.phases.find(({ phase }) => phase === 'cleanup');
  if (cleanup?.status === 'passed') {
    return undefined;
  }

  return (
    evidence.failures.find(
      ({ kind, phase }) => kind === 'cleanup-failed' || phase === 'cleanup',
    ) ?? {
      kind: 'cleanup-failed',
      message: 'Generated verification did not prove temporary resource cleanup.',
      phase: 'cleanup',
    }
  );
}

function isReusableReportCell(
  reportCell: GeneratedVerificationMatrixCellReport | undefined,
  matrixCell: GeneratedVerificationMatrixCell,
): reportCell is GeneratedVerificationMatrixCellReport & {
  evidence: GeneratedProjectVerificationEvidence;
} {
  if (
    reportCell?.evidence === undefined ||
    (reportCell.status !== 'passed' && reportCell.skipReason !== 'already-passed')
  ) {
    return false;
  }

  const { selection } = reportCell.evidence;
  return (
    reportCell.evidence.status === 'passed' &&
    reportCell.evidence.profile === matrixCell.verificationProfile &&
    selection.setupType === matrixCell.selection.setupType &&
    selection.stylingChoice === matrixCell.selection.stylingChoice &&
    selection.packageManager === matrixCell.selection.packageManager &&
    JSON.stringify(reportCell.definition) ===
      JSON.stringify(createCellReportBase(matrixCell).definition) &&
    JSON.stringify(reportCell.environment) === JSON.stringify(matrixCell.environment.evidence) &&
    JSON.stringify(reportCell.resources.map(({ resourceClass }) => resourceClass).sort()) ===
      JSON.stringify(
        (matrixCell.resources ?? []).map(({ resourceClass }) => resourceClass).sort(),
      ) &&
    findCleanupFailure(reportCell.evidence) === undefined
  );
}

async function defaultVerifyCell(
  matrixCell: GeneratedVerificationMatrixCell,
  workspaceRoot: string,
  environment: Readonly<Record<string, string>>,
  beforeSuccessfulTargetCleanup?: (evidence: GeneratedProjectVerificationEvidence) => Promise<void>,
): Promise<GeneratedProjectVerificationEvidence> {
  const options: VerifyGeneratedAppOptions = {
    ...matrixCell.selection,
    beforeSuccessfulTargetCleanup,
    environment,
    profile: matrixCell.verificationProfile,
    targetNamePrefix: `tenkit-generated-${matrixCell.id}`,
    workspaceRoot,
  };
  return verifyGeneratedApp(options);
}

function createUnexpectedFailureEvidence(
  matrixCell: GeneratedVerificationMatrixCell,
  environment: Readonly<Record<string, string>>,
  retainedTargetName?: string,
  failedPhase: GeneratedProjectVerificationFailure['phase'] = 'generation',
  completedPhases: readonly GeneratedProjectVerificationPhaseEvidence[] = [],
): GeneratedProjectVerificationEvidence {
  const failurePhase = retainedTargetName === undefined ? 'generation' : failedPhase;
  const completedPhaseEvidence = new Map(completedPhases.map((phase) => [phase.phase, phase]));
  return {
    environmentKeys: Object.keys(environment).sort(),
    failures: [
      {
        kind: 'verification-failed',
        message:
          retainedTargetName === undefined
            ? 'Generated project verification terminated unexpectedly during generation.'
            : `Generated project verification terminated unexpectedly during ${failurePhase}.`,
        phase: failurePhase,
      },
      {
        kind: 'cleanup-failed',
        message: 'Generated target cleanup could not be proven after unexpected termination.',
        phase: 'cleanup',
      },
    ],
    phases: GENERATED_PROJECT_VERIFICATION_PHASES.map((phase) => {
      if (phase === 'generation') {
        return createVerificationPhaseEvidence(
          phase,
          retainedTargetName === undefined ? 'failed' : 'passed',
        );
      }
      const completedPhase = completedPhaseEvidence.get(phase);
      if (completedPhase !== undefined) {
        return completedPhase;
      }
      if (phase === failurePhase || phase === 'cleanup') {
        return createVerificationPhaseEvidence(phase, 'failed');
      }
      return createSkippedVerificationPhase(phase);
    }),
    profile: matrixCell.verificationProfile,
    selection: resolveGeneratedProjectVerificationSelection(matrixCell.selection),
    status: 'failed',
    targetName: retainedTargetName ?? `tenkit-generated-${matrixCell.id}`,
    ...(retainedTargetName === undefined ? {} : { retainedTargetName }),
  };
}

function assertExactEnvironmentKeys(
  matrixCell: GeneratedVerificationMatrixCell,
  environment: Readonly<Record<string, string>>,
): void {
  const actualKeys = Object.keys(environment).sort();
  const expectedKeys = [...matrixCell.environment.evidence.environmentKeys].sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error(`Matrix cell ${matrixCell.id} environment keys do not match its allowlist.`);
  }
}

export async function runGeneratedVerificationMatrix(
  options: RunGeneratedVerificationMatrixOptions,
): Promise<GeneratedVerificationMatrixReport> {
  assertMatrixInputs(options);
  const matrixStartedAt = performance.now();
  const sortedCells = [...options.cells].sort((left, right) => left.id.localeCompare(right.id));
  const selectedCellIds =
    options.selectedCellIds === undefined ? undefined : new Set(options.selectedCellIds);
  const previousCells = new Map(
    options.resumeFrom?.cells.map((reportCell) => [reportCell.cellId, reportCell]) ?? [],
  );
  for (const record of options.resumeFromCells ?? []) {
    if (record.status === 'completed') {
      previousCells.set(record.cellId, record.cellReport);
    }
  }
  const reports = new Map<string, GeneratedVerificationMatrixCellReport>();
  const pendingCells: GeneratedVerificationMatrixCell[] = [];

  for (const matrixCell of sortedCells) {
    if (selectedCellIds !== undefined && !selectedCellIds.has(matrixCell.id)) {
      const previousCell = previousCells.get(matrixCell.id);
      if (isReusableReportCell(previousCell, matrixCell)) {
        reports.set(matrixCell.id, {
          ...createCellReportBase(matrixCell),
          durationMs: 0,
          evidence: previousCell.evidence,
          failures: [],
          resources: previousCell.resources,
          skipReason: 'already-passed',
          status: 'skipped',
        });
      } else {
        reports.set(matrixCell.id, {
          ...createCellReportBase(matrixCell),
          durationMs: 0,
          failures: [],
          resources: [],
          skipReason: 'not-selected',
          status: 'skipped',
        });
      }
      continue;
    }

    const previousCell = previousCells.get(matrixCell.id);
    if (isReusableReportCell(previousCell, matrixCell)) {
      reports.set(matrixCell.id, {
        ...createCellReportBase(matrixCell),
        durationMs: 0,
        evidence: previousCell.evidence,
        failures: [],
        resources: previousCell.resources,
        skipReason: 'already-passed',
        status: 'skipped',
      });
      continue;
    }

    pendingCells.push(matrixCell);
  }

  let nextCellIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextCellIndex < pendingCells.length) {
      if (options.signal?.aborted) {
        return;
      }
      const matrixCell = pendingCells[nextCellIndex];
      nextCellIndex += 1;
      if (matrixCell === undefined) {
        return;
      }

      const startedAt = performance.now();
      const environment: Record<string, string> = { ...matrixCell.environment.values };
      const acquiredResources: Array<{
        cleanup: () => Promise<{ leaked: boolean }>;
        resourceClass: string;
      }> = [];
      const resourceEvidence: GeneratedVerificationResourceEvidence[] = [];
      let evidence: GeneratedProjectVerificationEvidence | undefined;

      const cleanupAcquiredResources = async (): Promise<void> => {
        while (acquiredResources.length > 0) {
          const resource = acquiredResources.pop();
          if (resource === undefined) {
            continue;
          }
          const cleanupStartedAt = performance.now();
          try {
            const cleanup = await resource.cleanup();
            resourceEvidence.push({
              durationMs: Math.max(0, Math.round(performance.now() - cleanupStartedAt)),
              leaked: cleanup.leaked,
              resourceClass: resource.resourceClass,
              status: cleanup.leaked ? 'failed' : 'passed',
            });
          } catch {
            resourceEvidence.push({
              durationMs: Math.max(0, Math.round(performance.now() - cleanupStartedAt)),
              leaked: true,
              resourceClass: resource.resourceClass,
              status: 'failed',
            });
          }
        }
      };

      try {
        for (const resourceFactory of matrixCell.resources ?? []) {
          const resourceStartedAt = performance.now();
          let resource: Awaited<ReturnType<GeneratedVerificationResourceFactory['acquire']>>;
          try {
            resource = await resourceFactory.acquire();
          } catch {
            resourceEvidence.push({
              durationMs: Math.max(0, Math.round(performance.now() - resourceStartedAt)),
              leaked: true,
              resourceClass: resourceFactory.resourceClass,
              status: 'failed',
            });
            throw new Error('Generated verification resource acquisition failed.');
          }

          acquiredResources.push({
            cleanup: resource.cleanup,
            resourceClass: resourceFactory.resourceClass,
          });
          for (const [environmentKey, environmentValue] of Object.entries(resource.environment)) {
            if (environmentKey in environment) {
              throw new Error(`Matrix resource environment duplicates key ${environmentKey}.`);
            }
            environment[environmentKey] = environmentValue;
          }
        }

        assertExactEnvironmentKeys(matrixCell, environment);
        evidence = await (options.verifyCell
          ? options.verifyCell(matrixCell, { environment })
          : defaultVerifyCell(
              matrixCell,
              options.workspaceRoot,
              environment,
              async (verifiedEvidence) => {
                await cleanupAcquiredResources();
                await options.cellEvidenceSink?.({
                  cellId: matrixCell.id,
                  evidence: verifiedEvidence,
                  resources: [...resourceEvidence],
                  schemaVersion: 1,
                  sourceSha: options.sourceSha,
                  status: 'verified-awaiting-target-cleanup',
                });
                if (resourceEvidence.some(({ status }) => status === 'failed')) {
                  throw new Error('Generated verification resource cleanup failed.');
                }
              },
            ));
      } catch (error) {
        evidence = createUnexpectedFailureEvidence(
          matrixCell,
          environment,
          error instanceof GeneratedAppVerificationError ? error.retainedTargetName : undefined,
          error instanceof GeneratedAppVerificationError ? error.phase : 'generation',
          error instanceof GeneratedAppVerificationError ? error.completedPhases : [],
        );
      } finally {
        await cleanupAcquiredResources();
      }

      const completedEvidence =
        evidence ?? createUnexpectedFailureEvidence(matrixCell, environment);
      const cleanupFailure = findCleanupFailure(completedEvidence);
      const resourceCleanupFailed = resourceEvidence.some(({ status }) => status === 'failed');
      const failures = cleanupFailure
        ? [
            ...completedEvidence.failures.filter(
              ({ kind, phase }) => kind !== 'cleanup-failed' && phase !== 'cleanup',
            ),
            cleanupFailure,
          ]
        : [...completedEvidence.failures];
      if (resourceCleanupFailed) {
        failures.push({
          kind: 'cleanup-failed',
          message: 'Generated verification temporary resource cleanup failed.',
          phase: 'cleanup',
        });
      }
      const cellReport: GeneratedVerificationMatrixCellReport = {
        ...createCellReportBase(matrixCell),
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
        evidence: completedEvidence,
        failures,
        resources: resourceEvidence.sort((left, right) =>
          left.resourceClass.localeCompare(right.resourceClass),
        ),
        status:
          completedEvidence.status === 'passed' &&
          cleanupFailure === undefined &&
          !resourceCleanupFailed
            ? 'passed'
            : 'failed',
      };
      reports.set(matrixCell.id, cellReport);
      await options.cellEvidenceSink?.({
        cellId: matrixCell.id,
        cellReport,
        evidence: completedEvidence,
        resources: cellReport.resources,
        schemaVersion: 1,
        sourceSha: options.sourceSha,
        status: 'completed',
      });
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(options.concurrency, pendingCells.length) }, () => worker()),
  );

  if (options.signal?.aborted) {
    for (const matrixCell of pendingCells) {
      if (!reports.has(matrixCell.id)) {
        reports.set(matrixCell.id, {
          ...createCellReportBase(matrixCell),
          durationMs: 0,
          failures: [],
          resources: [],
          skipReason: 'cancelled',
          status: 'skipped',
        });
      }
    }
  }

  const cells = sortedCells.map((matrixCell) => {
    const report = reports.get(matrixCell.id);
    if (report === undefined) {
      throw new Error(`Missing generated verification matrix report for ${matrixCell.id}.`);
    }
    return report;
  });
  const summary = {
    total: cells.length,
    passed: cells.filter(({ status }) => status === 'passed').length,
    failed: cells.filter(({ status }) => status === 'failed').length,
    skipped: cells.filter(({ status }) => status === 'skipped').length,
  };
  const isReady = cells.every(
    ({ required, status, skipReason }) =>
      !required || status === 'passed' || skipReason === 'already-passed',
  );
  const report: GeneratedVerificationMatrixReport = {
    cells,
    concurrency: options.concurrency,
    durationMs: Math.max(0, Math.round(performance.now() - matrixStartedAt)),
    finalReadiness: isReady ? 'ready' : 'not-ready',
    schemaVersion: 1,
    sourceSha: options.sourceSha,
    summary,
  };

  await options.evidenceSink?.(report);
  return report;
}
