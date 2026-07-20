import { lstat, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import type { RunReleaseCommand } from './pack-release-set';
import { getReleaseSetPackage, type ReleaseSetPackageName } from './release-set';

export type VerifyPackedReleaseSetInput = {
  artifactPaths: readonly string[];
  expectedVersion: string;
  runCommand: RunReleaseCommand;
};

type PackedCreateSmokeCase = {
  name: string;
  projectName: string;
  setup: string;
  styling?: string;
  variantNames?: string;
  variantAccents?: string;
  expectedPaths: readonly string[];
  unexpectedPaths: readonly string[];
  expectedDependencies: readonly string[];
  unexpectedDependencies: readonly string[];
  expectedFileContents?: Readonly<Record<string, readonly string[]>>;
};

const PACKED_CREATE_SMOKE_CASES: readonly PackedCreateSmokeCase[] = [
  {
    name: 'Bare Runtime Tenants',
    projectName: 'smoke-runtime-tenants-bare',
    setup: 'runtime-tenants',
    expectedPaths: [
      'package.json',
      'src/constants/runtime-tenants.ts',
      'src/theme/ThemeContext.tsx',
    ],
    unexpectedPaths: ['src/global.css', 'unistyles.ts'],
    expectedDependencies: [],
    unexpectedDependencies: ['uniwind', 'react-native-unistyles'],
  },
  {
    name: 'Uniwind Generic With Standalone App Variants',
    projectName: 'smoke-generic-standalone-uniwind',
    setup: 'generic-standalone',
    styling: 'uniwind',
    expectedPaths: [
      'package.json',
      'metro.config.js',
      'src/constants/runtime-tenants.ts',
      'src/global.css',
      'src/uniwind-env.d.ts',
    ],
    unexpectedPaths: ['src/theme/ThemeContext.tsx', 'unistyles.ts'],
    expectedDependencies: ['uniwind'],
    unexpectedDependencies: ['react-native-unistyles'],
  },
  {
    name: 'Unistyles White Label Apps with custom App Variants',
    projectName: 'smoke-white-label-unistyles',
    setup: 'white-label',
    styling: 'unistyles',
    variantNames: 'Smoke North,Smoke South',
    variantAccents: '#123ABC,#F59E0B',
    expectedPaths: [
      'package.json',
      'babel.config.js',
      'index.ts',
      'src/constants/app-variants.ts',
      'unistyles.ts',
    ],
    unexpectedPaths: ['src/global.css', 'src/theme/ThemeContext.tsx'],
    expectedDependencies: ['react-native-nitro-modules', 'react-native-unistyles'],
    unexpectedDependencies: ['uniwind'],
    expectedFileContents: {
      'src/constants/app-variants.ts': ['Smoke North', 'Smoke South', '#123ABC', '#F59E0B'],
    },
  },
];

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

async function assertGeneratedCase(
  runnerRoot: string,
  smokeCase: PackedCreateSmokeCase,
): Promise<void> {
  const projectRoot = join(runnerRoot, smokeCase.projectName);

  for (const path of smokeCase.expectedPaths) {
    if (!(await pathExists(join(projectRoot, path)))) {
      throw new Error(`Packed release smoke for ${smokeCase.name} is missing ${path}.`);
    }
  }

  for (const path of smokeCase.unexpectedPaths) {
    if (await pathExists(join(projectRoot, path))) {
      throw new Error(`Packed release smoke for ${smokeCase.name} unexpectedly generated ${path}.`);
    }
  }

  const packageMetadata: unknown = JSON.parse(
    await readFile(join(projectRoot, 'package.json'), 'utf8'),
  );

  if (!packageMetadata || typeof packageMetadata !== 'object' || Array.isArray(packageMetadata)) {
    throw new Error(`Packed release smoke for ${smokeCase.name} emitted invalid package metadata.`);
  }

  const dependenciesValue = (packageMetadata as Record<string, unknown>).dependencies;
  const dependencies =
    dependenciesValue && typeof dependenciesValue === 'object' && !Array.isArray(dependenciesValue)
      ? (dependenciesValue as Record<string, unknown>)
      : {};

  for (const dependency of smokeCase.expectedDependencies) {
    if (!(dependency in dependencies)) {
      throw new Error(`Packed release smoke for ${smokeCase.name} is missing ${dependency}.`);
    }
  }

  for (const dependency of smokeCase.unexpectedDependencies) {
    if (dependency in dependencies) {
      throw new Error(`Packed release smoke for ${smokeCase.name} includes ${dependency}.`);
    }
  }

  for (const [path, expectedContents] of Object.entries(smokeCase.expectedFileContents ?? {})) {
    const contents = await readFile(join(projectRoot, path), 'utf8');

    for (const expectedContent of expectedContents) {
      if (!contents.includes(expectedContent)) {
        throw new Error(
          `Packed release smoke for ${smokeCase.name} expected ${path} to contain ${JSON.stringify(expectedContent)}.`,
        );
      }
    }
  }
}

function artifactForPackage(
  artifactPaths: readonly string[],
  packageName: ReleaseSetPackageName,
  version: string,
): string {
  const expectedFilename = `${getReleaseSetPackage(packageName).artifactPrefix}-${version}.tgz`;
  const artifactPath = artifactPaths.find((path) => basename(path) === expectedFilename);

  if (!artifactPath) {
    throw new Error(`Packed release smoke is missing ${expectedFilename}.`);
  }

  return artifactPath;
}

export async function verifyPackedReleaseSet(input: VerifyPackedReleaseSetInput): Promise<void> {
  if (!/^\d+\.\d+\.\d+$/.test(input.expectedVersion)) {
    throw new Error('Packed release smoke requires an exact Release Set version.');
  }

  const templateGeneratorArtifact = artifactForPackage(
    input.artifactPaths,
    '@tenkit/template-generator',
    input.expectedVersion,
  );
  const cliArtifact = artifactForPackage(input.artifactPaths, '@tenkit/cli', input.expectedVersion);
  const createArtifact = artifactForPackage(
    input.artifactPaths,
    'create-tenkit',
    input.expectedVersion,
  );
  const runnerRoot = await mkdtemp(join(tmpdir(), 'tenkit-packed-release-smoke-'));

  try {
    await writeFile(
      join(runnerRoot, 'package.json'),
      `${JSON.stringify(
        {
          private: true,
          dependencies: {
            '@tenkit/template-generator': `file:${templateGeneratorArtifact}`,
            '@tenkit/cli': `file:${cliArtifact}`,
            'create-tenkit': `file:${createArtifact}`,
          },
        },
        null,
        2,
      )}\n`,
    );
    await writeFile(
      join(runnerRoot, 'pnpm-workspace.yaml'),
      [
        'overrides:',
        `  '@tenkit/template-generator': 'file:${templateGeneratorArtifact}'`,
        `  '@tenkit/cli': 'file:${cliArtifact}'`,
        `  create-tenkit: 'file:${createArtifact}'`,
        '',
      ].join('\n'),
    );
    await input.runCommand({
      command: 'pnpm',
      args: ['install', '--ignore-scripts'],
      cwd: runnerRoot,
    });
    const cliVersion = await input.runCommand({
      command: 'pnpm',
      args: ['exec', 'tenkit', '--version'],
      cwd: runnerRoot,
    });

    if (cliVersion.stdout.trim() !== input.expectedVersion) {
      throw new Error(
        `Packed Public CLI --version expected ${input.expectedVersion}, found ${cliVersion.stdout.trim() || 'no output'}.`,
      );
    }

    for (const smokeCase of PACKED_CREATE_SMOKE_CASES) {
      const args = [
        'exec',
        'create-tenkit',
        '--name',
        smokeCase.projectName,
        '--setup',
        smokeCase.setup,
      ];

      if (smokeCase.styling) {
        args.push('--styling', smokeCase.styling);
      }

      if (smokeCase.variantNames) {
        args.push('--variant-names', smokeCase.variantNames);
      }

      if (smokeCase.variantAccents) {
        args.push('--variant-accents', smokeCase.variantAccents);
      }

      args.push('--yes', '--no-install', '--no-git');
      await input.runCommand({ command: 'pnpm', args, cwd: runnerRoot });
      await assertGeneratedCase(runnerRoot, smokeCase);
    }
  } finally {
    await rm(runnerRoot, { recursive: true });
  }
}
