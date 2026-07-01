/// <reference types="node" />

import { tmpdir } from 'node:os';
import { assert, expect, test } from 'vitest';

import fs from 'fs-extra';
import { join } from 'pathe';

import { preflightWriteProject, validateVirtualFilePath, writeProject } from '../src/writer';
import { type VirtualFileTree } from '../src/virtual-file-tree';

async function createTempRoot(): Promise<string> {
  return fs.mkdtemp(join(tmpdir(), 'tenkit-template-writer-'));
}

test('writer writes a virtual file tree to a target folder', async () => {
  const targetDir = await createTempRoot();

  try {
    const result = await writeProject({
      targetDir,
      tree: [
        { path: 'package.json', contents: '{}\n' },
        { path: 'src/index.ts', contents: 'export {};\n' },
      ],
    });

    assert.deepEqual(result.filesWritten, ['package.json', 'src/index.ts']);
    assert.equal(await fs.readFile(join(targetDir, 'src/index.ts'), 'utf8'), 'export {};\n');
  } finally {
    await fs.remove(targetDir);
  }
});

test('writer rejects generated paths that can escape the target folder', async () => {
  const targetDir = await createTempRoot();
  const unsafeTrees: VirtualFileTree[] = [
    [{ path: '../outside.txt', contents: '' }],
    [{ path: '/tmp/outside.txt', contents: '' }],
    [{ path: 'src\\outside.ts', contents: '' }],
    [{ path: 'C:\\outside.txt', contents: '' }],
  ];

  try {
    for (const tree of unsafeTrees) {
      await expect(writeProject({ targetDir, tree })).rejects.toThrow(
        /relative|escapes|backslashes/,
      );
    }
  } finally {
    await fs.remove(targetDir);
  }
});

test('writer has explicit overwrite behavior for generated files', async () => {
  const targetDir = await createTempRoot();
  const tree = [{ path: 'README.md', contents: 'generated\n' }];

  try {
    await writeProject({ targetDir, tree });
    await expect(writeProject({ targetDir, tree, overwrite: 'never' })).rejects.toThrow(
      /Refusing to overwrite/,
    );

    const skipped = await writeProject({ targetDir, tree, overwrite: 'if-identical' });
    assert.deepEqual(skipped.filesSkipped, ['README.md']);

    await fs.writeFile(join(targetDir, 'README.md'), 'changed\n', 'utf8');
    await expect(writeProject({ targetDir, tree, overwrite: 'if-identical' })).rejects.toThrow(
      /Refusing to overwrite changed/,
    );

    await writeProject({ targetDir, tree, overwrite: 'always' });
    assert.equal(await fs.readFile(join(targetDir, 'README.md'), 'utf8'), 'generated\n');
  } finally {
    await fs.remove(targetDir);
  }
});

test('writer preflights existing file conflicts before writing generated files', async () => {
  const targetDir = await createTempRoot();

  try {
    await fs.ensureDir(join(targetDir, '.vscode'));
    await fs.writeFile(join(targetDir, 'package.json'), 'existing\n', 'utf8');

    await expect(
      writeProject({
        targetDir,
        tree: [
          { path: '.vscode/settings.json', contents: '{}\n' },
          { path: 'package.json', contents: '{}\n' },
        ],
      }),
    ).rejects.toThrow(/Refusing to overwrite/);

    assert.equal(await fs.pathExists(join(targetDir, '.vscode/settings.json')), false);
    assert.equal(await fs.readFile(join(targetDir, 'package.json'), 'utf8'), 'existing\n');
  } finally {
    await fs.remove(targetDir);
  }
});

test('writer rejects symlinked parent directories that escape the target before writing', async (t) => {
  const tempRoot = await createTempRoot();
  const targetDir = join(tempRoot, 'target');
  const outsideDir = join(tempRoot, 'outside');

  try {
    await fs.ensureDir(targetDir);
    await fs.ensureDir(outsideDir);

    try {
      await fs.symlink(outsideDir, join(targetDir, 'src'), 'dir');
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        ['EPERM', 'EACCES'].includes(String(error.code))
      ) {
        t.skip('filesystem does not allow creating directory symlinks');
        return;
      }

      throw error;
    }

    await expect(
      writeProject({
        targetDir,
        tree: [
          { path: 'README.md', contents: 'generated\n' },
          { path: 'src/index.ts', contents: 'export {};\n' },
        ],
      }),
    ).rejects.toThrow(/symlinked parent/);

    assert.equal(await fs.pathExists(join(targetDir, 'README.md')), false);
    assert.equal(await fs.pathExists(join(outsideDir, 'index.ts')), false);
  } finally {
    await fs.remove(tempRoot);
  }
});

test('writer validates duplicate normalized generated paths before writing', async () => {
  assert.equal(validateVirtualFilePath('src/../README.md'), 'README.md');

  const targetDir = await createTempRoot();

  try {
    await expect(
      writeProject({
        targetDir,
        tree: [
          { path: 'README.md', contents: 'one\n' },
          { path: 'src/../README.md', contents: 'two\n' },
        ],
      }),
    ).rejects.toThrow(/appears more than once/);
  } finally {
    await fs.remove(targetDir);
  }
});

test('writer rejects generated file and descendant path collisions before writing', async () => {
  const targetDir = await createTempRoot();

  try {
    await expect(
      writeProject({
        targetDir,
        tree: [
          { path: 'README.md', contents: 'generated\n' },
          { path: 'README.md/extra', contents: 'nested\n' },
        ],
      }),
    ).rejects.toThrow(/conflicts with descendant path/);

    assert.equal(await fs.pathExists(join(targetDir, 'README.md')), false);
  } finally {
    await fs.remove(targetDir);
  }
});

test('writer rejects targets inside protected project roots', async () => {
  const tempRoot = await createTempRoot();
  const playgroundDir = join(tempRoot, 'apps/playground');
  const targetDir = join(playgroundDir, 'generated-app');

  try {
    await expect(
      writeProject({
        targetDir,
        tree: [{ path: 'package.json', contents: '{}\n' }],
        forbiddenTargetRoots: [playgroundDir],
      }),
    ).rejects.toThrow(/protected project root/);

    assert.equal(await fs.pathExists(join(targetDir, 'package.json')), false);
  } finally {
    await fs.remove(tempRoot);
  }
});

test('writer preflight validates protected project roots without writing', async () => {
  const tempRoot = await createTempRoot();
  const playgroundDir = join(tempRoot, 'apps/playground');
  const targetDir = join(playgroundDir, 'generated-app');

  try {
    await expect(
      preflightWriteProject({
        targetDir,
        tree: [{ path: 'package.json', contents: '{}\n' }],
        forbiddenTargetRoots: [playgroundDir],
      }),
    ).rejects.toThrow(/protected project root/);

    assert.equal(await fs.pathExists(join(targetDir, 'package.json')), false);
  } finally {
    await fs.remove(tempRoot);
  }
});

test('writer preflight detects existing file conflicts without writing', async () => {
  const targetDir = await createTempRoot();

  try {
    await fs.writeFile(join(targetDir, 'package.json'), 'existing\n', 'utf8');

    await expect(
      preflightWriteProject({
        targetDir,
        tree: [{ path: 'package.json', contents: '{}\n' }],
      }),
    ).rejects.toThrow(/Refusing to overwrite/);

    assert.equal(await fs.readFile(join(targetDir, 'package.json'), 'utf8'), 'existing\n');
  } finally {
    await fs.remove(targetDir);
  }
});

test('writer rejects targets that resolve into protected project roots through symlinks', async (t) => {
  const tempRoot = await createTempRoot();
  const playgroundDir = join(tempRoot, 'apps/playground');
  const linkedPlaygroundDir = join(tempRoot, 'linked-playground');
  const targetDir = join(linkedPlaygroundDir, 'generated-app');

  try {
    await fs.ensureDir(playgroundDir);

    try {
      await fs.symlink(playgroundDir, linkedPlaygroundDir, 'dir');
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        ['EPERM', 'EACCES'].includes(String(error.code))
      ) {
        t.skip('filesystem does not allow creating directory symlinks');
        return;
      }

      throw error;
    }

    await expect(
      writeProject({
        targetDir,
        tree: [{ path: 'package.json', contents: '{}\n' }],
        forbiddenTargetRoots: [playgroundDir],
      }),
    ).rejects.toThrow(/protected project root/);

    assert.equal(await fs.pathExists(join(playgroundDir, 'generated-app/package.json')), false);
  } finally {
    await fs.remove(tempRoot);
  }
});
