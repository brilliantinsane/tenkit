import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, expect, test } from 'vitest';

import { inspectPackedReleasePackage } from '../src/packed-release-package';
import { createReleaseSetManifest } from '../src/release-set-manifest';
import type { ReleaseSetPlan } from '../src/release-plan';
import { RELEASE_SET_PACKAGES } from '../src/release-set';
import { readPinnedReleaseToolchain } from '../src/release-toolchain';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((tempRoot) => rm(tempRoot, { recursive: true })));
});

function run(command: string, args: readonly string[]): string {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    env: { ...process.env, INIT_CWD: repositoryRoot },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    const diagnostic = `${result.stdout}\n${result.stderr}`
      .replaceAll(repositoryRoot, '<repository>')
      .trim();
    throw new Error(`${command} ${args.join(' ')} failed: ${diagnostic}`);
  }

  return result.stdout.trim();
}

test(
  'actual package builds from one recorded source produce byte-identical Release Set artifacts',
  { timeout: 30_000 },
  async () => {
    const sourceSha = run('git', ['rev-parse', 'HEAD']);
    run('git', [
      'diff',
      '--quiet',
      sourceSha,
      '--',
      ...RELEASE_SET_PACKAGES.map(({ root }) => root),
    ]);
    const versions = await Promise.all(
      RELEASE_SET_PACKAGES.map(async ({ root }) => {
        const metadata: unknown = JSON.parse(
          await readFile(join(repositoryRoot, root, 'package.json'), 'utf8'),
        );

        if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
          throw new Error(`Package metadata for ${root} must be an object.`);
        }

        const version = (metadata as Record<string, unknown>).version;

        if (typeof version !== 'string') {
          throw new Error(`Package metadata for ${root} must contain a version.`);
        }

        return version;
      }),
    );
    const [version] = versions;

    if (!version || versions.some((candidate) => candidate !== version)) {
      throw new Error('Public package sources must contain one Release Set version.');
    }

    const packRoots: string[] = [];

    for (const label of ['first', 'second']) {
      const packRoot = await mkdtemp(join(tmpdir(), `tenkit-actual-pack-${label}-`));
      tempRoots.push(packRoot);

      for (const releasePackage of RELEASE_SET_PACKAGES) {
        run('pnpm', ['--filter', releasePackage.name, 'pack', '--pack-destination', packRoot]);
      }

      packRoots.push(packRoot);
    }

    for (const releasePackage of RELEASE_SET_PACKAGES) {
      const filename = `${releasePackage.artifactPrefix}-${version}.tgz`;
      await expect(readFile(join(packRoots[0]!, filename))).resolves.toEqual(
        await readFile(join(packRoots[1]!, filename)),
      );
    }

    const plan = {
      kind: 'release',
      sourceSha,
      previousStableTag: {
        name: 'v0.2.0',
        version: '0.2.0',
        sha: run('git', ['rev-list', '-n', '1', 'v0.2.0']),
      },
      version,
      contributingCommits: [
        {
          sha: sourceSha,
          title: 'test(release-set): prove deterministic artifacts',
          paths: ['packages/cli/package.json'],
          impact: 'patch',
        },
      ],
    } satisfies Extract<ReleaseSetPlan, { kind: 'release' }>;
    const toolchain = await readPinnedReleaseToolchain(repositoryRoot);
    const manifests = await Promise.all(
      packRoots.map(async (packRoot, index) =>
        createReleaseSetManifest({
          plan,
          toolchain,
          createdAt: `2026-07-20T12:0${index}:00.000Z`,
          packedPackages: await Promise.all(
            RELEASE_SET_PACKAGES.map((releasePackage) =>
              inspectPackedReleasePackage({
                artifactPath: join(packRoot, `${releasePackage.artifactPrefix}-${version}.tgz`),
                expectedName: releasePackage.name,
                expectedVersion: version,
                forbiddenPathFragments: [repositoryRoot, packRoot],
              }),
            ),
          ),
        }),
      ),
    );

    expect({ ...manifests[0], createdAt: undefined }).toEqual({
      ...manifests[1],
      createdAt: undefined,
    });
  },
);
