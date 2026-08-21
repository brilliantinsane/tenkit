import {
  resolveGeneratedAppOptions,
  SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS,
  type GeneratedAppOptions,
} from '@tenkit/types/generated-app-option-definitions';
import {
  getGeneratedSetupTypeDefinition,
  SUPPORTED_GENERATED_SETUP_TYPE_IDS,
  type GeneratedSetupType,
} from '@tenkit/types/setup-type-definitions';
import { SUPPORTED_GENERATED_STYLING_CHOICES } from '@tenkit/types/styling-definitions';

const EXPECTED_PROVIDER_CELLS = [
  'provider-white-label-express-clerk-none',
  'provider-runtime-tenants-nestjs-clerk-postgresql-prisma',
  'provider-generic-standalone-express-clerk-mysql-drizzle',
  'provider-white-label-convex-none',
  'provider-runtime-tenants-convex-better-auth',
  'provider-generic-standalone-convex-clerk',
] as const;

const EXPECTED_HUMAN_CELLS = [
  'human-white-label-zero-service-bare-pnpm',
  'human-runtime-tenants-express-better-auth-postgresql-prisma-uniwind-npm',
  'human-generic-standalone-nestjs-clerk-mysql-drizzle-unistyles-bun',
  'human-white-label-convex-better-auth-bare-pnpm',
] as const;

const EXPECTED_RELEASE_PACKAGES = [
  '@tenkit/types',
  '@tenkit/template-generator',
  '@tenkit/cli',
  'create-tenkit',
] as const;

const EXPECTED_INSTALLED_CELLS = [
  'installed-white-label-bare-pnpm-none-none-none-none',
  'installed-white-label-uniwind-npm-express-better-auth-postgresql-prisma',
  'installed-white-label-unistyles-bun-convex-clerk-none-none',
  'installed-runtime-tenants-bare-npm-convex-better-auth-none-none',
  'installed-runtime-tenants-uniwind-bun-none-none-none-none',
  'installed-runtime-tenants-unistyles-pnpm-nestjs-clerk-mysql-drizzle',
  'installed-generic-standalone-bare-bun-express-none-mysql-prisma',
  'installed-generic-standalone-uniwind-pnpm-convex-none-none-none',
  'installed-generic-standalone-unistyles-npm-none-none-none-none',
] as const;

const STYLING_AUTH_SHAPES = [
  { auth: 'none', backend: 'none', database: 'none', orm: 'none' },
  { auth: 'better-auth', backend: 'express', database: 'postgresql', orm: 'prisma' },
  { auth: 'clerk', backend: 'convex', database: 'none', orm: 'none' },
] as const satisfies readonly GeneratedAppOptions[];

export type Pr1EvidenceCell = {
  cellId: string;
  status: 'passed' | 'failed' | 'skipped';
  fileCount?: number;
  generatedTreeDigest?: string;
  required?: boolean;
  skipReason?: string;
  note?: string;
  evidence?: {
    status: 'passed' | 'failed';
    phases: Array<{
      phase: string;
      status: string;
      commands?: Array<{ status: string }>;
    }>;
  };
  resources?: Array<{ status: string; leaked: boolean }>;
};

export type Pr1MatrixEvidence = {
  sourceSha: string;
  finalReadiness: 'ready' | 'not-ready';
  summary: { total: number; passed: number; failed: number; skipped: number };
  cells: Pr1EvidenceCell[];
};

export type Pr1AcceptanceEvidence = {
  sourceSha: string;
  cells: Array<{
    cellId: string;
    status: 'passed' | 'failed';
    note?: string;
  }>;
};

export type Pr1ReleaseReadinessInput = {
  sourceSha: string;
  baseline: Pr1MatrixEvidence;
  styling: Pr1MatrixEvidence;
  installed: Pr1MatrixEvidence;
  provider: Pr1AcceptanceEvidence;
  human: Pr1AcceptanceEvidence;
  publicCli: { sourceSha: string; status: 'passed' | 'failed'; cases: number };
  releaseSet: {
    sourceSha: string;
    status: 'passed' | 'failed';
    packages: string[];
  };
  templateContracts: {
    status: 'passed' | 'failed';
    missing: string[];
    fog: string[];
  };
  scope: {
    status: 'passed' | 'failed';
    configuratorPaths: string[];
    fumadocsPaths: string[];
  };
};

export type Pr1ReleaseReadinessGate = {
  id:
    | 'supported-combinations'
    | 'baseline'
    | 'styling'
    | 'installed'
    | 'provider'
    | 'human'
    | 'public-cli'
    | 'template-contracts'
    | 'release-set'
    | 'scope'
    | 'sanitation';
  status: 'passed' | 'failed';
  reason?: string;
};

export type Pr1ReleaseReadinessReport = {
  schemaVersion: 1;
  sourceSha: string;
  finalReadiness: 'ready' | 'not-ready';
  gates: readonly Pr1ReleaseReadinessGate[];
  counts: {
    supportedCombinations: number;
    baselineCells: number;
    expoConfigEvaluations: number;
    stylingCells: number;
    installedCells: number;
    providerCells: number;
    humanCells: number;
    publicCliCases: number;
    releasePackages: number;
  };
};

function pass(id: Pr1ReleaseReadinessGate['id']): Pr1ReleaseReadinessGate {
  return { id, status: 'passed' };
}

function fail(id: Pr1ReleaseReadinessGate['id'], reason: string): Pr1ReleaseReadinessGate {
  return { id, reason, status: 'failed' };
}

function expectedCellId(
  prefix: string,
  setupType: GeneratedSetupType,
  stylingChoice: string,
  packageManager: string,
  generatedAppOptions: GeneratedAppOptions,
): string {
  const { auth, backend, database, orm } = generatedAppOptions;
  return `${prefix}-${getGeneratedSetupTypeDefinition(setupType).publicSlug}-${stylingChoice}-${packageManager}-${backend}-${auth}-${database}-${orm}`;
}

function expectedBaselineCellIds(): readonly string[] {
  return SUPPORTED_GENERATED_SETUP_TYPE_IDS.flatMap((setupType) =>
    SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS.map((generatedAppOptions) =>
      expectedCellId('baseline', setupType, 'bare', 'pnpm', generatedAppOptions),
    ),
  );
}

function expectedStylingCellIds(): readonly string[] {
  return SUPPORTED_GENERATED_SETUP_TYPE_IDS.flatMap((setupType) =>
    SUPPORTED_GENERATED_STYLING_CHOICES.flatMap((stylingChoice) =>
      STYLING_AUTH_SHAPES.map((generatedAppOptions) =>
        expectedCellId('styling', setupType, stylingChoice, 'pnpm', generatedAppOptions),
      ),
    ),
  );
}

function supportedCombinationGate(): Pr1ReleaseReadinessGate {
  const fingerprints = SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS.map((selection) =>
    JSON.stringify(selection),
  );
  const counts = SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS.reduce<Record<string, number>>(
    (familyCounts, selection) => {
      familyCounts[selection.backend] = (familyCounts[selection.backend] ?? 0) + 1;
      return familyCounts;
    },
    {},
  );
  const everySelectionResolves = SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS.every(
    (selection) => resolveGeneratedAppOptions(selection).status === 'resolved',
  );
  return fingerprints.length === 32 &&
    new Set(fingerprints).size === 32 &&
    everySelectionResolves &&
    counts.none === 1 &&
    counts.express === 14 &&
    counts.nestjs === 14 &&
    counts.convex === 3
    ? pass('supported-combinations')
    : fail('supported-combinations', 'Supported combinations are not the exact normalized 32.');
}

function matrixGate(
  id: 'baseline' | 'styling' | 'installed',
  evidence: Pr1MatrixEvidence,
  sourceSha: string,
  expectedCellIds: readonly string[],
): Pr1ReleaseReadinessGate {
  const actualCellIds = evidence.cells.map(({ cellId }) => cellId).sort();
  const exactCellIdentities =
    JSON.stringify(actualCellIds) === JSON.stringify([...expectedCellIds].sort());
  const generatedEvidencePassed = (cell: Pr1EvidenceCell): boolean =>
    cell.evidence?.status === 'passed' &&
    cell.evidence.phases.length > 0 &&
    cell.evidence.phases.every(
      ({ commands = [], status }) =>
        status !== 'failed' &&
        status !== 'skipped' &&
        commands.every((command) => command.status === 'passed'),
    ) &&
    cell.resources !== undefined &&
    cell.resources.every(({ leaked, status }) => status === 'passed' && !leaked);
  const requiredEvidencePassed = evidence.cells.every((cell) => {
    if (cell.required === false) {
      return true;
    }
    if (cell.status === 'passed') {
      if (id === 'styling') {
        return (
          Number.isInteger(cell.fileCount) &&
          (cell.fileCount ?? 0) > 0 &&
          /^[0-9a-f]{64}$/.test(cell.generatedTreeDigest ?? '')
        );
      }
      return generatedEvidencePassed(cell);
    }
    return (
      cell.status === 'skipped' &&
      cell.skipReason === 'already-passed' &&
      generatedEvidencePassed(cell)
    );
  });
  const requiredPhaseSkipped = evidence.cells.some((cell) =>
    cell.evidence?.phases.some(({ status }) => status === 'skipped'),
  );
  return evidence.sourceSha === sourceSha &&
    evidence.finalReadiness === 'ready' &&
    evidence.summary.total === expectedCellIds.length &&
    evidence.summary.failed === 0 &&
    evidence.cells.length === expectedCellIds.length &&
    exactCellIdentities &&
    requiredEvidencePassed &&
    !requiredPhaseSkipped
    ? pass(id)
    : fail(id, `${id} evidence is stale, incomplete, failed, duplicated, or skipped.`);
}

function exactAcceptanceGate(
  id: 'provider' | 'human',
  evidence: Pr1AcceptanceEvidence,
  sourceSha: string,
  expectedCellIds: readonly string[],
): Pr1ReleaseReadinessGate {
  const passedCellIds = evidence.cells
    .filter(({ status }) => status === 'passed')
    .map(({ cellId }) => cellId)
    .sort();
  const expected = [...expectedCellIds].sort();
  return evidence.sourceSha === sourceSha &&
    evidence.cells.length === expected.length &&
    JSON.stringify(passedCellIds) === JSON.stringify(expected)
    ? pass(id)
    : fail(id, `${id} evidence is stale, incomplete, or failed.`);
}

function countExpoConfigEvaluations(evidence: Pr1MatrixEvidence): number {
  return evidence.cells.reduce(
    (count, cell) =>
      count +
      (cell.evidence?.phases.find(({ phase }) => phase === 'expo-config')?.commands?.length ?? 0),
    0,
  );
}

function containsSecretMaterial(input: Pr1ReleaseReadinessInput): boolean {
  const serialized = JSON.stringify(input);
  return [
    /\bBearer\s+[^<\s]/i,
    /\bsk_(?:test|live)_[A-Za-z0-9]/,
    /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
    /\b(?:postgres(?:ql)?|mysql):\/\/[^/\s:]+:[^@\s]+@/i,
    /\/Users\/[^/\s]+\//,
  ].some((pattern) => pattern.test(serialized));
}

export function evaluatePr1ReleaseReadiness(
  input: Pr1ReleaseReadinessInput,
): Pr1ReleaseReadinessReport {
  if (!/^[0-9a-f]{40}$/.test(input.sourceSha)) {
    throw new Error('PR1 Release Readiness requires a full lowercase source SHA.');
  }

  const expoConfigEvaluations = countExpoConfigEvaluations(input.baseline);
  const gates: Pr1ReleaseReadinessGate[] = [
    supportedCombinationGate(),
    matrixGate('baseline', input.baseline, input.sourceSha, expectedBaselineCellIds()),
    matrixGate('styling', input.styling, input.sourceSha, expectedStylingCellIds()),
    matrixGate('installed', input.installed, input.sourceSha, EXPECTED_INSTALLED_CELLS),
    exactAcceptanceGate('provider', input.provider, input.sourceSha, EXPECTED_PROVIDER_CELLS),
    exactAcceptanceGate('human', input.human, input.sourceSha, EXPECTED_HUMAN_CELLS),
    input.publicCli.sourceSha === input.sourceSha &&
    input.publicCli.status === 'passed' &&
    input.publicCli.cases === 156
      ? pass('public-cli')
      : fail('public-cli', 'Public CLI evidence is stale, incomplete, or failed.'),
    input.templateContracts.status === 'passed' &&
    input.templateContracts.missing.length === 0 &&
    input.templateContracts.fog.length === 0
      ? pass('template-contracts')
      : fail('template-contracts', 'Template Work Contracts are missing or contain fog.'),
    input.releaseSet.sourceSha === input.sourceSha &&
    input.releaseSet.status === 'passed' &&
    JSON.stringify(input.releaseSet.packages) === JSON.stringify(EXPECTED_RELEASE_PACKAGES)
      ? pass('release-set')
      : fail('release-set', 'Release Set evidence is stale, incomplete, reordered, or failed.'),
    input.scope.status === 'passed' &&
    input.scope.configuratorPaths.length === 0 &&
    input.scope.fumadocsPaths.length === 0
      ? pass('scope')
      : fail('scope', 'PR1 includes Configurator or Fumadocs implementation paths.'),
    !containsSecretMaterial(input)
      ? pass('sanitation')
      : fail('sanitation', 'PR1 evidence contains secret or private-path material.'),
  ];

  if (expoConfigEvaluations !== 160) {
    const baselineGate = gates.find(({ id }) => id === 'baseline');
    if (baselineGate !== undefined) {
      baselineGate.status = 'failed';
      baselineGate.reason =
        'Baseline evidence does not contain exactly 160 Expo config evaluations.';
    }
  }

  return {
    counts: {
      baselineCells: input.baseline.cells.length,
      expoConfigEvaluations,
      humanCells: input.human.cells.length,
      installedCells: input.installed.cells.length,
      providerCells: input.provider.cells.length,
      publicCliCases: input.publicCli.cases,
      releasePackages: input.releaseSet.packages.length,
      stylingCells: input.styling.cells.length,
      supportedCombinations: SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS.length,
    },
    finalReadiness: gates.every(({ status }) => status === 'passed') ? 'ready' : 'not-ready',
    gates,
    schemaVersion: 1,
    sourceSha: input.sourceSha,
  };
}
