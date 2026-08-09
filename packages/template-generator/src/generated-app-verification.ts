import { tmpdir } from 'node:os';

import fs from 'fs-extra';
import { basename, join } from 'pathe';
import type { GeneratedSetupType } from '@tenkit/types/setup-type-definitions';
import type { GeneratedStylingChoice } from '@tenkit/types/styling-definitions';

import {
  GENERATED_PROJECT_VERIFICATION_PHASES,
  resolveGeneratedProjectVerificationSelection,
  verifyGeneratedProject,
  type GeneratedProjectVerificationEvidence,
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

export type VerifyGeneratedAppOptions = {
  setupType: GeneratedSetupType;
  appVariantAccents?: readonly (string | undefined)[];
  appVariantNames?: readonly (string | undefined)[];
  stylingChoice: GeneratedStylingChoice;
  workspaceRoot: string;
  environment: Readonly<Record<string, string>>;
  profile: GeneratedProjectVerificationProfile;
};

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
  workspaceRoot,
  environment,
  profile,
}: VerifyGeneratedAppOptions): Promise<GeneratedProjectVerificationEvidence> {
  const tempRoot = await fs.mkdtemp(
    join(tmpdir(), `tenkit-generated-${setupType}-${stylingChoice}-`),
  );
  const targetDir = join(tempRoot, 'app');
  const selection = {
    setupType,
    stylingChoice,
    packageManager: 'pnpm',
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
    } catch {
      throw new Error(
        `Generated project verification terminated unexpectedly. Failed target retained in the system temporary directory as ${basename(tempRoot)}.`,
      );
    }
    evidence = {
      ...evidence,
      phases: replaceVerificationPhase(
        evidence.phases,
        createVerificationPhaseEvidence('generation', 'passed', {
          durationMs: generationDurationMs,
        }),
      ),
    };
  }

  if (evidence.status === 'failed') {
    return {
      ...evidence,
      retainedTargetName: basename(tempRoot),
      phases: replaceVerificationPhase(
        evidence.phases,
        createVerificationPhaseEvidence('cleanup', 'passed', {
          durationMs: 0,
          reason: 'Process resources were cleaned; failed generated target retained for diagnosis.',
        }),
      ),
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
    phases: replaceVerificationPhase(evidence.phases, cleanupEvidence),
  };
}
