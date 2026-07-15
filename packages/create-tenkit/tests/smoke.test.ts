import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';

import fs from 'fs-extra';
import { join, resolve } from 'pathe';
import { afterEach, expect, test } from 'vitest';

type SpawnResult = {
  code: number;
  stdout: string;
  stderr: string;
};

const tempRoots: string[] = [];

async function measurePathSize(path: string): Promise<number> {
  const stats = await fs.stat(path);

  if (!stats.isDirectory()) {
    return stats.size;
  }

  const entries = await fs.readdir(path);
  const sizes = await Promise.all(entries.map((entry) => measurePathSize(join(path, entry))));

  return sizes.reduce((total, size) => total + size, 0);
}

async function measurePackageFileEntries(
  packageRoot: string,
  entries: readonly string[],
): Promise<number> {
  const sizes = await Promise.all(
    entries.map((entry) => measurePathSize(join(packageRoot, entry))),
  );

  return sizes.reduce((total, size) => total + size, 0);
}

function formatBytes(size: number): string {
  return `${Math.round(size / 1024)} KiB`;
}

function createPackageSmokeReport({
  helpMs,
  createTenkitPackageSize,
  cliPackageSize,
  templateGeneratorPackageSize,
}: {
  helpMs: number;
  createTenkitPackageSize: number;
  cliPackageSize: number;
  templateGeneratorPackageSize: number;
}): string {
  return [
    `Public CLI package smoke: help ${helpMs}ms`,
    `create-tenkit ${formatBytes(createTenkitPackageSize)}`,
    `@tenkit/cli ${formatBytes(cliPackageSize)}`,
    `@tenkit/template-generator ${formatBytes(templateGeneratorPackageSize)}`,
  ].join('; ');
}

function runNode(args: readonly string[], cwd: string): Promise<SpawnResult> {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, [...args], {
      cwd,
      env: {
        ...process.env,
        INIT_CWD: cwd,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('close', (code) => {
      resolveRun({
        code: code ?? 1,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
  });
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((tempRoot) => fs.remove(tempRoot)));
});

test('built create-tenkit delegates to the real CLI and creates a project', async () => {
  const packageRoot = resolve(import.meta.dirname, '..');
  const cliPackageRoot = resolve(packageRoot, '../cli');
  const templateGeneratorPackageRoot = resolve(packageRoot, '../template-generator');
  const binPath = join(packageRoot, 'dist/index.mjs');
  const helpStart = performance.now();
  const help = await runNode([binPath, '--help'], packageRoot);
  const helpMs = Math.round(performance.now() - helpStart);
  const createTenkitPackageSize = await measurePackageFileEntries(packageRoot, [
    'dist',
    'package.json',
    'README.md',
  ]);
  const cliPackageSize = await measurePackageFileEntries(cliPackageRoot, [
    'dist',
    'package.json',
    'README.md',
  ]);
  const templateGeneratorPackageSize = await measurePackageFileEntries(
    templateGeneratorPackageRoot,
    ['dist', 'templates', 'package.json', 'README.md'],
  );
  const publicReadme = await fs.readFile(join(packageRoot, 'README.md'), 'utf8');

  expect(help.stderr).toBe('');
  expect(help.code).toBe(0);
  expect(help.stdout).toContain('Create a generated Tenkit Expo project');
  expect(help.stdout).not.toContain('--json');
  expect(publicReadme).toContain('## Styling Choices');
  expect(publicReadme).toContain('Bare');
  expect(publicReadme).toContain('Uniwind');
  expect(publicReadme).toContain('Unistyles');
  expect(publicReadme).toContain('--styling unistyles');

  const tempRoot = await fs.mkdtemp(join(tmpdir(), 'tenkit-create-smoke-'));
  tempRoots.push(tempRoot);

  const create = await runNode(
    [
      binPath,
      '--name',
      'tenkit-smoke',
      '--setup',
      'runtime-tenants',
      '--yes',
      '--no-install',
      '--no-git',
    ],
    tempRoot,
  );

  expect(create.stderr).toBe('');
  expect(create.code).toBe(0);

  const generatedPackageJson = (await fs.readJson(join(tempRoot, 'tenkit-smoke/package.json'))) as {
    name?: unknown;
    dependencies?: Record<string, string>;
  };
  expect(generatedPackageJson.name).toBe('tenkit-smoke');
  expect(generatedPackageJson.dependencies?.uniwind).toBeUndefined();
  expect(await fs.pathExists(join(tempRoot, 'tenkit-smoke/src/global.css'))).toBe(false);

  const createUniwind = await runNode(
    [
      binPath,
      '--name',
      'tenkit-uniwind-smoke',
      '--setup',
      'runtime-tenants',
      '--styling',
      'uniwind',
      '--variant-names',
      'Runtime Tenant App',
      '--variant-accents',
      '#123ABC',
      '--yes',
      '--no-install',
      '--no-git',
    ],
    tempRoot,
  );

  expect(createUniwind.stderr).toBe('');
  expect(createUniwind.code).toBe(0);

  const generatedUniwindPackageJson = (await fs.readJson(
    join(tempRoot, 'tenkit-uniwind-smoke/package.json'),
  )) as {
    name?: unknown;
    dependencies?: Record<string, string>;
  };
  const generatedAppVariant = await fs.readFile(
    join(tempRoot, 'tenkit-uniwind-smoke/src/constants/app-variant.ts'),
    'utf8',
  );
  const generatedGlobalCss = await fs.readFile(
    join(tempRoot, 'tenkit-uniwind-smoke/src/global.css'),
    'utf8',
  );

  expect(generatedUniwindPackageJson.name).toBe('tenkit-uniwind-smoke');
  expect(generatedUniwindPackageJson.dependencies?.uniwind).toBe('^1.10.0');
  expect(generatedAppVariant).toContain('accent: "#123ABC"');
  expect(generatedGlobalCss).toContain('--color-accent: #123ABC;');
  expect(helpMs).toBeLessThan(1000);
  expect(createTenkitPackageSize).toBeGreaterThan(0);
  expect(cliPackageSize).toBeGreaterThan(0);
  expect(templateGeneratorPackageSize).toBeGreaterThan(0);

  expect(
    createPackageSmokeReport({
      helpMs,
      createTenkitPackageSize,
      cliPackageSize,
      templateGeneratorPackageSize,
    }),
  ).toMatch(
    /^Public CLI package smoke: help \d+ms; create-tenkit \d+ KiB; @tenkit\/cli \d+ KiB; @tenkit\/template-generator \d+ KiB$/,
  );
});
