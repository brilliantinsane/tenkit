import { execFileSync } from 'node:child_process';
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import {
  assertPackedReleasePackageMatches,
  inspectPackedReleasePackage,
} from '../src/packed-release-package';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((tempRoot) => rm(tempRoot, { recursive: true })));
});

async function packCliFixture(
  mutate?: (packageRoot: string, metadata: Record<string, unknown>) => Promise<void> | void,
): Promise<string> {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'tenkit-packed-release-package-'));
  tempRoots.push(fixtureRoot);
  const packageRoot = join(fixtureRoot, 'package');
  const distRoot = join(packageRoot, 'dist');
  await mkdir(distRoot, { recursive: true });
  const metadata: Record<string, unknown> = {
    name: '@tenkit/cli',
    version: '0.3.0',
    license: 'MIT',
    repository: {
      type: 'git',
      url: 'git+https://github.com/brilliantinsane/tenkit.git',
      directory: 'packages/cli',
    },
    type: 'module',
    bin: { tenkit: './dist/index.mjs' },
    exports: { '.': './dist/index.mjs' },
    files: ['dist', 'package.json', 'README.md'],
    dependencies: { '@tenkit/template-generator': '0.3.0' },
    publishConfig: { access: 'public', provenance: true },
  };
  await writeFile(join(packageRoot, 'README.md'), '# Tenkit CLI\n');
  await writeFile(join(packageRoot, 'LICENSE'), 'MIT License\n');
  await writeFile(join(distRoot, 'index.mjs'), 'console.log("0.3.0");\n');
  await chmod(join(distRoot, 'index.mjs'), 0o755);
  await mutate?.(packageRoot, metadata);
  await writeFile(join(packageRoot, 'package.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  const artifactPath = join(fixtureRoot, 'tenkit-cli-0.3.0.tgz');
  execFileSync('tar', ['-czf', artifactPath, 'package'], { cwd: fixtureRoot });
  return artifactPath;
}

describe('packed Release Set package acceptance', () => {
  test('accepts the exact Public CLI package contract and records its immutable digests', async () => {
    const artifactPath = await packCliFixture();

    await expect(
      inspectPackedReleasePackage({
        artifactPath,
        expectedName: '@tenkit/cli',
        expectedVersion: '0.3.0',
      }),
    ).resolves.toEqual({
      name: '@tenkit/cli',
      root: 'packages/cli',
      version: '0.3.0',
      artifactFilename: 'tenkit-cli-0.3.0.tgz',
      size: expect.any(Number),
      integrity: expect.stringMatching(/^sha512-/),
      shasum: expect.stringMatching(/^[0-9a-f]{40}$/),
      internalDependencies: [{ name: '@tenkit/template-generator', version: '0.3.0' }],
    });
  });

  test.each([
    [
      'version',
      async (_packageRoot: string, metadata: Record<string, unknown>) => {
        metadata.version = '0.2.0';
      },
      /@tenkit\/cli package version expected 0\.3\.0, found 0\.2\.0/,
    ],
    [
      'internal dependency',
      async (_packageRoot: string, metadata: Record<string, unknown>) => {
        metadata.dependencies = { '@tenkit/template-generator': 'workspace:*' };
      },
      /@tenkit\/cli dependency @tenkit\/template-generator expected 0\.3\.0, found workspace:\*/,
    ],
    [
      'entrypoint',
      async (packageRoot: string) => {
        await rm(join(packageRoot, 'dist/index.mjs'));
      },
      /@tenkit\/cli is missing executable entrypoint dist\/index\.mjs/,
    ],
    [
      'executable mode',
      async (packageRoot: string) => {
        await chmod(join(packageRoot, 'dist/index.mjs'), 0o644);
      },
      /@tenkit\/cli executable entrypoint dist\/index\.mjs is not executable/,
    ],
    [
      'expected file',
      async (packageRoot: string) => {
        await rm(join(packageRoot, 'README.md'));
      },
      /@tenkit\/cli is missing exported entrypoint README\.md/,
    ],
    [
      'unexpected file',
      async (packageRoot: string) => {
        await writeFile(join(packageRoot, '.env'), 'NPM_TOKEN=secret\n');
      },
      /@tenkit\/cli contains forbidden file \.env/,
    ],
    [
      'unexpected distribution file',
      async (packageRoot: string) => {
        await writeFile(join(packageRoot, 'dist/unexpected.mjs'), 'export {};\n');
      },
      /@tenkit\/cli contains unexpected file dist\/unexpected\.mjs/,
    ],
  ] as const)(
    'rejects an altered %s with a precise diagnostic',
    async (_label, mutate, message) => {
      const artifactPath = await packCliFixture(mutate);

      await expect(
        inspectPackedReleasePackage({
          artifactPath,
          expectedName: '@tenkit/cli',
          expectedVersion: '0.3.0',
        }),
      ).rejects.toThrow(message);
    },
  );

  test('rejects a one-byte artifact change after manifest identity was recorded', async () => {
    const artifactPath = await packCliFixture();
    const acceptedPackage = await inspectPackedReleasePackage({
      artifactPath,
      expectedName: '@tenkit/cli',
      expectedVersion: '0.3.0',
    });
    const bytes = await readFile(artifactPath);
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 1;
    await writeFile(artifactPath, bytes);

    await expect(
      assertPackedReleasePackageMatches({ artifactPath, expected: acceptedPackage }),
    ).rejects.toThrow(/tenkit-cli-0\.3\.0\.tgz shasum mismatch/);
  });

  test('rejects a local build path embedded anywhere in package contents', async () => {
    const artifactPath = await packCliFixture(async (packageRoot) => {
      await writeFile(
        join(packageRoot, 'dist/index.mjs'),
        'const source = "/private/build/source";\n',
      );
    });

    await expect(
      inspectPackedReleasePackage({
        artifactPath,
        expectedName: '@tenkit/cli',
        expectedVersion: '0.3.0',
        forbiddenPathFragments: ['/private/build/source'],
      }),
    ).rejects.toThrow(/forbidden local path in dist\/index\.mjs/);
  });
});
