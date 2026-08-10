import fs from 'fs-extra';
import { join, relative } from 'pathe';
import {
  isGeneratedNodeBackend,
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
  test: 5 * 60 * 1000,
  typecheck: 5 * 60 * 1000,
} as const;

const FORBIDDEN_SQL_RUNTIME_MODULES = [
  '@prisma/client',
  '@tenkit/db',
  'drizzle-orm',
  'mysql2',
  'pg',
] as const;

const PROCESS_READINESS_TIMEOUT_MS = 2 * 60 * 1000;
const PROCESS_SHUTDOWN_TIMEOUT_MS = 15 * 1000;
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

function expectedWrittenTree(selection: GeneratedProjectVerificationSelection): VirtualFileTree {
  return generateProject({
    setupType: selection.setupType,
    appVariantAccents: selection.appVariantAccents,
    appVariantNames: selection.appVariantNames,
    projectName: selection.projectName,
    packageName: selection.packageName,
    packageManager: selection.packageManager,
    stylingChoice: selection.stylingChoice,
    generatedAppOptions: selection.generatedAppOptions,
  });
}

function expectedServerWorkspaceScripts(
  packageManager: GeneratedProjectPackageManager,
): Readonly<
  Record<'build' | 'server:start:prod' | 'test' | 'test:integration' | 'typecheck', string>
> {
  const serverRunCommand =
    packageManager === 'pnpm'
      ? 'pnpm --dir apps/server run'
      : packageManager === 'npm'
        ? 'npm --prefix apps/server run'
        : 'bun --cwd apps/server run';

  return {
    build: `${serverRunCommand} build`,
    'server:start:prod': `${serverRunCommand} start:prod`,
    test: `${serverRunCommand} test`,
    'test:integration': `${serverRunCommand} test:integration`,
    typecheck: `${serverRunCommand} typecheck`,
  };
}

async function assertSelectedGeneratedShape(
  targetDir: string,
  selection: GeneratedProjectVerificationSelection,
): Promise<PackageManifest> {
  const expectedTree = expectedWrittenTree(selection);
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

  const manifest = await assertSelectedGeneratedShape(targetDir, selection);
  const resolvedSelection = resolveGeneratedProjectVerificationSelection(selection);

  if (
    profile === 'node-server' &&
    !isGeneratedNodeBackend(resolvedSelection.generatedAppOptions.backend)
  ) {
    throw new Error('The Node server verification profile requires Express or NestJS.');
  }
  if (profile === 'convex' && resolvedSelection.generatedAppOptions.backend !== 'convex') {
    throw new Error('The Convex verification profile requires the Convex Backend.');
  }

  const expectedTypecheck =
    resolvedSelection.generatedAppOptions.backend !== 'none'
      ? `tsc --noEmit --pretty false && ${expectedServerWorkspaceScripts(selection.packageManager).typecheck}`
      : 'tsc --noEmit --pretty false';
  if (manifest.scripts.typecheck !== expectedTypecheck) {
    throw new Error('The generated project package manifest has no canonical typecheck command.');
  }
  if (manifest.scripts['expo:config'] !== 'expo config --type public') {
    throw new Error('The generated project package manifest has no canonical Expo config command.');
  }
  if (profile === 'node-server') {
    const expectedScripts = expectedServerWorkspaceScripts(selection.packageManager);
    if (
      manifest.scripts.build !== expectedScripts.build ||
      manifest.scripts['server:start:prod'] !== expectedScripts['server:start:prod'] ||
      manifest.scripts.test !== expectedScripts.test ||
      manifest.scripts['test:integration'] !== expectedScripts['test:integration']
    ) {
      throw new Error('The generated Node project has an incomplete lifecycle manifest.');
    }
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

function databaseNoneModuleResolutionGuardScript(): string {
  return `const forbiddenModules = ${JSON.stringify(FORBIDDEN_SQL_RUNTIME_MODULES)};
for (const moduleName of forbiddenModules) {
  try {
    await import(moduleName);
    process.stderr.write('Database none resolved a forbidden SQL or ORM runtime module.');
    process.exitCode = 1;
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ERR_MODULE_NOT_FOUND') {
      throw error;
    }
  }
}`;
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
    phase: 'install' | 'typecheck' | 'test' | 'build' | 'runtime',
    commandPlans: readonly { command: string; args: string[] }[],
  ): Promise<void> => {
    if (stopped) {
      phases.push(createSkippedVerificationPhase(phase));
      return;
    }

    const commands: GeneratedAppCommandResult[] = [];
    let phaseFailed = false;
    for (const { command: commandName, args } of commandPlans) {
      let command: GeneratedAppCommandResult;
      try {
        command = await runGeneratedAppCommand(targetDir, commandName, args, {
          env: environment,
          timeoutMs: VERIFICATION_PHASE_TIMEOUT_MS[phase],
        });
      } catch {
        throw new GeneratedProjectVerificationError(phase, phases);
      }
      commands.push(command);
      if (command.status !== 'passed') {
        stopped = true;
        phaseFailed = true;
        failures.push(commandFailure(phase, command));
        break;
      }
    }
    phases.push(
      createVerificationPhaseEvidence(phase, phaseFailed ? 'failed' : 'passed', {
        commands,
        durationMs: commands.reduce((duration, command) => duration + command.durationMs, 0),
      }),
    );
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

  await recordCommandPhase('install', [{ command: selection.packageManager, args: ['install'] }]);
  await recordCommandPhase('typecheck', [
    { command: selection.packageManager, args: ['run', 'typecheck'] },
  ]);

  if (profile === 'node-server' || profile === 'convex') {
    await recordCommandPhase('test', [
      { command: selection.packageManager, args: ['run', 'test'] },
    ]);
  } else {
    phases.push(
      stopped
        ? createSkippedVerificationPhase('test')
        : createVerificationPhaseEvidence('test', 'not-applicable', {
            durationMs: 0,
            reason: 'The deterministic Expo profile has no root test command.',
          }),
    );
  }

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
    await recordCommandPhase('build', [
      { command: selection.packageManager, args: ['run', 'build'] },
      ...(resolvedSelection.generatedAppOptions.database === 'none'
        ? [
            {
              command: process.execPath,
              args: ['--input-type=module', '--eval', databaseNoneModuleResolutionGuardScript()],
            },
          ]
        : []),
    ]);
  } else {
    phases.push(
      stopped
        ? createSkippedVerificationPhase('build')
        : createVerificationPhaseEvidence('build', 'not-applicable', {
            durationMs: 0,
            reason:
              profile === 'convex'
                ? 'Convex has no Node production build phase.'
                : 'The deterministic Expo profile has no workspace build phase.',
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
              reason:
                profile === 'convex'
                  ? 'Convex hosting has no generated Node server process.'
                  : 'The deterministic Expo profile has no server process.',
            }),
      );
    } else if (stopped) {
      phases.push(createSkippedVerificationPhase('start'));
    } else {
      const port = environment.PORT;
      const clientOrigin = environment.CLIENT_ORIGIN;
      if (!port || !/^\d+$/.test(port) || !clientOrigin || !/^https?:\/\//.test(clientOrigin)) {
        stopped = true;
        phases.push(createVerificationPhaseEvidence('start', 'failed', { durationMs: 0 }));
        failures.push({
          phase: 'start',
          kind: 'process-failed',
          message:
            'The Node server verification profile requires a numeric PORT and HTTP(S) CLIENT_ORIGIN.',
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

    if (profile === 'node-server' || profile === 'convex') {
      await recordCommandPhase('runtime', [
        { command: selection.packageManager, args: ['run', 'test:integration'] },
      ]);
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
