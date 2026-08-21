import {
  isGeneratedNodeBackend,
  SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS,
  type GeneratedAppOptions,
} from '@tenkit/types/generated-app-option-definitions';
import {
  getGeneratedSetupTypeDefinition,
  SUPPORTED_GENERATED_SETUP_TYPE_IDS,
  type GeneratedSetupType,
} from '@tenkit/types/setup-type-definitions';
import {
  SUPPORTED_GENERATED_STYLING_CHOICES,
  type GeneratedStylingChoice,
} from '@tenkit/types/styling-definitions';

import type { GeneratedProjectPackageManager } from './generator';
import type {
  GeneratedProjectVerificationProfile,
  GeneratedProjectVerificationSelection,
} from './generated-project-verification';

export type Pr1GeneratedVerificationPlanCell = {
  id: string;
  selection: GeneratedProjectVerificationSelection & {
    generatedAppOptions: GeneratedAppOptions;
  };
  verificationProfile: GeneratedProjectVerificationProfile;
  resourceClasses: readonly string[];
};

export type Pr1StylingShapeCell = {
  id: string;
  selection: {
    setupType: GeneratedSetupType;
    stylingChoice: GeneratedStylingChoice;
    packageManager: 'pnpm';
    generatedAppOptions: GeneratedAppOptions;
  };
};

const STYLING_AUTH_SHAPES = [
  {
    backend: 'none',
    auth: 'none',
    database: 'none',
    orm: 'none',
  },
  {
    backend: 'express',
    auth: 'better-auth',
    database: 'postgresql',
    orm: 'prisma',
  },
  {
    backend: 'convex',
    auth: 'clerk',
    database: 'none',
    orm: 'none',
  },
] as const satisfies readonly GeneratedAppOptions[];

function verificationProfile(
  generatedAppOptions: GeneratedAppOptions,
): GeneratedProjectVerificationProfile {
  if (generatedAppOptions.backend === 'convex') {
    return 'convex';
  }

  return isGeneratedNodeBackend(generatedAppOptions.backend) ? 'node-server' : 'deterministic';
}

function resourceClasses(generatedAppOptions: GeneratedAppOptions): readonly string[] {
  return [
    ...(isGeneratedNodeBackend(generatedAppOptions.backend) ? ['local-node-port'] : []),
    ...(generatedAppOptions.database === 'postgresql' ? ['disposable-postgresql'] : []),
    ...(generatedAppOptions.database === 'mysql' ? ['disposable-mysql-8-4'] : []),
  ];
}

function cellId(
  prefix: string,
  setupType: GeneratedSetupType,
  stylingChoice: GeneratedStylingChoice,
  packageManager: GeneratedProjectPackageManager,
  generatedAppOptions: GeneratedAppOptions,
): string {
  const publicSetupSlug = getGeneratedSetupTypeDefinition(setupType).publicSlug;
  const { backend, auth, database, orm } = generatedAppOptions;
  return `${prefix}-${publicSetupSlug}-${stylingChoice}-${packageManager}-${backend}-${auth}-${database}-${orm}`;
}

function planCell(
  prefix: string,
  setupType: GeneratedSetupType,
  stylingChoice: GeneratedStylingChoice,
  packageManager: GeneratedProjectPackageManager,
  generatedAppOptions: GeneratedAppOptions,
): Pr1GeneratedVerificationPlanCell {
  return {
    id: cellId(prefix, setupType, stylingChoice, packageManager, generatedAppOptions),
    resourceClasses: resourceClasses(generatedAppOptions),
    selection: {
      generatedAppOptions,
      packageManager,
      setupType,
      stylingChoice,
    },
    verificationProfile: verificationProfile(generatedAppOptions),
  };
}

export function createPr1BaselineCells(): readonly Pr1GeneratedVerificationPlanCell[] {
  return SUPPORTED_GENERATED_SETUP_TYPE_IDS.flatMap((setupType) =>
    SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS.map((generatedAppOptions) =>
      planCell('baseline', setupType, 'bare', 'pnpm', generatedAppOptions),
    ),
  );
}

export function createPr1StylingShapeCells(): readonly Pr1StylingShapeCell[] {
  return SUPPORTED_GENERATED_SETUP_TYPE_IDS.flatMap((setupType) =>
    SUPPORTED_GENERATED_STYLING_CHOICES.flatMap((stylingChoice) =>
      STYLING_AUTH_SHAPES.map((generatedAppOptions) => ({
        id: cellId('styling', setupType, stylingChoice, 'pnpm', generatedAppOptions),
        selection: {
          generatedAppOptions,
          packageManager: 'pnpm',
          setupType,
          stylingChoice,
        },
      })),
    ),
  );
}

export function createPr1InstalledRepresentativeCells(): readonly Pr1GeneratedVerificationPlanCell[] {
  const representatives = [
    ['white-label-apps', 'bare', 'pnpm', STYLING_AUTH_SHAPES[0]],
    ['white-label-apps', 'uniwind', 'npm', STYLING_AUTH_SHAPES[1]],
    ['white-label-apps', 'unistyles', 'bun', STYLING_AUTH_SHAPES[2]],
    [
      'single-app-runtime-tenants',
      'bare',
      'npm',
      {
        backend: 'convex',
        auth: 'better-auth',
        database: 'none',
        orm: 'none',
      },
    ],
    ['single-app-runtime-tenants', 'uniwind', 'bun', STYLING_AUTH_SHAPES[0]],
    [
      'single-app-runtime-tenants',
      'unistyles',
      'pnpm',
      {
        backend: 'nestjs',
        auth: 'clerk',
        database: 'mysql',
        orm: 'drizzle',
      },
    ],
    [
      'generic-with-standalone-app-variants',
      'bare',
      'bun',
      {
        backend: 'express',
        auth: 'none',
        database: 'mysql',
        orm: 'prisma',
      },
    ],
    [
      'generic-with-standalone-app-variants',
      'uniwind',
      'pnpm',
      {
        backend: 'convex',
        auth: 'none',
        database: 'none',
        orm: 'none',
      },
    ],
    ['generic-with-standalone-app-variants', 'unistyles', 'npm', STYLING_AUTH_SHAPES[0]],
  ] as const satisfies readonly [
    GeneratedSetupType,
    GeneratedStylingChoice,
    GeneratedProjectPackageManager,
    GeneratedAppOptions,
  ][];

  return representatives.map(([setupType, stylingChoice, packageManager, generatedAppOptions]) =>
    planCell('installed', setupType, stylingChoice, packageManager, generatedAppOptions),
  );
}

export function countPr1ExpoConfigEvaluations(
  cells: readonly Pr1GeneratedVerificationPlanCell[],
): number {
  return cells.reduce(
    (count, { selection }) =>
      count + getGeneratedSetupTypeDefinition(selection.setupType).appVariants.length,
    0,
  );
}
