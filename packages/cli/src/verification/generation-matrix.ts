/// <reference types="node" />

import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

import {
  generateProject,
  SUPPORTED_GENERATED_SETUP_TYPE_IDS,
  SUPPORTED_GENERATED_STYLING_CHOICES,
  type GeneratedSetupType,
  type GeneratedStylingChoice,
  type VirtualFileTree,
} from '@tenkit/template-generator';
import {
  deriveAppVariantIdentities,
  getGeneratedSetupTypeDefinition,
} from '@tenkit/template-generator/setup-type-definitions';
import fs from 'fs-extra';
import { basename, join, relative, resolve, sep } from 'pathe';

import { runCreateFlow } from '../create/run-create';
import type { CreateFlowEnvironment } from '../create/types';
import { defaultRunCommand } from '../adapters/command-runner';
import {
  SUPPORTED_PACKAGE_MANAGERS,
  type PublicCliPackageManager,
} from '../create/package-manager';

const execFileAsync = promisify(execFile);
const VALUE_PROFILES = ['default', 'custom'] as const;
const LOCKFILES = ['pnpm-lock.yaml', 'package-lock.json', 'bun.lock', 'bun.lockb'] as const;
const MATRIX_GIT_ENV = {
  GIT_AUTHOR_NAME: 'Tenkit Matrix',
  GIT_AUTHOR_EMAIL: 'matrix@tenkit.dev',
  GIT_COMMITTER_NAME: 'Tenkit Matrix',
  GIT_COMMITTER_EMAIL: 'matrix@tenkit.dev',
} as const;

export const GENERATION_MATRIX_ROOT = '/tmp/tenkit-test';

type ValueProfile = (typeof VALUE_PROFILES)[number];

type CustomAppVariantValues = {
  names: readonly string[];
  accents: readonly string[];
};

const CUSTOM_APP_VARIANT_VALUES = {
  'white-label-apps': {
    names: ['Café North', '123 South'],
    accents: ['#123ABC', '#F59E0B'],
  },
  'single-app-runtime-tenants': {
    names: ['Málaga Central'],
    accents: ['#7C3AED'],
  },
  'generic-with-standalone-app-variants': {
    names: ['Atlas Custom', '456 Studio'],
    accents: ['#00AA55', '#2563EB'],
  },
} as const satisfies Record<GeneratedSetupType, CustomAppVariantValues>;

export type GenerationMatrixCase = {
  id: string;
  phase: 'generation' | 'installed';
  setupType: GeneratedSetupType;
  publicSetupSlug: string;
  stylingChoice: GeneratedStylingChoice;
  packageManager: PublicCliPackageManager;
  valueProfile: ValueProfile;
  appVariantNames: readonly string[];
  appVariantAccents: readonly string[];
  install: boolean;
  git: boolean;
};

export type GenerationMatrixCaseResult =
  | (GenerationMatrixCase & {
      status: 'passed' | 'failed';
      error?: string;
    })
  | {
      id: 'tool-preflight';
      phase: 'preflight';
      status: 'failed';
      error: string;
    };

export type GenerationMatrixReport = {
  rootDir: string;
  startedAt: string;
  finishedAt?: string;
  status: 'running' | 'passed' | 'failed';
  cases: GenerationMatrixCaseResult[];
  toolVersions: Record<string, string>;
};

type RunGenerationMatrixOptions = {
  workspaceRoot: string;
  rootDir?: string;
};

type ExternalVerificationOperation =
  | 'Git commit check'
  | 'generated app typecheck'
  | 'generated app Expo config'
  | 'generated app Expo config for non-default App Variant'
  | `${PublicCliPackageManager | 'git'} version check`;

type ExternalVerificationCommand = {
  command: string;
  args: readonly string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  operation: ExternalVerificationOperation;
};

class ExternalVerificationCommandError extends Error {
  constructor(readonly operation: ExternalVerificationOperation) {
    super('External verification command failed.');
    this.name = 'ExternalVerificationCommandError';
  }
}

function matrixCaseId({
  phase,
  publicSetupSlug,
  stylingChoice,
  packageManager,
  valueProfile,
}: Pick<
  GenerationMatrixCase,
  'phase' | 'publicSetupSlug' | 'stylingChoice' | 'packageManager' | 'valueProfile'
>): string {
  const prefix = phase === 'installed' ? 'installed-' : '';
  return `${prefix}${publicSetupSlug}-${stylingChoice}-${packageManager}-${valueProfile}`;
}

function createMatrixCase({
  phase,
  setupType,
  stylingChoice,
  packageManager,
  valueProfile,
  install,
  git,
}: Pick<
  GenerationMatrixCase,
  'phase' | 'setupType' | 'stylingChoice' | 'packageManager' | 'valueProfile' | 'install' | 'git'
>): GenerationMatrixCase {
  const definition = getGeneratedSetupTypeDefinition(setupType);

  const appVariantValues =
    valueProfile === 'custom'
      ? CUSTOM_APP_VARIANT_VALUES[setupType]
      : {
          names: definition.appVariants.map(({ defaultName }) => defaultName),
          accents: definition.appVariants.map(({ defaultAccent }) => defaultAccent),
        };

  const matrixCase = {
    phase,
    setupType,
    publicSetupSlug: definition.publicSlug,
    stylingChoice,
    packageManager,
    valueProfile,
    appVariantNames: [...appVariantValues.names],
    appVariantAccents: [...appVariantValues.accents],
    install,
    git,
  } as const;

  return {
    id: matrixCaseId(matrixCase),
    ...matrixCase,
  };
}

export function createExhaustiveGenerationCases(): readonly GenerationMatrixCase[] {
  return SUPPORTED_GENERATED_SETUP_TYPE_IDS.flatMap((setupType) =>
    SUPPORTED_GENERATED_STYLING_CHOICES.flatMap((stylingChoice) =>
      SUPPORTED_PACKAGE_MANAGERS.flatMap((packageManager) =>
        VALUE_PROFILES.map((valueProfile) =>
          createMatrixCase({
            phase: 'generation',
            setupType,
            stylingChoice,
            packageManager,
            valueProfile,
            install: false,
            git: false,
          }),
        ),
      ),
    ),
  );
}

export function createInstalledVerificationCases(): readonly GenerationMatrixCase[] {
  return [
    createMatrixCase({
      phase: 'installed',
      setupType: 'white-label-apps',
      stylingChoice: 'bare',
      packageManager: 'pnpm',
      valueProfile: 'default',
      install: true,
      git: true,
    }),
    createMatrixCase({
      phase: 'installed',
      setupType: 'white-label-apps',
      stylingChoice: 'uniwind',
      packageManager: 'npm',
      valueProfile: 'custom',
      install: true,
      git: false,
    }),
    createMatrixCase({
      phase: 'installed',
      setupType: 'single-app-runtime-tenants',
      stylingChoice: 'bare',
      packageManager: 'bun',
      valueProfile: 'custom',
      install: true,
      git: true,
    }),
    createMatrixCase({
      phase: 'installed',
      setupType: 'single-app-runtime-tenants',
      stylingChoice: 'uniwind',
      packageManager: 'pnpm',
      valueProfile: 'default',
      install: true,
      git: false,
    }),
    createMatrixCase({
      phase: 'installed',
      setupType: 'generic-with-standalone-app-variants',
      stylingChoice: 'bare',
      packageManager: 'npm',
      valueProfile: 'default',
      install: true,
      git: true,
    }),
    createMatrixCase({
      phase: 'installed',
      setupType: 'generic-with-standalone-app-variants',
      stylingChoice: 'uniwind',
      packageManager: 'bun',
      valueProfile: 'custom',
      install: true,
      git: false,
    }),
  ];
}

async function listProjectFiles({
  rootDir,
  ignoredTopLevelDirectories,
}: {
  rootDir: string;
  ignoredTopLevelDirectories: ReadonlySet<string>;
}): Promise<string[]> {
  const files: string[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const path = join(directory, entry.name);
      const relativePath = relative(rootDir, path);
      const topLevelName = relativePath.split('/')[0];

      if (topLevelName && ignoredTopLevelDirectories.has(topLevelName)) {
        continue;
      }

      if (entry.isDirectory()) {
        await visit(path);
      } else {
        files.push(relativePath);
      }
    }
  }

  await visit(rootDir);
  return files.sort();
}

function expectedContentsBuffer(contents: string | Uint8Array): Buffer {
  return typeof contents === 'string' ? Buffer.from(contents, 'utf8') : Buffer.from(contents);
}

export async function assertGeneratedProjectMatches({
  targetDir,
  tree,
  allowedUnexpectedFiles = [],
  ignoredTopLevelDirectories = [],
}: {
  targetDir: string;
  tree: VirtualFileTree;
  allowedUnexpectedFiles?: readonly string[];
  ignoredTopLevelDirectories?: readonly string[];
}): Promise<void> {
  const expectedPaths = new Set(tree.map(({ path }) => path));
  const allowedPaths = new Set(allowedUnexpectedFiles);

  for (const file of tree) {
    const outputPath = join(targetDir, file.path);

    if (!(await fs.pathExists(outputPath))) {
      throw new Error(`Missing generated file ${JSON.stringify(file.path)}.`);
    }

    const actualContents = await fs.readFile(outputPath);

    if (!actualContents.equals(expectedContentsBuffer(file.contents))) {
      throw new Error(`Generated file contents differ for ${JSON.stringify(file.path)}.`);
    }
  }

  const actualPaths = await listProjectFiles({
    rootDir: targetDir,
    ignoredTopLevelDirectories: new Set(ignoredTopLevelDirectories),
  });

  for (const path of actualPaths) {
    if (!expectedPaths.has(path) && !allowedPaths.has(path)) {
      throw new Error(`Unexpected generated file ${JSON.stringify(path)}.`);
    }
  }
}

function assertSafeMatrixRoot(rootDir: string): void {
  const resolvedRoot = resolve(rootDir);
  const resolvedTempRoot = resolve(tmpdir());
  const rootName = basename(resolvedRoot);
  const isGenerationMatrixRoot = resolvedRoot === GENERATION_MATRIX_ROOT;
  const isTestMatrixRoot =
    resolvedRoot.startsWith(`${resolvedTempRoot}${sep}`) && rootName.startsWith('tenkit-matrix-');

  if (!isGenerationMatrixRoot && !isTestMatrixRoot) {
    throw new Error(
      `Generation matrix root must be /tmp/tenkit-test or a tenkit-matrix-* test directory inside the system temp folder. Received ${JSON.stringify(rootDir)}.`,
    );
  }
}

async function writeReport(rootDir: string, report: GenerationMatrixReport): Promise<void> {
  await fs.outputJson(join(rootDir, 'verification-report.json'), report, { spaces: 2 });
}

export async function finalizeGenerationMatrix({
  rootDir,
  report,
}: {
  rootDir: string;
  report: GenerationMatrixReport;
}): Promise<void> {
  assertSafeMatrixRoot(rootDir);

  if (report.status === 'passed') {
    await fs.remove(rootDir);
    return;
  }

  await writeReport(rootDir, report);
}

function createFlowEnvironment(rootDir: string, workspaceRoot: string): CreateFlowEnvironment {
  const unexpectedPrompt = async () => {
    throw new Error('Generation matrix create flow unexpectedly prompted for input.');
  };

  return {
    cwd: rootDir,
    workspaceRoot,
    isInteractive: false,
    packageManagerUserAgent: 'pnpm/11',
    output: {
      log() {},
      error() {},
    },
    runCommand(command, args, cwd, options) {
      return defaultRunCommand(command, args, cwd, {
        ...options,
        env: MATRIX_GIT_ENV,
      });
    },
    prompts: {
      text: unexpectedPrompt,
      select: unexpectedPrompt,
      confirm: unexpectedPrompt,
    },
  };
}

async function runExternalCommand({
  command,
  args,
  cwd,
  env,
  operation,
}: ExternalVerificationCommand): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync(command, [...args], {
      cwd,
      env: { ...process.env, ...env },
      maxBuffer: 20 * 1024 * 1024,
    });

    return `${stdout}${stderr}`.trim();
  } catch {
    throw new ExternalVerificationCommandError(operation);
  }
}

function describeMatrixFailure(
  error: unknown,
  phase: 'tool preflight' | 'case verification',
): string {
  if (error instanceof ExternalVerificationCommandError) {
    return `External verification command failed during ${phase}: ${error.operation}.`;
  }

  return error instanceof Error ? error.message : 'Unknown matrix verification failure.';
}

function selectedLockfile(packageManager: PublicCliPackageManager): string {
  if (packageManager === 'pnpm') {
    return 'pnpm-lock.yaml';
  }

  if (packageManager === 'npm') {
    return 'package-lock.json';
  }

  return 'bun.lock';
}

async function assertInstallArtifacts(
  matrixCase: GenerationMatrixCase,
  targetDir: string,
): Promise<void> {
  const expectedLockfile = selectedLockfile(matrixCase.packageManager);

  if (matrixCase.install) {
    if (!(await fs.pathExists(join(targetDir, 'node_modules')))) {
      throw new Error(`Installed case ${matrixCase.id} did not create node_modules.`);
    }

    if (!(await fs.pathExists(join(targetDir, expectedLockfile)))) {
      throw new Error(
        `Installed ${matrixCase.packageManager} case ${matrixCase.id} did not create ${expectedLockfile}.`,
      );
    }
  } else {
    if (await fs.pathExists(join(targetDir, 'node_modules'))) {
      throw new Error(`No-install case ${matrixCase.id} unexpectedly created node_modules.`);
    }
  }

  for (const lockfile of LOCKFILES) {
    const shouldExist = matrixCase.install && lockfile === expectedLockfile;
    const exists = await fs.pathExists(join(targetDir, lockfile));

    if (exists !== shouldExist) {
      throw new Error(
        `${matrixCase.id} ${shouldExist ? 'is missing' : 'unexpectedly contains'} ${lockfile}.`,
      );
    }
  }
}

async function assertGitArtifacts(
  matrixCase: GenerationMatrixCase,
  targetDir: string,
): Promise<void> {
  const gitExists = await fs.pathExists(join(targetDir, '.git'));

  if (gitExists !== matrixCase.git) {
    throw new Error(
      `${matrixCase.id} ${matrixCase.git ? 'did not create' : 'unexpectedly created'} .git.`,
    );
  }

  if (matrixCase.git) {
    await runExternalCommand({
      command: 'git',
      args: ['rev-parse', 'HEAD'],
      cwd: targetDir,
      operation: 'Git commit check',
    });
  }
}

export function planInstalledProjectVerificationCommands({
  packageManager,
  targetDir,
  appVariantNames,
}: {
  packageManager: PublicCliPackageManager;
  targetDir: string;
  appVariantNames: readonly string[];
}): readonly ExternalVerificationCommand[] {
  const remainingAppVariantSlugs = deriveAppVariantIdentities(appVariantNames)
    .slice(1)
    .map(({ slug }) => slug);

  return [
    {
      command: packageManager,
      args: ['run', 'typecheck'],
      cwd: targetDir,
      operation: 'generated app typecheck',
    },
    {
      command: packageManager,
      args: ['run', 'expo:config'],
      cwd: targetDir,
      operation: 'generated app Expo config',
    },
    ...remainingAppVariantSlugs.map(
      (appVariantSlug): ExternalVerificationCommand => ({
        command: packageManager,
        args: ['run', 'expo:config'],
        cwd: targetDir,
        env: { APP_VARIANT_SLUG: appVariantSlug },
        operation: 'generated app Expo config for non-default App Variant',
      }),
    ),
  ];
}

async function verifyInstalledProject(
  matrixCase: GenerationMatrixCase,
  targetDir: string,
  appVariantNames: readonly string[],
): Promise<void> {
  const commands = planInstalledProjectVerificationCommands({
    packageManager: matrixCase.packageManager,
    targetDir,
    appVariantNames,
  });

  for (const command of commands) {
    await runExternalCommand(command);
  }
}

async function verifyMatrixCase(
  matrixCase: GenerationMatrixCase,
  rootDir: string,
  workspaceRoot: string,
): Promise<void> {
  const result = await runCreateFlow(
    {
      name: matrixCase.id,
      setup: matrixCase.publicSetupSlug,
      styling: matrixCase.stylingChoice,
      packageManager: matrixCase.packageManager,
      appVariantNamesInput:
        matrixCase.valueProfile === 'custom' ? matrixCase.appVariantNames.join(',') : undefined,
      appVariantAccentsInput:
        matrixCase.valueProfile === 'custom' ? matrixCase.appVariantAccents.join(',') : undefined,
      yes: true,
      install: matrixCase.install,
      git: matrixCase.git,
    },
    createFlowEnvironment(rootDir, workspaceRoot),
  );

  if (result.installFailed || result.installed !== matrixCase.install) {
    throw new Error(`Dependency installation did not match ${matrixCase.id}.`);
  }

  if (
    result.projectName !== matrixCase.id ||
    result.packageName !== matrixCase.id ||
    result.setupType !== matrixCase.setupType ||
    result.stylingChoice !== matrixCase.stylingChoice ||
    result.packageManager !== matrixCase.packageManager ||
    JSON.stringify(result.appVariantNames) !== JSON.stringify(matrixCase.appVariantNames) ||
    JSON.stringify(result.appVariantAccents) !== JSON.stringify(matrixCase.appVariantAccents)
  ) {
    throw new Error(`Resolved Public CLI choices did not match ${matrixCase.id}.`);
  }

  if (
    result.gitFailed ||
    result.gitInitialized !== matrixCase.git ||
    result.gitCommitted !== matrixCase.git
  ) {
    throw new Error(`Git initialization did not match ${matrixCase.id}.`);
  }

  const expectedTree = generateProject({
    setupType: matrixCase.setupType,
    stylingChoice: matrixCase.stylingChoice,
    appVariantNames: matrixCase.appVariantNames,
    appVariantAccents: matrixCase.appVariantAccents,
    projectName: matrixCase.id,
    packageName: matrixCase.id,
    packageManager: matrixCase.packageManager,
  });
  const allowedUnexpectedFiles = matrixCase.install
    ? [selectedLockfile(matrixCase.packageManager)]
    : [];

  await assertGeneratedProjectMatches({
    targetDir: result.targetDir,
    tree: expectedTree,
    allowedUnexpectedFiles,
    ignoredTopLevelDirectories: ['node_modules', '.git'],
  });
  await assertInstallArtifacts(matrixCase, result.targetDir);
  await assertGitArtifacts(matrixCase, result.targetDir);

  if (matrixCase.install) {
    await verifyInstalledProject(matrixCase, result.targetDir, matrixCase.appVariantNames);
  }
}

async function readToolVersions(): Promise<Record<string, string>> {
  const versions: Record<string, string> = {};
  const commands: readonly (PublicCliPackageManager | 'git')[] = [
    ...SUPPORTED_PACKAGE_MANAGERS,
    'git',
  ];

  for (const command of commands) {
    versions[command] = await runExternalCommand({
      command,
      args: ['--version'],
      cwd: tmpdir(),
      operation: `${command} version check`,
    });
  }

  return versions;
}

export async function runGenerationMatrix({
  workspaceRoot,
  rootDir = GENERATION_MATRIX_ROOT,
}: RunGenerationMatrixOptions): Promise<GenerationMatrixReport> {
  assertSafeMatrixRoot(rootDir);
  await fs.remove(rootDir);
  await fs.ensureDir(rootDir);

  const report: GenerationMatrixReport = {
    rootDir,
    startedAt: new Date().toISOString(),
    status: 'running',
    cases: [],
    toolVersions: {},
  };

  try {
    report.toolVersions = await readToolVersions();
  } catch (error) {
    report.status = 'failed';
    report.finishedAt = new Date().toISOString();
    report.cases.push({
      id: 'tool-preflight',
      phase: 'preflight',
      status: 'failed',
      error: describeMatrixFailure(error, 'tool preflight'),
    });
    await finalizeGenerationMatrix({ rootDir, report });
    return report;
  }

  const cases = [...createExhaustiveGenerationCases(), ...createInstalledVerificationCases()];

  for (const matrixCase of cases) {
    process.stdout.write(`Verifying ${matrixCase.id}...\n`);

    try {
      await verifyMatrixCase(matrixCase, rootDir, workspaceRoot);
      report.cases.push({ ...matrixCase, status: 'passed' });
    } catch (error) {
      report.cases.push({
        ...matrixCase,
        status: 'failed',
        error: describeMatrixFailure(error, 'case verification'),
      });
    }

    await writeReport(rootDir, report);
  }

  report.finishedAt = new Date().toISOString();
  report.status = report.cases.every(({ status }) => status === 'passed') ? 'passed' : 'failed';
  await finalizeGenerationMatrix({ rootDir, report });
  return report;
}
