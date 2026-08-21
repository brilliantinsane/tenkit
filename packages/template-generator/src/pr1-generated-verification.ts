import { createHash } from 'node:crypto';

import { generateProject } from './generator';
import type {
  GeneratedVerificationMatrixCell,
  GeneratedVerificationResourceFactory,
} from './generated-verification-matrix';
import type {
  Pr1GeneratedVerificationPlanCell,
  Pr1StylingShapeCell,
} from './pr1-generated-verification-plan';
import type { VirtualFileTree } from './virtual-file-tree';

const RESOURCE_ENVIRONMENT_KEYS = {
  'disposable-mysql-8-4': ['DATABASE_URL'],
  'disposable-postgresql': ['DATABASE_URL'],
  'local-node-port': ['CLIENT_ORIGIN', 'PORT'],
} as const satisfies Record<string, readonly string[]>;

export type Pr1StylingShapeCellReport = {
  cellId: string;
  fileCount?: number;
  generatedTreeDigest?: string;
  status: 'passed' | 'failed';
  failure?: 'generation-failed' | 'invalid-generated-tree';
};

export type Pr1StylingShapeReport = {
  schemaVersion: 1;
  sourceSha: string;
  finalReadiness: 'ready' | 'not-ready';
  cells: readonly Pr1StylingShapeCellReport[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: 0;
  };
};

export type CreatePr1GeneratedVerificationMatrixCellsOptions = {
  plans: readonly Pr1GeneratedVerificationPlanCell[];
  baseEnvironment: Readonly<Record<string, string>>;
  resolveResource: (
    plan: Pr1GeneratedVerificationPlanCell,
    resourceClass: string,
  ) => GeneratedVerificationResourceFactory;
};

function authEnvironmentKeys(plan: Pr1GeneratedVerificationPlanCell): readonly string[] {
  if (plan.selection.generatedAppOptions.auth === 'clerk') {
    return ['CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY', 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY'];
  }

  if (plan.selection.generatedAppOptions.auth === 'better-auth') {
    return ['BETTER_AUTH_SECRET', 'BETTER_AUTH_URL'];
  }

  return [];
}

function resourceEnvironmentKeys(resourceClass: string): readonly string[] {
  if (resourceClass in RESOURCE_ENVIRONMENT_KEYS) {
    return RESOURCE_ENVIRONMENT_KEYS[resourceClass as keyof typeof RESOURCE_ENVIRONMENT_KEYS];
  }

  throw new Error(`Unknown PR1 verification resource class: ${resourceClass}.`);
}

export function createPr1GeneratedVerificationMatrixCells({
  plans,
  baseEnvironment,
  resolveResource,
}: CreatePr1GeneratedVerificationMatrixCellsOptions): readonly GeneratedVerificationMatrixCell[] {
  return plans.map((plan) => {
    const environmentKeys = new Set(Object.keys(baseEnvironment));
    for (const resourceClass of plan.resourceClasses) {
      for (const environmentKey of resourceEnvironmentKeys(resourceClass)) {
        environmentKeys.add(environmentKey);
      }
    }
    for (const environmentKey of authEnvironmentKeys(plan)) {
      environmentKeys.add(environmentKey);
    }

    return {
      environment: {
        evidence: {
          environmentKeys: [...environmentKeys].sort(),
          profile: 'deterministic',
          resourceClasses: [...plan.resourceClasses],
          sourceName: 'pr1-deterministic',
        },
        values: { ...baseEnvironment },
      },
      id: plan.id,
      resources: plan.resourceClasses.map((resourceClass) => resolveResource(plan, resourceClass)),
      selection: plan.selection,
      verificationProfile: plan.verificationProfile,
    };
  });
}

function assertGeneratedTree(tree: VirtualFileTree): void {
  const paths = tree.map(({ path }) => path);
  const sortedPaths = [...paths].sort((left, right) => left.localeCompare(right));
  if (JSON.stringify(paths) !== JSON.stringify(sortedPaths)) {
    throw new Error('Generated tree paths are not sorted.');
  }
  if (new Set(paths).size !== paths.length) {
    throw new Error('Generated tree contains duplicate paths.');
  }
}

function generatedTreeDigest(tree: VirtualFileTree): string {
  const digest = createHash('sha256');
  for (const file of tree) {
    digest.update(file.path);
    digest.update('\0');
    digest.update(typeof file.contents === 'string' ? file.contents : file.contents);
    digest.update('\0');
  }
  return digest.digest('hex');
}

export async function runPr1StylingShapeVerification({
  cells,
  sourceSha,
}: {
  cells: readonly Pr1StylingShapeCell[];
  sourceSha: string;
}): Promise<Pr1StylingShapeReport> {
  if (!/^[0-9a-f]{40}$/.test(sourceSha)) {
    throw new Error('PR1 Styling verification source SHA must be a full lowercase Git SHA.');
  }

  const reports: Pr1StylingShapeCellReport[] = [];
  for (const cell of cells) {
    try {
      const tree = generateProject(cell.selection);
      assertGeneratedTree(tree);
      reports.push({
        cellId: cell.id,
        fileCount: tree.length,
        generatedTreeDigest: generatedTreeDigest(tree),
        status: 'passed',
      });
    } catch (error) {
      reports.push({
        cellId: cell.id,
        failure:
          error instanceof Error && error.message.includes('Generated tree')
            ? 'invalid-generated-tree'
            : 'generation-failed',
        status: 'failed',
      });
    }
  }

  const summary = {
    failed: reports.filter(({ status }) => status === 'failed').length,
    passed: reports.filter(({ status }) => status === 'passed').length,
    skipped: 0 as const,
    total: reports.length,
  };
  return {
    cells: reports,
    finalReadiness: summary.failed === 0 ? 'ready' : 'not-ready',
    schemaVersion: 1,
    sourceSha,
    summary,
  };
}
