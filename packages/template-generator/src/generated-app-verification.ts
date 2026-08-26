import { tmpdir } from 'node:os';

import fs from 'fs-extra';
import { basename, join } from 'pathe';
import {
  resolveGeneratedAppOptions,
  type RawGeneratedAppOptions,
} from '@tenkit/types/generated-app-option-definitions';
import type { GeneratedSetupType } from '@tenkit/types/setup-type-definitions';
import type { GeneratedStylingChoice } from '@tenkit/types/styling-definitions';

import {
  GENERATED_PROJECT_VERIFICATION_PHASES,
  GeneratedProjectVerificationError,
  resolveGeneratedProjectVerificationSelection,
  verifyGeneratedProject,
  type GeneratedProjectVerificationEvidence,
  type GeneratedProjectVerificationPhase,
  type GeneratedProjectVerificationPhaseEvidence,
  type GeneratedProjectVerificationProfile,
  type GeneratedProjectVerificationSelection,
} from './generated-project-verification';
import {
  createSkippedVerificationPhase,
  createVerificationPhaseEvidence,
  replaceVerificationPhase,
} from './generated-project-verification-evidence';
import { runGenerationProof } from './local-proof';
import type { GeneratedProjectPackageManager } from './generator';

export type VerifyGeneratedAppOptions = {
  setupType: GeneratedSetupType;
  appVariantAccents?: readonly (string | undefined)[];
  appVariantNames?: readonly (string | undefined)[];
  stylingChoice: GeneratedStylingChoice;
  packageManager?: GeneratedProjectPackageManager;
  generatedAppOptions?: RawGeneratedAppOptions;
  workspaceRoot: string;
  environment: Readonly<Record<string, string>>;
  profile: GeneratedProjectVerificationProfile;
  targetNamePrefix?: string;
  beforeSuccessfulTargetCleanup?: (evidence: GeneratedProjectVerificationEvidence) => Promise<void>;
};

export class GeneratedAppVerificationError extends Error {
  readonly retainedTargetName: string;
  readonly phase: GeneratedProjectVerificationPhase;
  readonly completedPhases: readonly GeneratedProjectVerificationPhaseEvidence[];

  constructor(
    retainedTargetName: string,
    phase: GeneratedProjectVerificationPhase,
    completedPhases: readonly GeneratedProjectVerificationPhaseEvidence[] = [],
  ) {
    super(
      `Generated project verification terminated unexpectedly. Failed target retained in the system temporary directory as ${retainedTargetName}.`,
    );
    this.name = 'GeneratedAppVerificationError';
    this.phase = phase;
    this.completedPhases = completedPhases;
    this.retainedTargetName = retainedTargetName;
  }
}

function stoppedVerificationEvidence({
  selection,
  environment,
  profile,
  generation,
  failedPhase,
  failure,
}: {
  selection: GeneratedProjectVerificationSelection;
  environment: Readonly<Record<string, string>>;
  profile: GeneratedProjectVerificationProfile;
  generation: GeneratedProjectVerificationPhaseEvidence;
  failedPhase: 'generation' | 'shape';
  failure: GeneratedProjectVerificationEvidence['failures'][number];
}): GeneratedProjectVerificationEvidence {
  return {
    status: 'failed',
    profile,
    selection: resolveGeneratedProjectVerificationSelection(selection),
    environmentKeys: Object.keys(environment).sort(),
    phases: GENERATED_PROJECT_VERIFICATION_PHASES.map((phase) => {
      if (phase === 'generation') {
        return generation;
      }
      if (phase === failedPhase) {
        return createVerificationPhaseEvidence(phase, 'failed', { durationMs: 0 });
      }
      if (phase === 'cleanup') {
        return createVerificationPhaseEvidence(phase, 'passed');
      }
      return createSkippedVerificationPhase(phase);
    }),
    failures: [failure],
  };
}

export async function verifyGeneratedApp({
  setupType,
  appVariantAccents,
  appVariantNames,
  stylingChoice,
  packageManager = 'pnpm',
  generatedAppOptions: rawGeneratedAppOptions,
  workspaceRoot,
  environment,
  profile,
  targetNamePrefix = `tenkit-generated-${setupType}-${stylingChoice}`,
  beforeSuccessfulTargetCleanup,
}: VerifyGeneratedAppOptions): Promise<GeneratedProjectVerificationEvidence> {
  const generatedAppOptionsResolution = resolveGeneratedAppOptions(rawGeneratedAppOptions ?? {});
  if (generatedAppOptionsResolution.status === 'invalid') {
    throw new Error('Generated app verification received unsupported Generated App Options.');
  }
  const generatedAppOptions = generatedAppOptionsResolution.selection;

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(targetNamePrefix)) {
    throw new Error('Generated verification target prefix must be a safe lowercase identity.');
  }
  const tempRoot = await fs.mkdtemp(join(tmpdir(), `${targetNamePrefix}-`));
  const targetName = basename(tempRoot);
  const targetDir = join(tempRoot, 'app');
  const selection = {
    setupType,
    stylingChoice,
    packageManager,
    generatedAppOptions,
    appVariantAccents,
    appVariantNames,
  } satisfies GeneratedProjectVerificationSelection;
  const generationStartedAt = performance.now();
  let evidence: GeneratedProjectVerificationEvidence | undefined;
  let generationDurationMs = 0;

  try {
    await runGenerationProof({
      setupType,
      appVariantAccents,
      appVariantNames,
      stylingChoice,
      packageManager,
      generatedAppOptions,
      targetDir,
      git: false,
      workspaceRoot,
    });
    generationDurationMs = Math.max(0, Math.round(performance.now() - generationStartedAt));
  } catch {
    evidence = stoppedVerificationEvidence({
      selection,
      environment,
      profile,
      generation: createVerificationPhaseEvidence('generation', 'failed', {
        durationMs: Math.max(0, Math.round(performance.now() - generationStartedAt)),
      }),
      failedPhase: 'generation',
      failure: {
        phase: 'generation',
        kind: 'generation-failed',
        message: 'Generated project creation failed before verification.',
      },
    });
  }

  if (evidence === undefined) {
    try {
      evidence = await verifyGeneratedProject({
        targetDir,
        selection,
        environment,
        profile,
      });
    } catch (error) {
      throw new GeneratedAppVerificationError(
        targetName,
        error instanceof GeneratedProjectVerificationError ? error.phase : 'shape',
        error instanceof GeneratedProjectVerificationError ? error.completedPhases : [],
      );
    }
    evidence = {
      ...evidence,
      targetName,
      phases: replaceVerificationPhase(
        evidence.phases,
        createVerificationPhaseEvidence('generation', 'passed', {
          durationMs: generationDurationMs,
        }),
      ),
    };
  }

  if (evidence.status === 'failed') {
    const cleanupFailed = evidence.phases.some(
      ({ phase, status }) => phase === 'cleanup' && status === 'failed',
    );
    return {
      ...evidence,
      targetName,
      retainedTargetName: basename(tempRoot),
      phases: cleanupFailed
        ? evidence.phases
        : replaceVerificationPhase(
            evidence.phases,
            createVerificationPhaseEvidence('cleanup', 'passed', {
              durationMs: 0,
              reason:
                'Process resources were cleaned; failed generated target retained for diagnosis.',
            }),
          ),
    };
  }

  try {
    await beforeSuccessfulTargetCleanup?.({ ...evidence, targetName });
  } catch {
    return {
      ...evidence,
      failures: [
        ...evidence.failures,
        {
          kind: 'cleanup-failed',
          message: 'Verified evidence could not be made durable before target cleanup.',
          phase: 'cleanup',
        },
      ],
      phases: replaceVerificationPhase(
        evidence.phases,
        createVerificationPhaseEvidence('cleanup', 'failed', {
          durationMs: 0,
          reason: 'The verified generated target was retained because evidence persistence failed.',
        }),
      ),
      retainedTargetName: targetName,
      status: 'failed',
      targetName,
    };
  }

  const cleanupStartedAt = performance.now();
  let cleanupEvidence: GeneratedProjectVerificationPhaseEvidence;

  try {
    await fs.remove(tempRoot);
    cleanupEvidence = createVerificationPhaseEvidence('cleanup', 'passed', {
      durationMs: Math.max(0, Math.round(performance.now() - cleanupStartedAt)),
    });
  } catch {
    cleanupEvidence = createVerificationPhaseEvidence('cleanup', 'failed', {
      durationMs: Math.max(0, Math.round(performance.now() - cleanupStartedAt)),
    });
    evidence = {
      ...evidence,
      status: 'failed',
      failures: [
        ...evidence.failures,
        {
          phase: 'cleanup',
          kind: 'cleanup-failed',
          message: 'Generated project filesystem cleanup failed.',
        },
      ],
    };
  }

  return {
    ...evidence,
    targetName,
    phases: replaceVerificationPhase(evidence.phases, cleanupEvidence),
  };
}
