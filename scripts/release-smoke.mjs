import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const workspaceRoot = resolve(import.meta.dirname, '..');
const keepOutput = process.env.TENKIT_KEEP_RELEASE_SMOKE === '1';
const smokeRoot = mkdtempSync(join(tmpdir(), 'tenkit-release-smoke-'));
const packDir = join(smokeRoot, 'packs');
const runnerDir = join(smokeRoot, 'runner');
const smokeCases = [
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

function run(stepName, command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
    env: {
      ...process.env,
      INIT_CWD: cwd,
    },
  });

  if (result.status !== 0) {
    const output = sanitizeCommandOutput(`${result.stdout || ''}\n${result.stderr || ''}`);
    const details = output ? `\n${output}` : '';
    throw new Error(`${stepName} failed with exit code ${result.status}.${details}`);
  }
}

function sanitizeCommandOutput(output) {
  return output
    .replaceAll(workspaceRoot, '<workspace>')
    .replaceAll(smokeRoot, '<release-smoke-dir>')
    .trim();
}

function findTarball(pattern) {
  const tarball = readdirSync(packDir).find((name) => pattern.test(name));

  if (!tarball) {
    throw new Error(`Could not find packed tarball matching ${pattern}`);
  }

  return join(packDir, tarball);
}

function assertGeneratedCase(smokeCase) {
  const projectDir = join(runnerDir, smokeCase.projectName);

  for (const path of smokeCase.expectedPaths) {
    if (!existsSync(join(projectDir, path))) {
      throw new Error(`Release smoke for ${smokeCase.name} is missing ${path}.`);
    }
  }

  for (const path of smokeCase.unexpectedPaths) {
    if (existsSync(join(projectDir, path))) {
      throw new Error(`Release smoke for ${smokeCase.name} unexpectedly generated ${path}.`);
    }
  }

  const packageJson = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf8'));
  const dependencies = packageJson.dependencies ?? {};

  for (const dependency of smokeCase.expectedDependencies) {
    if (!(dependency in dependencies)) {
      throw new Error(`Release smoke for ${smokeCase.name} is missing ${dependency}.`);
    }
  }

  for (const dependency of smokeCase.unexpectedDependencies) {
    if (dependency in dependencies) {
      throw new Error(`Release smoke for ${smokeCase.name} unexpectedly includes ${dependency}.`);
    }
  }

  for (const [path, expectedContents] of Object.entries(smokeCase.expectedFileContents ?? {})) {
    const contents = readFileSync(join(projectDir, path), 'utf8');

    for (const expectedContent of expectedContents) {
      if (!contents.includes(expectedContent)) {
        throw new Error(
          `Release smoke for ${smokeCase.name} expected ${path} to contain ${JSON.stringify(expectedContent)}.`,
        );
      }
    }
  }
}

try {
  mkdirSync(packDir, { recursive: true });
  mkdirSync(runnerDir, { recursive: true });

  run(
    'Pack @tenkit/template-generator',
    'pnpm',
    ['-F', '@tenkit/template-generator', 'pack', '--pack-destination', packDir],
    workspaceRoot,
  );
  run(
    'Pack @tenkit/cli',
    'pnpm',
    ['-F', '@tenkit/cli', 'pack', '--pack-destination', packDir],
    workspaceRoot,
  );
  run(
    'Pack create-tenkit',
    'pnpm',
    ['-F', 'create-tenkit', 'pack', '--pack-destination', packDir],
    workspaceRoot,
  );

  const templateGeneratorTarball = findTarball(/^tenkit-template-generator-.*\.tgz$/);
  const cliTarball = findTarball(/^tenkit-cli-.*\.tgz$/);
  const createTenkitTarball = findTarball(/^create-tenkit-.*\.tgz$/);

  writeFileSync(
    join(runnerDir, 'package.json'),
    `${JSON.stringify(
      {
        private: true,
        type: 'module',
        dependencies: {
          '@tenkit/template-generator': `file:${templateGeneratorTarball}`,
          '@tenkit/cli': `file:${cliTarball}`,
          'create-tenkit': `file:${createTenkitTarball}`,
        },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(runnerDir, 'pnpm-workspace.yaml'),
    [
      'overrides:',
      `  '@tenkit/template-generator': 'file:${templateGeneratorTarball}'`,
      `  '@tenkit/cli': 'file:${cliTarball}'`,
      `  create-tenkit: 'file:${createTenkitTarball}'`,
      '',
    ].join('\n'),
  );

  run('Install packed packages', 'pnpm', ['install'], runnerDir);

  for (const smokeCase of smokeCases) {
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

    run(`Run installed create-tenkit package for ${smokeCase.name}`, 'pnpm', args, runnerDir);
    assertGeneratedCase(smokeCase);
  }

  console.log(`Release smoke passed ${smokeCases.length} cases.`);
} catch (error) {
  const message = error instanceof Error ? error.message : 'Release smoke failed.';
  console.error(message);
  process.exitCode = 1;
} finally {
  if (!keepOutput) {
    rmSync(smokeRoot, { recursive: true, force: true });
  }
}
