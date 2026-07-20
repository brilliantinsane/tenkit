import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { runReleaseCommand } from '../src/pack-release-set';
import { inspectPackedReleasePackage } from '../src/packed-release-package';
import { verifyPackedReleaseSet } from '../src/packed-release-smoke';
import { RELEASE_SET_PACKAGES } from '../src/release-set';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const smokeRoot = await mkdtemp(join(tmpdir(), 'tenkit-current-release-smoke-'));
const artifactRoot = join(smokeRoot, 'artifacts');

try {
  await mkdir(artifactRoot);

  const versions = await Promise.all(
    RELEASE_SET_PACKAGES.map(async (releasePackage) => {
      const metadata: unknown = JSON.parse(
        await readFile(join(repositoryRoot, releasePackage.root, 'package.json'), 'utf8'),
      );

      if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        throw new Error(`Unable to read ${releasePackage.name} version.`);
      }

      const version = (metadata as Record<string, unknown>).version;

      if (typeof version !== 'string') {
        throw new Error(`Unable to read ${releasePackage.name} version.`);
      }

      return version;
    }),
  );
  const [releaseVersion] = versions;

  if (!releaseVersion || versions.some((version) => version !== releaseVersion)) {
    throw new Error('Current package manifests do not contain one Release Set version.');
  }

  for (const releasePackage of RELEASE_SET_PACKAGES) {
    await runReleaseCommand({
      command: 'pnpm',
      args: ['--filter', releasePackage.name, 'pack', '--pack-destination', artifactRoot],
      cwd: repositoryRoot,
    });
  }

  const artifactPaths = RELEASE_SET_PACKAGES.map((releasePackage) =>
    join(artifactRoot, `${releasePackage.artifactPrefix}-${releaseVersion}.tgz`),
  );

  for (const [index, releasePackage] of RELEASE_SET_PACKAGES.entries()) {
    await inspectPackedReleasePackage({
      artifactPath: artifactPaths[index]!,
      expectedName: releasePackage.name,
      expectedVersion: releaseVersion,
      forbiddenPathFragments: [repositoryRoot, smokeRoot],
    });
  }

  await verifyPackedReleaseSet({
    artifactPaths,
    expectedVersion: releaseVersion,
    runCommand: runReleaseCommand,
  });
  process.stdout.write('Current packed Release Set smoke passed 3 representative create flows.\n');
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await rm(smokeRoot, { recursive: true });
}
