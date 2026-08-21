/// <reference types="node" />

import { execFile, spawn } from 'node:child_process';
import type { ExecFileException } from 'node:child_process';
import { promisify } from 'node:util';

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'pathe';

import {
  evaluatePr1ReleaseReadiness,
  type Pr1AcceptanceEvidence,
  type Pr1MatrixEvidence,
  type Pr1ReleaseReadinessInput,
} from '../src/pr1-release-readiness';

const execFileAsync = promisify(execFile);

type ParsedArgs = {
  evidenceDir?: string;
  runAutomatedGates: boolean;
  sourceSha: string;
};

function usage(): string {
  return 'Usage: pnpm pr1:readiness -- --source-sha <full-sha> [--evidence-dir <path>] [--reuse-automated-evidence]';
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
  let runAutomatedGates = true;
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
    } else if (arg === '--reuse-automated-evidence') {
      runAutomatedGates = false;
    } else {
      throw new Error(`Unknown argument ${String(arg)}.\n${usage()}`);
    }
  }
  if (!sourceSha || !/^[0-9a-f]{40}$/.test(sourceSha)) {
    throw new Error(`--source-sha requires a full lowercase Git SHA.\n${usage()}`);
  }
  return { evidenceDir, runAutomatedGates, sourceSha };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMatrixEvidence(value: unknown): value is Pr1MatrixEvidence {
  if (!isRecord(value) || typeof value.sourceSha !== 'string' || !Array.isArray(value.cells)) {
    return false;
  }
  if (
    (value.finalReadiness !== 'ready' && value.finalReadiness !== 'not-ready') ||
    !isRecord(value.summary) ||
    typeof value.summary.total !== 'number' ||
    typeof value.summary.passed !== 'number' ||
    typeof value.summary.failed !== 'number' ||
    typeof value.summary.skipped !== 'number'
  ) {
    return false;
  }
  return value.cells.every((cell) => {
    if (
      !isRecord(cell) ||
      typeof cell.cellId !== 'string' ||
      (cell.status !== 'passed' && cell.status !== 'failed' && cell.status !== 'skipped')
    ) {
      return false;
    }
    if (
      cell.evidence !== undefined &&
      (!isRecord(cell.evidence) ||
        (cell.evidence.status !== 'passed' && cell.evidence.status !== 'failed') ||
        !Array.isArray(cell.evidence.phases) ||
        !cell.evidence.phases.every(
          (phase) =>
            isRecord(phase) &&
            typeof phase.phase === 'string' &&
            typeof phase.status === 'string' &&
            (phase.commands === undefined ||
              (Array.isArray(phase.commands) &&
                phase.commands.every(
                  (command) => isRecord(command) && typeof command.status === 'string',
                ))),
        ))
    ) {
      return false;
    }
    return (
      cell.resources === undefined ||
      (Array.isArray(cell.resources) &&
        cell.resources.every(
          (resource) =>
            isRecord(resource) &&
            typeof resource.status === 'string' &&
            typeof resource.leaked === 'boolean',
        ))
    );
  });
}

function isAcceptanceEvidence(value: unknown): value is Pr1AcceptanceEvidence {
  return (
    isRecord(value) &&
    typeof value.sourceSha === 'string' &&
    Array.isArray(value.cells) &&
    value.cells.every(
      (cell) =>
        isRecord(cell) &&
        typeof cell.cellId === 'string' &&
        (cell.status === 'passed' || cell.status === 'failed'),
    )
  );
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

async function readMatrixEvidence(path: string): Promise<Pr1MatrixEvidence> {
  const value = await readJson(path);
  if (!isMatrixEvidence(value)) {
    throw new Error(`Invalid PR1 matrix evidence: ${basename(path)}.`);
  }
  return value;
}

async function readAcceptanceEvidence(path: string): Promise<Pr1AcceptanceEvidence> {
  const value = await readJson(path);
  if (!isAcceptanceEvidence(value)) {
    throw new Error(`Invalid PR1 acceptance evidence: ${basename(path)}.`);
  }
  return value;
}

async function assertSourceIdentity(workspaceRoot: string, sourceSha: string): Promise<void> {
  const { stdout: headOutput } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  });
  if (headOutput.trim() !== sourceSha) {
    throw new Error('PR1 Release Readiness source SHA must equal the current Git HEAD.');
  }
  const { stdout: statusOutput } = await execFileAsync('git', ['status', '--porcelain'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  });
  if (statusOutput.trim().length > 0) {
    throw new Error('PR1 Release Readiness requires a clean worktree.');
  }
}

function runPnpm(workspaceRoot: string, args: readonly string[]): Promise<void> {
  return new Promise((resolveCommand, reject) => {
    const child = spawn('pnpm', [...args], {
      cwd: workspaceRoot,
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) {
        resolveCommand();
      } else {
        reject(new Error('A PR1 automated readiness command failed.'));
      }
    });
  });
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function automatedEvidence(
  workspaceRoot: string,
  evidenceDir: string,
  sourceSha: string,
): Promise<Pick<Pr1ReleaseReadinessInput, 'publicCli' | 'releaseSet'>> {
  await runPnpm(workspaceRoot, ['verify:matrix']);
  const publicCli = { cases: 156, sourceSha, status: 'passed' as const };
  await writeJson(join(evidenceDir, 'public-cli.json'), publicCli);

  await runPnpm(workspaceRoot, ['release:check']);
  const releaseSet = {
    packages: ['@tenkit/types', '@tenkit/template-generator', '@tenkit/cli', 'create-tenkit'],
    sourceSha,
    status: 'passed' as const,
  };
  await writeJson(join(evidenceDir, 'release-set.json'), releaseSet);
  return { publicCli, releaseSet };
}

async function reusedAutomatedEvidence(
  evidenceDir: string,
): Promise<Pick<Pr1ReleaseReadinessInput, 'publicCli' | 'releaseSet'>> {
  const publicCli = await readJson(join(evidenceDir, 'public-cli.json'));
  const releaseSet = await readJson(join(evidenceDir, 'release-set.json'));
  if (
    !isRecord(publicCli) ||
    typeof publicCli.sourceSha !== 'string' ||
    (publicCli.status !== 'passed' && publicCli.status !== 'failed') ||
    typeof publicCli.cases !== 'number' ||
    !isRecord(releaseSet) ||
    typeof releaseSet.sourceSha !== 'string' ||
    (releaseSet.status !== 'passed' && releaseSet.status !== 'failed') ||
    !Array.isArray(releaseSet.packages) ||
    !releaseSet.packages.every((packageName) => typeof packageName === 'string')
  ) {
    throw new Error('Invalid reused PR1 automated evidence.');
  }
  return {
    publicCli: {
      cases: publicCli.cases,
      sourceSha: publicCli.sourceSha,
      status: publicCli.status,
    },
    releaseSet: {
      packages: releaseSet.packages,
      sourceSha: releaseSet.sourceSha,
      status: releaseSet.status,
    },
  };
}

async function auditTemplateContracts(workspaceRoot: string) {
  const effortRoot = join(workspaceRoot, '.scratch/tenkit-backend-auth-release');
  const issuesRoot = join(effortRoot, 'issues');
  const requiredTickets: string[] = [];
  for (const issueName of (await readdir(issuesRoot)).sort()) {
    const issue = await readFile(join(issuesRoot, issueName), 'utf8');
    if (issue.includes('Complete the Template Work Contract')) {
      requiredTickets.push(issueName.split('-')[0]?.replace(/^0+/, '') ?? '');
    }
  }
  const missing: string[] = [];
  const fog: string[] = [];
  for (const ticket of requiredTickets) {
    const path = join(effortRoot, `TEMPLATE_WORK_CONTRACT-${ticket}.md`);
    let contract: string;
    try {
      contract = await readFile(path, 'utf8');
    } catch {
      missing.push(ticket);
      continue;
    }
    if (!/No fog\.?/i.test(contract)) {
      fog.push(ticket);
    }
  }
  return {
    fog,
    missing,
    status: missing.length === 0 && fog.length === 0 ? ('passed' as const) : ('failed' as const),
  };
}

async function auditPr1Scope(workspaceRoot: string) {
  const webRoot = join(workspaceRoot, 'apps/web');
  const forbiddenConfiguratorPattern =
    'SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS|getGeneratedAppOptionChoiceState|GeneratedAppOptions|--backend|--auth|--database|--orm';
  const forbiddenFumadocsPattern = 'fumadocs';
  const findPaths = async (pattern: string): Promise<string[]> => {
    try {
      const { stdout } = await execFileAsync(
        'rg',
        ['--files-with-matches', '--ignore-case', pattern, webRoot],
        { cwd: workspaceRoot, encoding: 'utf8' },
      );
      return stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((path) => path.replace(`${workspaceRoot}/`, ''))
        .sort();
    } catch (error) {
      if ((error as ExecFileException).code === 1) {
        return [];
      }
      throw new Error('PR1 scope audit could not inspect the Public Web App.', { cause: error });
    }
  };
  const configuratorPaths = await findPaths(forbiddenConfiguratorPattern);
  const fumadocsPaths = await findPaths(forbiddenFumadocsPattern);
  return {
    configuratorPaths,
    fumadocsPaths,
    status:
      configuratorPaths.length === 0 && fumadocsPaths.length === 0
        ? ('passed' as const)
        : ('failed' as const),
  };
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

  const automated = args.runAutomatedGates
    ? await automatedEvidence(workspaceRoot, evidenceDir, args.sourceSha)
    : await reusedAutomatedEvidence(evidenceDir);
  const input: Pr1ReleaseReadinessInput = {
    baseline: await readMatrixEvidence(join(evidenceDir, 'baseline.json')),
    human: await readAcceptanceEvidence(join(evidenceDir, 'human.json')),
    installed: await readMatrixEvidence(join(evidenceDir, 'installed.json')),
    provider: await readAcceptanceEvidence(join(evidenceDir, 'provider.json')),
    publicCli: automated.publicCli,
    releaseSet: automated.releaseSet,
    scope: await auditPr1Scope(workspaceRoot),
    sourceSha: args.sourceSha,
    styling: await readMatrixEvidence(join(evidenceDir, 'styling.json')),
    templateContracts: await auditTemplateContracts(workspaceRoot),
  };
  const report = evaluatePr1ReleaseReadiness(input);
  await writeJson(join(evidenceDir, 'pr1-readiness.json'), report);

  console.log(`PR1 Release Readiness: ${report.finalReadiness}`);
  console.log(`Evidence: ${join(evidenceDir, 'pr1-readiness.json')}`);
  for (const gate of report.gates.filter(({ status }) => status === 'failed')) {
    console.error(`- ${gate.id}: ${gate.reason ?? 'failed'}`);
  }
  if (report.finalReadiness !== 'ready') {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
