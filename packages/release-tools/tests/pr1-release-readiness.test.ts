import { describe, expect, test } from 'vitest';

import { SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS } from '@tenkit/types/generated-app-option-definitions';
import {
  getGeneratedSetupTypeDefinition,
  SUPPORTED_GENERATED_SETUP_TYPE_IDS,
} from '@tenkit/types/setup-type-definitions';
import { SUPPORTED_GENERATED_STYLING_CHOICES } from '@tenkit/types/styling-definitions';

import {
  evaluatePr1ReleaseReadiness,
  type Pr1ReleaseReadinessInput,
} from '../src/pr1-release-readiness';

const sourceSha = 'a'.repeat(40);

const stylingAuthShapes = [
  { auth: 'none', backend: 'none', database: 'none', orm: 'none' },
  { auth: 'better-auth', backend: 'express', database: 'postgresql', orm: 'prisma' },
  { auth: 'clerk', backend: 'convex', database: 'none', orm: 'none' },
] as const;

function cellId(
  prefix: string,
  setupType: (typeof SUPPORTED_GENERATED_SETUP_TYPE_IDS)[number],
  styling: string,
  packageManager: string,
  options: (typeof SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS)[number],
) {
  return `${prefix}-${getGeneratedSetupTypeDefinition(setupType).publicSlug}-${styling}-${packageManager}-${options.backend}-${options.auth}-${options.database}-${options.orm}`;
}

const baselineCellIds = SUPPORTED_GENERATED_SETUP_TYPE_IDS.flatMap((setupType) =>
  SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS.map((options) =>
    cellId('baseline', setupType, 'bare', 'pnpm', options),
  ),
);
const stylingCellIds = SUPPORTED_GENERATED_SETUP_TYPE_IDS.flatMap((setupType) =>
  SUPPORTED_GENERATED_STYLING_CHOICES.flatMap((styling) =>
    stylingAuthShapes.map((options) => cellId('styling', setupType, styling, 'pnpm', options)),
  ),
);
const installedCellIds = [
  'installed-white-label-bare-pnpm-none-none-none-none',
  'installed-white-label-uniwind-npm-express-better-auth-postgresql-prisma',
  'installed-white-label-unistyles-bun-convex-clerk-none-none',
  'installed-runtime-tenants-bare-npm-convex-better-auth-none-none',
  'installed-runtime-tenants-uniwind-bun-none-none-none-none',
  'installed-runtime-tenants-unistyles-pnpm-nestjs-clerk-mysql-drizzle',
  'installed-generic-standalone-bare-bun-express-none-mysql-prisma',
  'installed-generic-standalone-uniwind-pnpm-convex-none-none-none',
  'installed-generic-standalone-unistyles-npm-none-none-none-none',
];

function matrixEvidence(cellIds: readonly string[], expoConfigEvaluations = 0) {
  let remainingExpoConfigEvaluations = expoConfigEvaluations;
  return {
    sourceSha,
    finalReadiness: 'ready' as const,
    summary: { total: cellIds.length, passed: cellIds.length, failed: 0, skipped: 0 },
    cells: cellIds.map((cellId) => {
      const commandCount = Math.min(2, remainingExpoConfigEvaluations);
      remainingExpoConfigEvaluations -= commandCount;
      return {
        cellId,
        required: true,
        status: 'passed' as const,
        evidence: {
          status: 'passed' as const,
          phases: [
            {
              phase: 'expo-config',
              status: 'passed' as const,
              commands: Array.from({ length: commandCount }, () => ({ status: 'passed' })),
            },
          ],
        },
        resources: [],
      };
    }),
  };
}

function passingInput(): Pr1ReleaseReadinessInput {
  return {
    sourceSha,
    baseline: matrixEvidence(baselineCellIds, 160),
    styling: {
      ...matrixEvidence(stylingCellIds),
      cells: stylingCellIds.map((cellId) => ({
        cellId,
        fileCount: 42,
        generatedTreeDigest: 'c'.repeat(64),
        status: 'passed' as const,
      })),
    },
    installed: matrixEvidence(installedCellIds),
    provider: {
      sourceSha,
      cells: [
        'provider-white-label-express-clerk-none',
        'provider-runtime-tenants-nestjs-clerk-postgresql-prisma',
        'provider-generic-standalone-express-clerk-mysql-drizzle',
        'provider-white-label-convex-none',
        'provider-runtime-tenants-convex-better-auth',
        'provider-generic-standalone-convex-clerk',
      ].map((cellId) => ({ cellId, status: 'passed' as const })),
    },
    human: {
      sourceSha,
      cells: [
        'human-white-label-zero-service-bare-pnpm',
        'human-runtime-tenants-express-better-auth-postgresql-prisma-uniwind-npm',
        'human-generic-standalone-nestjs-clerk-mysql-drizzle-unistyles-bun',
        'human-white-label-convex-better-auth-bare-pnpm',
      ].map((cellId) => ({ cellId, status: 'passed' as const })),
    },
    publicCli: { sourceSha, status: 'passed', cases: 156 },
    releaseSet: {
      sourceSha,
      status: 'passed',
      packages: ['@tenkit/types', '@tenkit/template-generator', '@tenkit/cli', 'create-tenkit'],
    },
    templateContracts: { status: 'passed', missing: [], fog: [] },
    scope: { status: 'passed', configuratorPaths: [], fumadocsPaths: [] },
  };
}

describe('PR1 release readiness', () => {
  test('accepts the complete same-SHA evidence set', () => {
    const report = evaluatePr1ReleaseReadiness(passingInput());

    expect(report.finalReadiness).toBe('ready');
    expect(report.gates).toHaveLength(11);
    expect(report.gates.every(({ status }) => status === 'passed')).toBe(true);
    expect(report.counts).toEqual({
      supportedCombinations: 32,
      baselineCells: 96,
      expoConfigEvaluations: 160,
      stylingCells: 27,
      installedCells: 9,
      providerCells: 6,
      humanCells: 4,
      publicCliCases: 156,
      releasePackages: 4,
    });
  });

  test('blocks stale, incomplete, secret-bearing, and PR2 evidence', () => {
    const input = passingInput();
    input.provider.sourceSha = 'b'.repeat(40);
    input.human.cells[0] = { cellId: 'human-white-label-zero-service-bare-pnpm', status: 'failed' };
    input.releaseSet.packages = ['@tenkit/types', '@tenkit/cli'];
    input.templateContracts = { status: 'failed', missing: ['45'], fog: [] };
    input.scope = {
      status: 'failed',
      configuratorPaths: ['apps/web/configurator/backend.tsx'],
      fumadocsPaths: [],
    };
    input.provider.cells[0] = {
      cellId: 'provider-white-label-express-clerk-none',
      status: 'passed',
      note: 'Bearer secret-provider-token',
    };

    const report = evaluatePr1ReleaseReadiness(input);

    expect(report.finalReadiness).toBe('not-ready');
    expect(report.gates.filter(({ status }) => status === 'failed').map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        'provider',
        'human',
        'template-contracts',
        'release-set',
        'scope',
        'sanitation',
      ]),
    );
  });

  test('rejects a counted matrix with substituted cell identities', () => {
    const input = passingInput();
    input.baseline.cells[0] = { ...input.baseline.cells[0]!, cellId: 'baseline-substitute' };

    const report = evaluatePr1ReleaseReadiness(input);

    expect(report.gates.find(({ id }) => id === 'baseline')?.status).toBe('failed');
    expect(report.finalReadiness).toBe('not-ready');
  });
});
