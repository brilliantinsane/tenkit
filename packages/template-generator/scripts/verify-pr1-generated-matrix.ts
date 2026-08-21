/// <reference types="node" />

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import fs from 'fs-extra';
import { join, resolve } from 'pathe';

import { createGeneratedAppCommandEnvironment } from '../src/generated-app-command-runner';
import {
  runGeneratedVerificationMatrix,
  type GeneratedVerificationCellEvidenceRecord,
} from '../src/generated-verification-matrix';
import {
  createPr1GeneratedVerificationMatrixCells,
  runPr1StylingShapeVerification,
} from '../src/pr1-generated-verification';
import {
  createPr1BaselineCells,
  createPr1InstalledRepresentativeCells,
  createPr1StylingShapeCells,
} from '../src/pr1-generated-verification-plan';
import { createPr1VerificationResourceResolver } from '../src/pr1-generated-verification-resources';

const execFileAsync = promisify(execFile);

type Pr1GeneratedMatrixName = 'baseline' | 'installed' | 'styling';

type ParsedArgs = {
  concurrency: number;
  evidenceDir?: string;
  matrices: readonly Pr1GeneratedMatrixName[];
  sourceSha: string;
};

function usage(): string {
  return 'Usage: pnpm verify:generated-matrix -- --source-sha <full-sha> [--matrix all|baseline|styling|installed] [--concurrency <1-32>] [--evidence-dir <path>]';
}

function readValue(args: readonly string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value.\n${usage()}`);
  }
  return value;
}

function parseArgs(args: readonly string[]): ParsedArgs {
  let sourceSha: string | undefined;
  let evidenceDir: string | undefined;
  let concurrency = 2;
  let matrices: readonly Pr1GeneratedMatrixName[] = ['styling', 'baseline', 'installed'];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') {
      continue;
    }
    if (arg === '--source-sha') {
      sourceSha = readValue(args, index, arg);
      index += 1;
    } else if (arg === '--evidence-dir') {
      evidenceDir = readValue(args, index, arg);
      index += 1;
    } else if (arg === '--concurrency') {
      concurrency = Number(readValue(args, index, arg));
      index += 1;
    } else if (arg === '--matrix') {
      const matrix = readValue(args, index, arg);
      if (matrix === 'all') {
        matrices = ['styling', 'baseline', 'installed'];
      } else if (matrix === 'baseline' || matrix === 'styling' || matrix === 'installed') {
        matrices = [matrix];
      } else {
        throw new Error(`Unknown PR1 generated matrix ${JSON.stringify(matrix)}.\n${usage()}`);
      }
      index += 1;
    } else {
      throw new Error(`Unknown argument ${String(arg)}.\n${usage()}`);
    }
  }

  if (!sourceSha || !/^[0-9a-f]{40}$/.test(sourceSha)) {
    throw new Error(`--source-sha requires a full lowercase Git SHA.\n${usage()}`);
  }
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) {
    throw new Error(`--concurrency must be an integer from 1 through 32.\n${usage()}`);
  }
  return { concurrency, evidenceDir, matrices, sourceSha };
}

async function assertSourceIdentity(workspaceRoot: string, sourceSha: string): Promise<void> {
  const { stdout: headOutput } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  });
  if (headOutput.trim() !== sourceSha) {
    throw new Error('PR1 generated verification source SHA must equal the current Git HEAD.');
  }
  const { stdout: statusOutput } = await execFileAsync('git', ['status', '--porcelain'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  });
  if (statusOutput.trim().length > 0) {
    throw new Error('PR1 generated verification requires a clean worktree.');
  }
}

async function readCellEvidence(
  cellEvidenceDir: string,
): Promise<readonly GeneratedVerificationCellEvidenceRecord[]> {
  if (!(await fs.pathExists(cellEvidenceDir))) {
    return [];
  }
  const records: GeneratedVerificationCellEvidenceRecord[] = [];
  for (const fileName of (await fs.readdir(cellEvidenceDir)).sort()) {
    if (!fileName.endsWith('.json')) {
      continue;
    }
    const record: unknown = await fs.readJson(join(cellEvidenceDir, fileName));
    if (
      typeof record === 'object' &&
      record !== null &&
      'schemaVersion' in record &&
      record.schemaVersion === 1 &&
      'status' in record &&
      record.status === 'completed'
    ) {
      records.push(record as GeneratedVerificationCellEvidenceRecord);
    }
  }
  return records;
}

async function runInstalledMatrix({
  matrixName,
  plans,
  concurrency,
  evidenceDir,
  sourceSha,
  workspaceRoot,
}: {
  matrixName: 'baseline' | 'installed';
  plans: ReturnType<typeof createPr1BaselineCells>;
  concurrency: number;
  evidenceDir: string;
  sourceSha: string;
  workspaceRoot: string;
}): Promise<'ready' | 'not-ready'> {
  const cellEvidenceDir = join(evidenceDir, `${matrixName}-cells`);
  await fs.ensureDir(cellEvidenceDir);
  const cells = createPr1GeneratedVerificationMatrixCells({
    baseEnvironment: createGeneratedAppCommandEnvironment(),
    plans,
    resolveResource: createPr1VerificationResourceResolver(),
  });
  const report = await runGeneratedVerificationMatrix({
    cells,
    cellEvidenceSink: async (record) => {
      await fs.outputJson(join(cellEvidenceDir, `${record.cellId}.json`), record, { spaces: 2 });
    },
    concurrency,
    evidenceSink: async (matrixReport) => {
      await fs.outputJson(join(evidenceDir, `${matrixName}.json`), matrixReport, { spaces: 2 });
    },
    resumeFromCells: await readCellEvidence(cellEvidenceDir),
    sourceSha,
    workspaceRoot,
  });
  return report.finalReadiness;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const workspaceRoot = resolve(import.meta.dirname, '../../..');
  await assertSourceIdentity(workspaceRoot, args.sourceSha);
  const evidenceDir = resolve(
    args.evidenceDir ??
      join(
        workspaceRoot,
        '.scratch/tenkit-backend-auth-release/evidence',
        `76-pr1-${args.sourceSha.slice(0, 7)}`,
      ),
  );
  await fs.ensureDir(evidenceDir);

  let ready = true;
  if (args.matrices.includes('styling')) {
    const report = await runPr1StylingShapeVerification({
      cells: createPr1StylingShapeCells(),
      sourceSha: args.sourceSha,
    });
    await fs.outputJson(join(evidenceDir, 'styling.json'), report, { spaces: 2 });
    ready = ready && report.finalReadiness === 'ready';
  }
  if (args.matrices.includes('baseline')) {
    ready =
      (await runInstalledMatrix({
        concurrency: args.concurrency,
        evidenceDir,
        matrixName: 'baseline',
        plans: createPr1BaselineCells(),
        sourceSha: args.sourceSha,
        workspaceRoot,
      })) === 'ready' && ready;
  }
  if (args.matrices.includes('installed')) {
    ready =
      (await runInstalledMatrix({
        concurrency: args.concurrency,
        evidenceDir,
        matrixName: 'installed',
        plans: createPr1InstalledRepresentativeCells(),
        sourceSha: args.sourceSha,
        workspaceRoot,
      })) === 'ready' && ready;
  }

  console.log(`PR1 generated verification evidence: ${evidenceDir}`);
  if (!ready) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
