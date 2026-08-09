import fs from 'fs-extra';
import { join, relative } from 'pathe';
import {
  resolveGeneratedAppOptions,
  type RawGeneratedAppOptions,
} from '@tenkit/types/generated-app-option-definitions';
import {
  deriveAppVariantIdentities,
  getGeneratedSetupTypeDefinition,
  type GeneratedSetupType,
} from '@tenkit/types/setup-type-definitions';
import type { GeneratedStylingChoice } from '@tenkit/types/styling-definitions';

import {
  runGeneratedAppCommand,
  type GeneratedAppCommandResult,
} from './generated-app-command-runner';
import { startGeneratedAppProcess, type GeneratedAppProcess } from './generated-app-process-runner';
import {
  createSkippedVerificationPhase,
  createVerificationPhaseEvidence,
  GENERATED_PROJECT_VERIFICATION_PHASES,
  type GeneratedProjectVerificationEvidence,
  type GeneratedProjectVerificationFailure,
  type GeneratedProjectVerificationPhase,
  type GeneratedProjectVerificationPhaseEvidence,
  type GeneratedProjectVerificationProfile,
  type GeneratedProjectVerificationStatus,
} from './generated-project-verification-evidence';
import { generateProject, type GeneratedProjectPackageManager } from './generator';
import type { VirtualFileTree } from './virtual-file-tree';

export {
  GENERATED_PROJECT_VERIFICATION_PHASES,
  type GeneratedProjectVerificationEvidence,
  type GeneratedProjectVerificationFailure,
  type GeneratedProjectVerificationPhase,
  type GeneratedProjectVerificationPhaseEvidence,
  type GeneratedProjectVerificationProfile,
  type GeneratedProjectVerificationStatus,
} from './generated-project-verification-evidence';

const VERIFICATION_PHASE_TIMEOUT_MS = {
  build: 5 * 60 * 1000,
  'expo-config': 2 * 60 * 1000,
  install: 15 * 60 * 1000,
  runtime: 5 * 60 * 1000,
  typecheck: 5 * 60 * 1000,
} as const;

const PROCESS_READINESS_TIMEOUT_MS = 2 * 60 * 1000;
const PROCESS_SHUTDOWN_TIMEOUT_MS = 15 * 1000;
const NODE_SERVER_LIFECYCLE_SCRIPTS = {
  build: 'tsc -b',
  'server:start:prod': 'node dist/server.js',
  'test:integration': 'vitest run',
} as const;

export type GeneratedProjectVerificationSelection = {
  setupType: GeneratedSetupType;
  stylingChoice: GeneratedStylingChoice;
  packageManager: GeneratedProjectPackageManager;
  generatedAppOptions?: RawGeneratedAppOptions;
  appVariantAccents?: readonly (string | undefined)[];
  appVariantNames?: readonly (string | undefined)[];
  projectName?: string;
  packageName?: string;
};

export type VerifyGeneratedProjectOptions = {
  targetDir: string;
  selection: GeneratedProjectVerificationSelection;
  environment: Readonly<Record<string, string>>;
  profile: GeneratedProjectVerificationProfile;
};

export class GeneratedProjectVerificationError extends Error {
  readonly phase: GeneratedProjectVerificationPhase;
  readonly completedPhases: readonly GeneratedProjectVerificationPhaseEvidence[];

  constructor(
    phase: GeneratedProjectVerificationPhase,
    completedPhases: readonly GeneratedProjectVerificationPhaseEvidence[] = [],
  ) {
    super(`Generated project verification terminated unexpectedly during ${phase}.`);
    this.name = 'GeneratedProjectVerificationError';
    this.phase = phase;
    this.completedPhases = completedPhases;
  }
}

type PackageManifest = {
  scripts: Record<string, string>;
};

export function resolveGeneratedProjectVerificationSelection(
  selection: GeneratedProjectVerificationSelection,
): GeneratedProjectVerificationEvidence['selection'] {
  const generatedAppOptionsResolution = resolveGeneratedAppOptions(
    selection.generatedAppOptions ?? {},
  );
  if (generatedAppOptionsResolution.status === 'invalid') {
    throw new Error('Generated project verification received unsupported Generated App Options.');
  }
  const setupTypeDefinition = getGeneratedSetupTypeDefinition(selection.setupType);
  const resolvedNames = setupTypeDefinition.appVariants.map(
    ({ defaultName }, index) => selection.appVariantNames?.[index] ?? defaultName,
  );

  return {
    setupType: selection.setupType,
    generatedAppOptions: generatedAppOptionsResolution.selection,
    stylingChoice: selection.stylingChoice,
    packageManager: selection.packageManager,
    appVariantSlugs: deriveAppVariantIdentities(resolvedNames).map(({ slug }) => slug),
  };
}

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readPackageManifest(value: unknown): PackageManifest {
  if (!isUnknownRecord(value) || !isUnknownRecord(value.scripts)) {
    throw new Error('The generated project package manifest must define scripts.');
  }

  const scripts: Record<string, string> = {};
  for (const [name, script] of Object.entries(value.scripts)) {
    if (typeof script !== 'string') {
      throw new Error('The generated project package manifest scripts must be strings.');
    }
    scripts[name] = script;
  }

  return { scripts };
}

async function listWrittenFiles(targetDir: string, directory = targetDir): Promise<string[]> {
  const paths: string[] = [];

  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name);
    if (entry.isSymbolicLink() || (!entry.isDirectory() && !entry.isFile())) {
      throw new Error('The generated project contains an unsupported filesystem entry.');
    }

    if (entry.isDirectory()) {
      paths.push(...(await listWrittenFiles(targetDir, absolutePath)));
    } else {
      paths.push(relative(targetDir, absolutePath));
    }
  }

  return paths.sort();
}

function expectedWrittenTree(
  selection: GeneratedProjectVerificationSelection,
  profile: GeneratedProjectVerificationProfile,
): VirtualFileTree {
  const generatedTree = generateProject({
    setupType: selection.setupType,
    appVariantAccents: selection.appVariantAccents,
    appVariantNames: selection.appVariantNames,
    projectName: selection.projectName,
    packageName: selection.packageName,
    packageManager: selection.packageManager,
    stylingChoice: selection.stylingChoice,
    generatedAppOptions: selection.generatedAppOptions,
  });
  if (profile === 'deterministic') {
    return generatedTree;
  }

  return generatedTree.map((file) => {
    if (file.path !== 'package.json' || typeof file.contents !== 'string') {
      return file;
    }
    const packageJson: unknown = JSON.parse(file.contents);
    if (!isUnknownRecord(packageJson)) {
      throw new Error('The selected generated project package manifest is invalid.');
    }
    const manifest = readPackageManifest(packageJson);
    return {
      ...file,
      contents: `${JSON.stringify(
        {
          ...packageJson,
          scripts: { ...manifest.scripts, ...NODE_SERVER_LIFECYCLE_SCRIPTS },
        },
        null,
        2,
      )}\n`,
    };
  });
}

async function assertSelectedGeneratedShape(
  targetDir: string,
  selection: GeneratedProjectVerificationSelection,
  profile: GeneratedProjectVerificationProfile,
): Promise<PackageManifest> {
  const expectedTree = expectedWrittenTree(selection, profile);
  const expectedPaths = expectedTree.map(({ path }) => path).sort();
  const writtenPaths = await listWrittenFiles(targetDir);

  if (JSON.stringify(writtenPaths) !== JSON.stringify(expectedPaths)) {
    throw new Error('The written generated project paths do not match the selected Template.');
  }

  for (const expectedFile of expectedTree) {
    const writtenContents = await fs.readFile(join(targetDir, expectedFile.path));
    const expectedContents =
      typeof expectedFile.contents === 'string'
        ? Buffer.from(expectedFile.contents)
        : Buffer.from(expectedFile.contents);
    if (!writtenContents.equals(expectedContents)) {
      throw new Error('The written generated project contents do not match the selected Template.');
    }
  }

  return readPackageManifest(await fs.readJson(join(targetDir, 'package.json')));
}

async function inspectWrittenGeneratedProject(
  targetDir: string,
  selection: GeneratedProjectVerificationSelection,
  profile: GeneratedProjectVerificationProfile,
): Promise<PackageManifest> {
  const targetStats = await fs.stat(targetDir);
  if (!targetStats.isDirectory()) {
    throw new Error('The generated project target is not a directory.');
  }

  const manifest = await assertSelectedGeneratedShape(targetDir, selection, profile);

  if (manifest.scripts.typecheck !== 'tsc --noEmit --pretty false') {
    throw new Error('The generated project package manifest has no canonical typecheck command.');
  }
  if (manifest.scripts['expo:config'] !== 'expo config --type public') {
    throw new Error('The generated project package manifest has no canonical Expo config command.');
  }
  if (
    profile === 'node-server' &&
    (manifest.scripts.build !== NODE_SERVER_LIFECYCLE_SCRIPTS.build ||
      manifest.scripts['server:start:prod'] !==
        NODE_SERVER_LIFECYCLE_SCRIPTS['server:start:prod'] ||
      manifest.scripts['test:integration'] !== NODE_SERVER_LIFECYCLE_SCRIPTS['test:integration'])
  ) {
    throw new Error('The generated Node project has an incomplete lifecycle manifest.');
  }

  return manifest;
}

function commandFailure(
  phase: GeneratedProjectVerificationPhase,
  command: GeneratedAppCommandResult,
): GeneratedProjectVerificationFailure {
  return {
    phase,
    kind: command.status === 'timed-out' ? 'timeout' : 'command-failed',
    message:
      command.status === 'timed-out'
        ? `The ${phase} command exceeded its bounded timeout.`
        : `The ${phase} command exited unsuccessfully.`,
  };
}

export async function verifyGeneratedProject({
  targetDir,
  selection,
  environment,
  profile,
}: VerifyGeneratedProjectOptions): Promise<GeneratedProjectVerificationEvidence> {
  const resolvedSelection = resolveGeneratedProjectVerificationSelection(selection);
  const phases: GeneratedProjectVerificationPhaseEvidence[] = [
    createVerificationPhaseEvidence('generation', 'not-applicable', {
      durationMs: 0,
      reason: 'Generation is complete before the written-project verification seam.',
    }),
  ];
  const failures: GeneratedProjectVerificationFailure[] = [];
  let stopped = false;
  let generatedProcess: GeneratedAppProcess | undefined;
  let leakedProcessResource = false;
  let processCleanupProven = true;

  const recordCommandPhase = async (
    phase: 'install' | 'typecheck' | 'build' | 'runtime',
    args: string[],
  ): Promise<void> => {
    if (stopped) {
      phases.push(createSkippedVerificationPhase(phase));
      return;
    }

    let command: GeneratedAppCommandResult;
    try {
      command = await runGeneratedAppCommand(targetDir, selection.packageManager, args, {
        env: environment,
        timeoutMs: VERIFICATION_PHASE_TIMEOUT_MS[phase],
      });
    } catch {
      throw new GeneratedProjectVerificationError(phase, phases);
    }
    phases.push(
      createVerificationPhaseEvidence(phase, command.status === 'passed' ? 'passed' : 'failed', {
        commands: [command],
        durationMs: command.durationMs,
      }),
    );
    if (command.status !== 'passed') {
      stopped = true;
      failures.push(commandFailure(phase, command));
    }
  };

  const shapeStartedAt = performance.now();
  try {
    await inspectWrittenGeneratedProject(targetDir, selection, profile);
    phases.push(
      createVerificationPhaseEvidence('shape', 'passed', {
        durationMs: Math.max(0, Math.round(performance.now() - shapeStartedAt)),
      }),
    );
  } catch {
    stopped = true;
    phases.push(
      createVerificationPhaseEvidence('shape', 'failed', {
        durationMs: Math.max(0, Math.round(performance.now() - shapeStartedAt)),
      }),
    );
    failures.push({
      phase: 'shape',
      kind: 'invalid-shape',
      message: 'The written generated project does not satisfy the verification shape contract.',
    });
  }

  await recordCommandPhase('install', ['install']);
  await recordCommandPhase('typecheck', ['run', 'typecheck']);

  if (stopped) {
    phases.push(createSkippedVerificationPhase('expo-config'));
  } else {
    const commands: GeneratedAppCommandResult[] = [];
    for (const appVariantSlug of resolvedSelection.appVariantSlugs) {
      let command: GeneratedAppCommandResult;
      try {
        command = await runGeneratedAppCommand(
          targetDir,
          selection.packageManager,
          ['run', 'expo:config'],
          {
            env: { ...environment, APP_VARIANT_SLUG: appVariantSlug },
            timeoutMs: VERIFICATION_PHASE_TIMEOUT_MS['expo-config'],
          },
        );
      } catch {
        throw new GeneratedProjectVerificationError('expo-config', phases);
      }
      commands.push(command);
      if (command.status !== 'passed') {
        stopped = true;
        failures.push(commandFailure('expo-config', command));
        break;
      }
    }
    phases.push(
      createVerificationPhaseEvidence('expo-config', stopped ? 'failed' : 'passed', {
        commands,
        durationMs: commands.reduce((duration, command) => duration + command.durationMs, 0),
      }),
    );
  }

  if (profile === 'node-server') {
    await recordCommandPhase('build', ['run', 'build']);
  } else {
    phases.push(
      stopped
        ? createSkippedVerificationPhase('build')
        : createVerificationPhaseEvidence('build', 'not-applicable', {
            durationMs: 0,
            reason: 'The deterministic Expo profile has no workspace build phase.',
          }),
    );
  }

  try {
    if (profile !== 'node-server') {
      phases.push(
        stopped
          ? createSkippedVerificationPhase('start')
          : createVerificationPhaseEvidence('start', 'not-applicable', {
              durationMs: 0,
              reason: 'The deterministic Expo profile has no server process.',
            }),
      );
    } else if (stopped) {
      phases.push(createSkippedVerificationPhase('start'));
    } else {
      const port = environment.PORT;
      if (!port || !/^\d+$/.test(port)) {
        stopped = true;
        phases.push(createVerificationPhaseEvidence('start', 'failed', { durationMs: 0 }));
        failures.push({
          phase: 'start',
          kind: 'process-failed',
          message: 'The Node server verification profile requires a numeric PORT.',
        });
      } else {
        try {
          generatedProcess = await startGeneratedAppProcess(
            targetDir,
            selection.packageManager,
            ['run', 'server:start:prod'],
            {
              env: environment,
              readinessUrl: `http://127.0.0.1:${port}/health`,
              readinessTimeoutMs: PROCESS_READINESS_TIMEOUT_MS,
              shutdownTimeoutMs: PROCESS_SHUTDOWN_TIMEOUT_MS,
            },
          );
        } catch {
          throw new GeneratedProjectVerificationError('start', phases);
        }
        const processStart = generatedProcess.startEvidence;
        phases.push(
          createVerificationPhaseEvidence(
            'start',
            processStart.status === 'passed' ? 'passed' : 'failed',
            { durationMs: processStart.durationMs, processStart },
          ),
        );
        if (processStart.status !== 'passed') {
          stopped = true;
          failures.push({
            phase: 'start',
            kind: processStart.status === 'timed-out' ? 'timeout' : 'process-failed',
            message:
              processStart.status === 'timed-out'
                ? 'The generated server did not become ready before its bounded timeout.'
                : 'The generated server exited before readiness.',
          });
        }
      }
    }

    if (profile === 'node-server') {
      await recordCommandPhase('runtime', ['run', 'test:integration']);
    } else {
      phases.push(
        stopped
          ? createSkippedVerificationPhase('runtime')
          : createVerificationPhaseEvidence('runtime', 'not-applicable', {
              durationMs: 0,
              reason: 'The deterministic Expo profile has no runtime integration command.',
            }),
      );
    }
  } finally {
    if (generatedProcess === undefined) {
      phases.push(
        stopped
          ? createSkippedVerificationPhase('shutdown')
          : createVerificationPhaseEvidence('shutdown', 'not-applicable', {
              durationMs: 0,
              reason: 'The selected verification profile started no process.',
            }),
      );
    } else {
      try {
        const processShutdown = await generatedProcess.shutdown();
        phases.push(
          createVerificationPhaseEvidence(
            'shutdown',
            processShutdown.status === 'passed' ? 'passed' : 'failed',
            { durationMs: processShutdown.durationMs, processShutdown },
          ),
        );
        if (processShutdown.status !== 'passed') {
          leakedProcessResource = processShutdown.leaked;
          failures.push({
            phase: 'shutdown',
            kind: 'cleanup-failed',
            message: processShutdown.leaked
              ? 'The generated server process tree leaked after forced shutdown.'
              : 'The generated server required forced shutdown.',
          });
        }
      } catch {
        processCleanupProven = false;
        phases.push(createVerificationPhaseEvidence('shutdown', 'failed'));
        failures.push({
          phase: 'shutdown',
          kind: 'cleanup-failed',
          message: 'The generated server shutdown boundary failed unexpectedly.',
        });
      }
    }
  }

  const cleanupFailed = leakedProcessResource || !processCleanupProven;
  phases.push(
    createVerificationPhaseEvidence('cleanup', cleanupFailed ? 'failed' : 'passed', {
      durationMs: 0,
      reason: leakedProcessResource
        ? 'The generated server process tree remained active after forced shutdown.'
        : !processCleanupProven
          ? 'The generated server process cleanup boundary failed before cleanup could be proven.'
          : 'The verifier retained no running process or process resource.',
    }),
  );

  return {
    status: failures.length === 0 ? 'passed' : 'failed',
    profile,
    selection: resolvedSelection,
    environmentKeys: Object.keys(environment).sort(),
    phases,
    failures,
  };
}
