import { execFileSync } from 'node:child_process';
import {
  chmod,
  cp,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import { basename, join } from 'node:path';

import { afterEach, describe, expect, test, vi } from 'vitest';

import { packReleaseSet, prepareReleaseWorkspace } from '../src/pack-release-set';
import { parseReleaseSetManifest } from '../src/release-set-manifest';
import type { ReleaseSetPlan } from '../src/release-plan';

const repositoryRoot = new URL('../../..', import.meta.url).pathname.replace(/\/$/, '');
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((tempRoot) => rm(tempRoot, { recursive: true })));
});

const plan = {
  kind: 'release',
  sourceSha: '3a10d24d0de14a4a0b175b58e046ecbc00a996f3',
  previousStableTag: {
    name: 'v0.2.0',
    version: '0.2.0',
    sha: 'a7d7a733e82d33f3a75f567756c96b247c54b155',
  },
  version: '0.3.0',
  contributingCommits: [
    {
      sha: '3a10d24d0de14a4a0b175b58e046ecbc00a996f3',
      title: 'feat(playground): upgrade to Expo SDK 57 (#29)',
      paths: ['packages/template-generator/tests/generator.test.ts'],
      impact: 'minor',
    },
  ],
} satisfies Extract<ReleaseSetPlan, { kind: 'release' }>;

const packageDefinitions = {
  '@tenkit/template-generator': {
    folder: 'template-generator',
    artifact: 'tenkit-template-generator-0.3.0.tgz',
    files: ['dist', 'templates', 'package.json', 'README.md'],
    exports: {
      '.': './dist/index.mjs',
      './generator': './dist/generator.mjs',
      './setup-type-definitions': './dist/generated-setup-type-definitions.mjs',
      './styling-definitions': './dist/generated-styling-choices.mjs',
      './writer': './dist/writer.mjs',
      './local-proof': './dist/local-proof.mjs',
    },
  },
  '@tenkit/cli': {
    folder: 'cli',
    artifact: 'tenkit-cli-0.3.0.tgz',
    files: ['dist', 'package.json', 'README.md'],
    exports: { '.': './dist/index.mjs' },
    bin: { tenkit: './dist/index.mjs' },
    dependencies: { '@tenkit/template-generator': '0.3.0' },
  },
  'create-tenkit': {
    folder: 'create-tenkit',
    artifact: 'create-tenkit-0.3.0.tgz',
    files: ['dist', 'package.json', 'README.md'],
    bin: { 'create-tenkit': './dist/index.mjs' },
    dependencies: { '@tenkit/cli': '0.3.0' },
  },
} as const;

async function createSourceFixture(): Promise<string> {
  const sourceFixture = await mkdtemp(join(tmpdir(), 'tenkit-release-source-fixture-'));
  tempRoots.push(sourceFixture);
  await writeFile(join(sourceFixture, '.nvmrc'), 'v24.16.0\n');
  await writeFile(join(sourceFixture, '.npm-version'), '11.16.0\n');
  await writeFile(
    join(sourceFixture, 'package.json'),
    `${JSON.stringify({ packageManager: 'pnpm@11.15.0' }, null, 2)}\n`,
  );

  for (const [name, definition] of Object.entries(packageDefinitions)) {
    const packageRoot = join(sourceFixture, 'packages', definition.folder);
    await mkdir(packageRoot, { recursive: true });
    await writeFile(join(packageRoot, 'README.md'), `# ${name}\n`);
    await writeFile(
      join(packageRoot, 'package.json'),
      `${JSON.stringify({ name, version: '0.2.0' }, null, 2)}\n`,
    );
  }

  return sourceFixture;
}

async function writePackedFixture(
  isolatedWorkspaceRoot: string,
  artifactRoot: string,
  packageName: keyof typeof packageDefinitions,
): Promise<void> {
  const definition = packageDefinitions[packageName];
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'tenkit-release-pack-fixture-'));
  tempRoots.push(fixtureRoot);
  const packageRoot = join(fixtureRoot, 'package');
  await mkdir(join(packageRoot, 'dist'), { recursive: true });
  await writeFile(join(packageRoot, 'README.md'), `# ${packageName}\n`);
  await writeFile(join(packageRoot, 'LICENSE'), 'MIT License\n');

  for (const entrypoint of new Set([
    ...Object.values('exports' in definition ? definition.exports : {}),
    ...Object.values('bin' in definition ? definition.bin : {}),
  ])) {
    await writeFile(join(packageRoot, entrypoint.replace(/^\.\//, '')), 'export {};\n');
  }

  for (const binPath of Object.values('bin' in definition ? definition.bin : {})) {
    await chmod(join(packageRoot, binPath.replace(/^\.\//, '')), 0o755);
  }

  if (packageName === '@tenkit/template-generator') {
    await mkdir(join(packageRoot, 'templates'), { recursive: true });
    await writeFile(join(packageRoot, 'templates/example.txt'), 'template\n');
  }

  const sourceMetadata = JSON.parse(
    await readFile(
      join(isolatedWorkspaceRoot, 'packages', definition.folder, 'package.json'),
      'utf8',
    ),
  ) as Record<string, unknown>;
  await writeFile(
    join(packageRoot, 'package.json'),
    `${JSON.stringify(
      {
        ...sourceMetadata,
        license: 'MIT',
        repository: {
          type: 'git',
          url: 'git+https://github.com/brilliantinsane/tenkit.git',
          directory: `packages/${definition.folder}`,
        },
        type: 'module',
        files: definition.files,
        ...('exports' in definition ? { exports: definition.exports } : {}),
        ...('bin' in definition ? { bin: definition.bin } : {}),
        ...('dependencies' in definition ? { dependencies: definition.dependencies } : {}),
        publishConfig: { access: 'public', provenance: true },
      },
      null,
      2,
    )}\n`,
  );
  const fixedDate = new Date('2026-01-01T00:00:00.000Z');

  async function normalizeTimes(path: string): Promise<void> {
    const entries = await readdir(path, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = join(path, entry.name);

      if (entry.isDirectory()) {
        await normalizeTimes(entryPath);
      }

      await utimes(entryPath, fixedDate, fixedDate);
    }
  }

  await normalizeTimes(packageRoot);
  await utimes(packageRoot, fixedDate, fixedDate);
  const tarPath = join(fixtureRoot, 'package.tar');
  execFileSync('tar', ['-cf', tarPath, 'package'], { cwd: fixtureRoot });
  await writeFile(join(artifactRoot, definition.artifact), gzipSync(await readFile(tarPath)));
}

describe('pack one deterministic Release Set', () => {
  test('emits byte-identical artifacts and equivalent manifests from the recorded source SHA', async () => {
    const sourceFixture = await createSourceFixture();
    const outputParent = await mkdtemp(join(tmpdir(), 'tenkit-release-output-'));
    tempRoots.push(outputParent);
    const commands: string[] = [];
    const verifyPackedReleaseSet = vi.fn(async () => {});
    const prepareIsolatedWorkspace = vi.fn(async ({ isolatedWorkspaceRoot }) => {
      await cp(sourceFixture, isolatedWorkspaceRoot, { recursive: true });
    });
    const runCommand = vi.fn(async ({ command, args, cwd }) => {
      const commandName = basename(command);
      commands.push(`${commandName} ${args.join(' ')}`);

      if (commandName === 'node') {
        return { stdout: '24.16.0\n', stderr: '' };
      }

      if (commandName === 'npm') {
        return { stdout: '11.16.0\n', stderr: '' };
      }

      if (commandName === 'pnpm' && args[0] === '--version') {
        return { stdout: '11.15.0\n', stderr: '' };
      }

      const filterIndex = args.indexOf('--filter');

      if (commandName === 'pnpm' && filterIndex >= 0 && args[filterIndex + 2] === 'pack') {
        const packageName = args[filterIndex + 1] as keyof typeof packageDefinitions;
        const destinationIndex = args.indexOf('--pack-destination');
        await writePackedFixture(cwd, args[destinationIndex + 1]!, packageName);
      }

      return { stdout: '', stderr: '' };
    });

    const results = [];

    for (const outputName of ['first', 'second']) {
      results.push(
        await packReleaseSet({
          repositoryRoot: '/moving-main-worktree',
          outputRoot: join(outputParent, outputName),
          plan,
          activeNodeVersion: '24.16.0',
          prepareIsolatedWorkspace,
          resolveToolExecutable: async () => process.execPath,
          runCommand,
          verifyPackedReleaseSet,
          now: () =>
            outputName === 'first'
              ? new Date('2026-07-20T12:00:00.000Z')
              : new Date('2026-07-20T12:01:00.000Z'),
        }),
      );
    }

    expect(prepareIsolatedWorkspace).toHaveBeenCalledTimes(2);
    expect(prepareIsolatedWorkspace).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ sourceSha: plan.sourceSha }),
    );
    expect(commands.indexOf('pnpm install --frozen-lockfile --ignore-scripts')).toBeGreaterThan(
      commands.indexOf('pnpm --version'),
    );
    expect(
      commands.filter((command) => command.includes(' pack --pack-destination ')),
    ).toHaveLength(6);
    expect(verifyPackedReleaseSet).toHaveBeenCalledTimes(2);

    for (const artifactIndex of [0, 1, 2]) {
      await expect(readFile(results[0]!.artifactPaths[artifactIndex]!)).resolves.toEqual(
        await readFile(results[1]!.artifactPaths[artifactIndex]!),
      );
    }

    const manifests = await Promise.all(
      results.map(async ({ manifestPath }) =>
        parseReleaseSetManifest(JSON.parse(await readFile(manifestPath, 'utf8'))),
      ),
    );
    expect({ ...manifests[0], createdAt: undefined }).toEqual({
      ...manifests[1],
      createdAt: undefined,
    });
    expect(manifests[0]!.sourceSha).toBe(plan.sourceSha);
    expect(manifests[0]!.packages.map(({ version }) => version)).toEqual([
      '0.3.0',
      '0.3.0',
      '0.3.0',
    ]);
    await expect(
      readdir(join(outputParent, 'first')).then((files) => files.sort()),
    ).resolves.toEqual([
      'create-tenkit-0.3.0.tgz',
      'release-set-0.3.0.json',
      'tenkit-cli-0.3.0.tgz',
      'tenkit-template-generator-0.3.0.tgz',
    ]);
  });

  test('extracts an immutable Git source without reading uncommitted release tooling', async () => {
    const isolatedRoot = await mkdtemp(join(tmpdir(), 'tenkit-release-git-archive-'));
    tempRoots.push(isolatedRoot);

    await prepareReleaseWorkspace({
      repositoryRoot,
      isolatedWorkspaceRoot: isolatedRoot,
      sourceSha: plan.sourceSha,
    });

    await expect(
      readFile(join(isolatedRoot, 'packages/cli/package.json'), 'utf8'),
    ).resolves.toContain('"name": "@tenkit/cli"');
    await expect(
      readFile(join(isolatedRoot, 'packages/release-tools/package.json'), 'utf8'),
    ).rejects.toThrow();
  });
});
