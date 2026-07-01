import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const workspaceRoot = resolve(import.meta.dirname, '..');
const keepOutput = process.env.TENKIT_KEEP_RELEASE_SMOKE === '1';
const smokeRoot = mkdtempSync(join(tmpdir(), 'tenkit-release-smoke-'));
const packDir = join(smokeRoot, 'packs');
const runnerDir = join(smokeRoot, 'runner');
const smokeProjectName = 'smoke-runtime-tenants';

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

  run(
    'Run installed create-tenkit package',
    'pnpm',
    [
      'exec',
      'create-tenkit',
      '--name',
      smokeProjectName,
      '--setup',
      'runtime-tenants',
      '--yes',
      '--no-install',
      '--no-git',
    ],
    runnerDir,
  );

  const generatedPackageJson = join(runnerDir, smokeProjectName, 'package.json');
  const generatedRuntimeTenants = join(
    runnerDir,
    smokeProjectName,
    'src',
    'constants',
    'runtime-tenants.ts',
  );

  if (!existsSync(generatedPackageJson) || !existsSync(generatedRuntimeTenants)) {
    throw new Error('Release smoke did not generate the expected Runtime Tenant files.');
  }

  console.log('Release smoke passed.');
} catch (error) {
  const message = error instanceof Error ? error.message : 'Release smoke failed.';
  console.error(message);
  process.exitCode = 1;
} finally {
  if (!keepOutput) {
    rmSync(smokeRoot, { recursive: true, force: true });
  }
}
