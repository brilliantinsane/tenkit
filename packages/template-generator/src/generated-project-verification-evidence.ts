import type { GeneratedSetupType } from '@tenkit/types/setup-type-definitions';
import type { GeneratedStylingChoice } from '@tenkit/types/styling-definitions';
import type { GeneratedAppOptions } from '@tenkit/types/generated-app-option-definitions';

import type { GeneratedAppCommandResult } from './generated-app-command-runner';
import type {
  GeneratedAppProcessShutdownEvidence,
  GeneratedAppProcessStartEvidence,
} from './generated-app-process-runner';
import type { GeneratedProjectPackageManager } from './generator';

export const GENERATED_PROJECT_VERIFICATION_PHASES = [
  'generation',
  'shape',
  'install',
  'typecheck',
  'test',
  'expo-config',
  'build',
  'start',
  'runtime',
  'shutdown',
  'cleanup',
] as const;

export type GeneratedProjectVerificationPhase =
  (typeof GENERATED_PROJECT_VERIFICATION_PHASES)[number];
export type GeneratedProjectVerificationProfile = 'deterministic' | 'node-server' | 'convex';
export type GeneratedProjectVerificationStatus = 'passed' | 'failed' | 'skipped' | 'not-applicable';

export type GeneratedProjectVerificationPhaseEvidence = {
  phase: GeneratedProjectVerificationPhase;
  status: GeneratedProjectVerificationStatus;
  durationMs: number;
  commands?: readonly GeneratedAppCommandResult[];
  processStart?: GeneratedAppProcessStartEvidence;
  processShutdown?: GeneratedAppProcessShutdownEvidence;
  reason?: string;
};

export type GeneratedProjectVerificationFailure = {
  phase: GeneratedProjectVerificationPhase;
  kind:
    | 'generation-failed'
    | 'verification-failed'
    | 'invalid-shape'
    | 'command-failed'
    | 'process-failed'
    | 'timeout'
    | 'cleanup-failed';
  message: string;
};

export type GeneratedProjectVerificationEvidence = {
  status: 'passed' | 'failed';
  profile: GeneratedProjectVerificationProfile;
  selection: {
    setupType: GeneratedSetupType;
    generatedAppOptions: GeneratedAppOptions;
    stylingChoice: GeneratedStylingChoice;
    packageManager: GeneratedProjectPackageManager;
    appVariantSlugs: readonly string[];
  };
  environmentKeys: readonly string[];
  phases: readonly GeneratedProjectVerificationPhaseEvidence[];
  failures: readonly GeneratedProjectVerificationFailure[];
  targetName?: string;
  retainedTargetName?: string;
};

export function createVerificationPhaseEvidence(
  phase: GeneratedProjectVerificationPhase,
  status: GeneratedProjectVerificationStatus,
  options: Omit<GeneratedProjectVerificationPhaseEvidence, 'phase' | 'status'> = {
    durationMs: 0,
  },
): GeneratedProjectVerificationPhaseEvidence {
  return { phase, status, ...options };
}

export function createSkippedVerificationPhase(
  phase: GeneratedProjectVerificationPhase,
): GeneratedProjectVerificationPhaseEvidence {
  return createVerificationPhaseEvidence(phase, 'skipped', {
    durationMs: 0,
    reason: 'Skipped after the first failed verification phase.',
  });
}

export function replaceVerificationPhase(
  phases: readonly GeneratedProjectVerificationPhaseEvidence[],
  replacement: GeneratedProjectVerificationPhaseEvidence,
): readonly GeneratedProjectVerificationPhaseEvidence[] {
  return phases.map((phase) => (phase.phase === replacement.phase ? replacement : phase));
}
