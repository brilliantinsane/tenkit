import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, relative } from 'node:path';
import { promisify } from 'node:util';

import type { PackedReleasePackage } from './release-set-manifest';
import {
  getReleaseSetPackage,
  type ReleaseSetPackage,
  type ReleaseSetPackageName,
} from './release-set';

const execFileAsync = promisify(execFile);

type ReleasePackagePolicy = {
  allowedContentPatterns: readonly RegExp[];
  files: readonly string[];
  exports?: Readonly<Record<string, string>>;
  bin?: Readonly<Record<string, string>>;
};

const RELEASE_PACKAGE_POLICIES = {
  '@tenkit/template-generator': {
    allowedContentPatterns: [
      /^templates\/.+/,
      /^dist\/(?:index|generator|generated-setup-type-definitions|generated-styling-choices|writer|local-proof)\.(?:mjs|d\.mts)$/,
      /^dist\/(?:generator-[A-Za-z0-9_-]+\.mjs|(?:generator|generated-setup-type-definitions|generated-styling-choices|virtual-file-tree)-[A-Za-z0-9_-]+\.d\.mts)$/,
    ],
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
    allowedContentPatterns: [/^dist\/index\.(?:mjs|d\.mts)$/],
    files: ['dist', 'package.json', 'README.md'],
    exports: { '.': './dist/index.mjs' },
    bin: { tenkit: './dist/index.mjs' },
  },
  'create-tenkit': {
    allowedContentPatterns: [/^dist\/index\.(?:mjs|d\.mts)$/],
    files: ['dist', 'package.json', 'README.md'],
    bin: { 'create-tenkit': './dist/index.mjs' },
  },
} as const satisfies Record<ReleaseSetPackageName, ReleasePackagePolicy>;

type InspectPackedReleasePackageInput = {
  artifactPath: string;
  expectedName: ReleaseSetPackageName;
  expectedVersion: string;
  forbiddenPathFragments?: readonly string[];
};

type AssertPackedReleasePackageMatchesInput = {
  artifactPath: string;
  expected: PackedReleasePackage;
};

function record(value: unknown, description: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${description} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function stringRecord(value: unknown, description: string): Record<string, string> {
  const object = record(value, description);

  for (const [key, entry] of Object.entries(object)) {
    if (typeof entry !== 'string') {
      throw new Error(`${description} entry ${key} must be a string.`);
    }
  }

  return object as Record<string, string>;
}

function assertRecordEquals(
  actualValue: unknown,
  expected: Readonly<Record<string, string>>,
  description: string,
): void {
  const actual = stringRecord(actualValue, description);

  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${description} expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}.`,
    );
  }
}

function artifactDigests(bytes: Buffer): Pick<PackedReleasePackage, 'integrity' | 'shasum'> {
  return {
    integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
    shasum: createHash('sha1').update(bytes).digest('hex'),
  };
}

function validateTarEntries(entries: readonly string[], packageName: string): void {
  for (const entry of entries) {
    const path = entry.replace(/\/$/, '');

    if (!path || path === 'package') {
      continue;
    }

    if (
      !path.startsWith('package/') ||
      path.startsWith('/') ||
      path.split('/').some((segment) => segment === '..')
    ) {
      throw new Error(`${packageName} tarball contains unsafe path ${entry}.`);
    }
  }
}

async function listExtractedFiles(packageRoot: string, packageName: string): Promise<string[]> {
  const files: string[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const path = join(directory, entry.name);
      const relativePath = relative(packageRoot, path).replaceAll('\\', '/');
      const stats = await lstat(path);

      if (stats.isSymbolicLink()) {
        throw new Error(`${packageName} contains forbidden symbolic link ${relativePath}.`);
      }

      if (stats.isDirectory()) {
        await visit(path);
      } else if (stats.isFile()) {
        files.push(relativePath);
      } else {
        throw new Error(`${packageName} contains unsupported entry ${relativePath}.`);
      }
    }
  }

  await visit(packageRoot);
  return files.sort();
}

function assertExpectedFiles(
  files: readonly string[],
  packageName: string,
  policy: ReleasePackagePolicy,
): void {
  for (const file of files) {
    const filename = file.split('/').at(-1) ?? '';
    const isEnvironmentFile =
      filename === '.env' || (filename.startsWith('.env.') && !filename.startsWith('.env.example'));

    if (isEnvironmentFile || /^(?:\.npmrc|[^/]+\.(?:key|pem))$/.test(filename)) {
      throw new Error(`${packageName} contains forbidden file ${file}.`);
    }

    if (
      file !== 'package.json' &&
      file !== 'README.md' &&
      file !== 'LICENSE' &&
      !policy.allowedContentPatterns.some((pattern) => pattern.test(file))
    ) {
      throw new Error(`${packageName} contains unexpected file ${file}.`);
    }
  }

  for (const binPath of Object.values(policy.bin ?? {})) {
    const normalizedBinPath = binPath.replace(/^\.\//, '');

    if (!files.includes(normalizedBinPath)) {
      throw new Error(`${packageName} is missing executable entrypoint ${normalizedBinPath}.`);
    }
  }

  for (const requiredFile of [
    'package.json',
    'README.md',
    'LICENSE',
    ...Object.values(policy.exports ?? {}),
  ]) {
    const normalizedRequiredFile = requiredFile.replace(/^\.\//, '');

    if (!files.includes(normalizedRequiredFile)) {
      throw new Error(`${packageName} is missing exported entrypoint ${normalizedRequiredFile}.`);
    }
  }
}

async function assertExecutableEntrypoints(
  packageRoot: string,
  packageName: string,
  policy: ReleasePackagePolicy,
): Promise<void> {
  for (const binPath of Object.values(policy.bin ?? {})) {
    const normalizedBinPath = binPath.replace(/^\.\//, '');
    const stats = await lstat(join(packageRoot, normalizedBinPath));

    if ((stats.mode & 0o111) === 0) {
      throw new Error(
        `${packageName} executable entrypoint ${normalizedBinPath} is not executable.`,
      );
    }
  }
}

function assertPackageMetadata(
  metadata: Record<string, unknown>,
  expectedName: ReleaseSetPackageName,
  expectedVersion: string,
  policy: ReleasePackagePolicy,
  releasePackage: ReleaseSetPackage,
): PackedReleasePackage['internalDependencies'] {
  if (metadata.name !== expectedName) {
    throw new Error(
      `${expectedName} package name expected ${expectedName}, found ${String(metadata.name)}.`,
    );
  }

  if (metadata.version !== expectedVersion) {
    throw new Error(
      `${expectedName} package version expected ${expectedVersion}, found ${String(metadata.version)}.`,
    );
  }

  if (metadata.private === true || metadata.license !== 'MIT' || metadata.type !== 'module') {
    throw new Error(`${expectedName} publication metadata is invalid.`);
  }

  const repository = record(metadata.repository, `${expectedName} repository metadata`);

  if (
    repository.type !== 'git' ||
    repository.url !== 'git+https://github.com/brilliantinsane/tenkit.git' ||
    repository.directory !== releasePackage.root
  ) {
    throw new Error(`${expectedName} repository metadata is invalid.`);
  }

  const publishConfig = record(metadata.publishConfig, `${expectedName} publishConfig`);

  if (publishConfig.access !== 'public' || publishConfig.provenance !== true) {
    throw new Error(`${expectedName} must publish publicly with provenance enabled.`);
  }

  if (
    !Array.isArray(metadata.files) ||
    JSON.stringify(metadata.files) !== JSON.stringify(policy.files)
  ) {
    throw new Error(`${expectedName} package files declaration is invalid.`);
  }

  if (policy.exports) {
    assertRecordEquals(metadata.exports, policy.exports, `${expectedName} exports`);
  } else if (metadata.exports !== undefined) {
    throw new Error(`${expectedName} must not declare package exports.`);
  }

  if (policy.bin) {
    assertRecordEquals(metadata.bin, policy.bin, `${expectedName} executable declarations`);
  } else if (metadata.bin !== undefined) {
    throw new Error(`${expectedName} must not declare an executable.`);
  }

  const dependencySections = ['dependencies', 'optionalDependencies', 'peerDependencies'] as const;

  for (const section of dependencySections) {
    if (metadata[section] === undefined) {
      continue;
    }

    const dependencies = stringRecord(metadata[section], `${expectedName} ${section}`);

    for (const [dependencyName, dependencyVersion] of Object.entries(dependencies)) {
      if (
        section === 'dependencies' &&
        'internalDependency' in releasePackage &&
        dependencyName === releasePackage.internalDependency
      ) {
        continue;
      }

      if (dependencyVersion.startsWith('workspace:')) {
        throw new Error(
          `${expectedName} dependency ${dependencyName} must not use ${dependencyVersion} in a packed artifact.`,
        );
      }
    }
  }

  if (!('internalDependency' in releasePackage)) {
    return [];
  }

  const dependencies = stringRecord(metadata.dependencies, `${expectedName} dependencies`);
  const internalDependencyVersion = dependencies[releasePackage.internalDependency];

  if (internalDependencyVersion !== expectedVersion) {
    throw new Error(
      `${expectedName} dependency ${releasePackage.internalDependency} expected ${expectedVersion}, found ${internalDependencyVersion ?? 'missing'}.`,
    );
  }

  return [{ name: releasePackage.internalDependency, version: expectedVersion }];
}

export async function inspectPackedReleasePackage(
  input: InspectPackedReleasePackageInput,
): Promise<PackedReleasePackage> {
  const policy = RELEASE_PACKAGE_POLICIES[input.expectedName];
  const releasePackage = getReleaseSetPackage(input.expectedName);
  const expectedFilename = `${releasePackage.artifactPrefix}-${input.expectedVersion}.tgz`;
  const artifactFilename = basename(input.artifactPath);

  if (artifactFilename !== expectedFilename) {
    throw new Error(
      `${input.expectedName} artifact expected ${expectedFilename}, found ${artifactFilename}.`,
    );
  }

  const bytes = await readFile(input.artifactPath);
  const extractionRoot = await mkdtemp(join(tmpdir(), 'tenkit-release-artifact-'));

  try {
    const { stdout: entryOutput } = await execFileAsync('tar', ['-tzf', input.artifactPath], {
      encoding: 'utf8',
    });
    validateTarEntries(entryOutput.split('\n').filter(Boolean), input.expectedName);
    await execFileAsync('tar', ['-xzf', input.artifactPath, '-C', extractionRoot]);
    const packageRoot = join(extractionRoot, 'package');
    const files = await listExtractedFiles(packageRoot, input.expectedName);
    assertExpectedFiles(files, input.expectedName, policy);
    await assertExecutableEntrypoints(packageRoot, input.expectedName, policy);
    const packageJsonPath = join(packageRoot, 'package.json');
    const packageJsonContents = await readFile(packageJsonPath, 'utf8');

    for (const forbiddenPathFragment of input.forbiddenPathFragments ?? []) {
      if (!forbiddenPathFragment) {
        continue;
      }

      const forbiddenBytes = Buffer.from(forbiddenPathFragment);

      for (const file of files) {
        if ((await readFile(join(packageRoot, file))).includes(forbiddenBytes)) {
          throw new Error(`${input.expectedName} contains a forbidden local path in ${file}.`);
        }
      }
    }

    const metadata: unknown = JSON.parse(packageJsonContents);
    const internalDependencies = assertPackageMetadata(
      record(metadata, `${input.expectedName} package metadata`),
      input.expectedName,
      input.expectedVersion,
      policy,
      releasePackage,
    );

    return {
      name: input.expectedName,
      root: releasePackage.root,
      version: input.expectedVersion,
      artifactFilename,
      size: bytes.byteLength,
      ...artifactDigests(bytes),
      internalDependencies,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error(`Unable to inspect ${input.expectedName} artifact.`);
  } finally {
    await rm(extractionRoot, { recursive: true });
  }
}

export async function assertPackedReleasePackageMatches(
  input: AssertPackedReleasePackageMatchesInput,
): Promise<void> {
  const bytes = await readFile(input.artifactPath);
  const digests = artifactDigests(bytes);

  if (digests.shasum !== input.expected.shasum) {
    throw new Error(
      `${input.expected.artifactFilename} shasum mismatch: expected ${input.expected.shasum}, found ${digests.shasum}.`,
    );
  }

  if (digests.integrity !== input.expected.integrity) {
    throw new Error(`${input.expected.artifactFilename} integrity mismatch.`);
  }

  if (bytes.byteLength !== input.expected.size) {
    throw new Error(`${input.expected.artifactFilename} size mismatch.`);
  }

  const inspected = await inspectPackedReleasePackage({
    artifactPath: input.artifactPath,
    expectedName: getReleaseSetPackage(input.expected.name).name,
    expectedVersion: input.expected.version,
  });

  if (JSON.stringify(inspected) !== JSON.stringify(input.expected)) {
    throw new Error(`${input.expected.artifactFilename} package metadata mismatch.`);
  }
}
