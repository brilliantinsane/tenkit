import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
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
const smokeProjectName = 'smoke-runtime-tenants';
const maxAttempts = 5;
const retryDelayMs = 10_000;

function runCreate() {
  return spawnSync(
    'pnpm',
    [
      'create',
      `tenkit@${distTag}`,
      '--',
      '--name',
      smokeProjectName,
      '--setup',
      'runtime-tenants',
      '--yes',
      '--no-install',
      '--no-git',
    ],
    {
      cwd: runnerDir,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        INIT_CWD: runnerDir,
        XDG_CACHE_HOME: cacheDir,
      },
    },
  );
}

function sanitizeCommandOutput(output) {
  return output.replaceAll(smokeRoot, '<published-create-smoke-dir>').trim();
}

function assertGeneratedRuntimeTenantFiles() {
  const generatedPackageJson = join(runnerDir, smokeProjectName, 'package.json');
  const generatedRuntimeTenants = join(
    runnerDir,
    smokeProjectName,
    'src',
    'constants',
    'runtime-tenants.ts',
  );

  if (!existsSync(generatedPackageJson) || !existsSync(generatedRuntimeTenants)) {
    throw new Error('Published create smoke did not generate the expected Runtime Tenant files.');
  }
}

async function runPublishedCreateSmoke() {
  let lastOutput = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    rmSync(runnerDir, { recursive: true, force: true });
    mkdirSync(runnerDir, { recursive: true });
    const result = runCreate();

    if (result.status === 0) {
      assertGeneratedRuntimeTenantFiles();
      console.log(`Published create smoke passed for tenkit@${distTag}.`);
      return;
    }

    lastOutput = sanitizeCommandOutput(`${result.stdout || ''}\n${result.stderr || ''}`);

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
