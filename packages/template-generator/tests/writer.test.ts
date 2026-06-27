/// <reference types="node" />

import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import test from 'node:test';

import fs from 'fs-extra';
import { join } from 'pathe';

import { validateVirtualFilePath, writeProject } from '../src/writer';
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
      await assert.rejects(() => writeProject({ targetDir, tree }), /relative|escapes|backslashes/);
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
    await assert.rejects(
      () => writeProject({ targetDir, tree, overwrite: 'never' }),
      /Refusing to overwrite/,
    );

    const skipped = await writeProject({ targetDir, tree, overwrite: 'if-identical' });
    assert.deepEqual(skipped.filesSkipped, ['README.md']);

    await fs.writeFile(join(targetDir, 'README.md'), 'changed\n', 'utf8');
    await assert.rejects(
      () => writeProject({ targetDir, tree, overwrite: 'if-identical' }),
      /Refusing to overwrite changed/,
    );

    await writeProject({ targetDir, tree, overwrite: 'always' });
    assert.equal(await fs.readFile(join(targetDir, 'README.md'), 'utf8'), 'generated\n');
  } finally {
    await fs.remove(targetDir);
  }
});

test('writer validates duplicate normalized generated paths before writing', async () => {
  assert.equal(validateVirtualFilePath('src/../README.md'), 'README.md');

  const targetDir = await createTempRoot();

  try {
    await assert.rejects(
      () =>
        writeProject({
          targetDir,
          tree: [
            { path: 'README.md', contents: 'one\n' },
            { path: 'src/../README.md', contents: 'two\n' },
          ],
        }),
      /appears more than once/,
    );
  } finally {
    await fs.remove(targetDir);
  }
});

test('writer rejects targets inside protected project roots', async () => {
  const tempRoot = await createTempRoot();
  const playgroundDir = join(tempRoot, 'apps/playground');
  const targetDir = join(playgroundDir, 'generated-app');

  try {
    await assert.rejects(
      () =>
        writeProject({
          targetDir,
          tree: [{ path: 'package.json', contents: '{}\n' }],
          forbiddenTargetRoots: [playgroundDir],
        }),
      /protected project root/,
    );

    assert.equal(await fs.pathExists(join(targetDir, 'package.json')), false);
  } finally {
    await fs.remove(tempRoot);
  }
});
