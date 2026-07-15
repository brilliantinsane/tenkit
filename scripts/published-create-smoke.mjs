import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const distTag =
  process.argv.slice(2).find((arg) => arg !== '--') || process.env.NPM_DIST_TAG || 'next';
const keepOutput = process.env.TENKIT_KEEP_PUBLISHED_SMOKE === '1';
const smokeRoot = mkdtempSync(join(tmpdir(), 'tenkit-published-create-smoke-'));
const cacheDir = join(smokeRoot, 'cache');
const runnerDir = join(smokeRoot, 'runner');
const maxAttempts = 5;
const retryDelayMs = 10_000;
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

function runCreate(smokeCase) {
  const args = [
    'create',
    `tenkit@${distTag}`,
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

  return spawnSync('pnpm', args, {
    cwd: runnerDir,
    encoding: 'utf8',
    stdio: 'pipe',
    env: {
      ...process.env,
      INIT_CWD: runnerDir,
      XDG_CACHE_HOME: cacheDir,
    },
  });
}

function sanitizeCommandOutput(output) {
  return output.replaceAll(smokeRoot, '<published-create-smoke-dir>').trim();
}

function assertGeneratedCase(smokeCase) {
  const projectDir = join(runnerDir, smokeCase.projectName);

  for (const path of smokeCase.expectedPaths) {
    if (!existsSync(join(projectDir, path))) {
      throw new Error(`Published create smoke for ${smokeCase.name} is missing ${path}.`);
    }
  }

  for (const path of smokeCase.unexpectedPaths) {
    if (existsSync(join(projectDir, path))) {
      throw new Error(
        `Published create smoke for ${smokeCase.name} unexpectedly generated ${path}.`,
      );
    }
  }

  const packageJson = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf8'));
  const dependencies = packageJson.dependencies ?? {};

  for (const dependency of smokeCase.expectedDependencies) {
    if (!(dependency in dependencies)) {
      throw new Error(`Published create smoke for ${smokeCase.name} is missing ${dependency}.`);
    }
  }

  for (const dependency of smokeCase.unexpectedDependencies) {
    if (dependency in dependencies) {
      throw new Error(
        `Published create smoke for ${smokeCase.name} unexpectedly includes ${dependency}.`,
      );
    }
  }

  for (const [path, expectedContents] of Object.entries(smokeCase.expectedFileContents ?? {})) {
    const contents = readFileSync(join(projectDir, path), 'utf8');

    for (const expectedContent of expectedContents) {
      if (!contents.includes(expectedContent)) {
        throw new Error(
          `Published create smoke for ${smokeCase.name} expected ${path} to contain ${JSON.stringify(expectedContent)}.`,
        );
      }
    }
  }
}

async function runPublishedCreateSmoke() {
  let lastOutput = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    rmSync(runnerDir, { recursive: true, force: true });
    mkdirSync(runnerDir, { recursive: true });
    let attemptPassed = true;

    for (const smokeCase of smokeCases) {
      const result = runCreate(smokeCase);

      if (result.status !== 0) {
        lastOutput = sanitizeCommandOutput(`${result.stdout || ''}\n${result.stderr || ''}`);
        attemptPassed = false;
        break;
      }

      assertGeneratedCase(smokeCase);
    }

    if (attemptPassed) {
      console.log(
        `Published create smoke passed ${smokeCases.length} cases for tenkit@${distTag}.`,
      );
      return;
    }

    if (attempt < maxAttempts) {
      await delay(retryDelayMs);
    }
  }

  const details = lastOutput ? `\n${lastOutput}` : '';
  throw new Error(`Published create smoke failed for tenkit@${distTag}.${details}`);
}

try {
  await runPublishedCreateSmoke();
} catch (error) {
  const message = error instanceof Error ? error.message : 'Published create smoke failed.';
  console.error(message);
  process.exitCode = 1;
} finally {
  if (!keepOutput) {
    rmSync(smokeRoot, { recursive: true, force: true });
  }
}
