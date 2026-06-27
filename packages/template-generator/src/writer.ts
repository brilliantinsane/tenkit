import fs from 'fs-extra';
import { dirname, isAbsolute, normalize, resolve, sep } from 'pathe';

import { type VirtualFile, type VirtualFileTree } from './virtual-file-tree';

export type WriteProjectOverwriteMode = 'never' | 'if-identical' | 'always';

export type WriteProjectOptions = {
  targetDir: string;
  tree: VirtualFileTree;
  overwrite?: WriteProjectOverwriteMode;
  forbiddenTargetRoots?: readonly string[];
};

export type WriteProjectResult = {
  targetDir: string;
  filesWritten: string[];
  filesSkipped: string[];
};

type WriteTarget = {
  file: VirtualFile;
  relativePath: string;
  path: string;
  outcome: 'written' | 'skipped';
};

function isWindowsAbsolutePath(path: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(path);
}

function isSameOrInside(path: string, parent: string): boolean {
  const resolvedPath = resolve(path);
  const resolvedParent = resolve(parent);

  return resolvedPath === resolvedParent || resolvedPath.startsWith(`${resolvedParent}${sep}`);
}

export function validateVirtualFilePath(path: string): string {
  if (typeof path !== 'string' || path.trim() === '') {
    throw new Error('Generated file path must be a non-empty relative path.');
  }

  if (path.includes('\0')) {
    throw new Error(`Generated file path ${JSON.stringify(path)} contains a null byte.`);
  }

  if (path.includes('\\')) {
    throw new Error(
      `Generated file path ${JSON.stringify(path)} must use forward slashes, not backslashes.`,
    );
  }

  if (isAbsolute(path) || isWindowsAbsolutePath(path)) {
    throw new Error(`Generated file path ${JSON.stringify(path)} must be relative.`);
  }

  const normalized = normalize(path);

  if (normalized === '.' || normalized.startsWith('../') || normalized === '..') {
    throw new Error(`Generated file path ${JSON.stringify(path)} escapes the target folder.`);
  }

  return normalized;
}

function resolveTargetPath(
  targetDir: string,
  file: VirtualFile,
): { relativePath: string; path: string } {
  const root = resolve(targetDir);
  const relativePath = validateVirtualFilePath(file.path);
  const targetPath = resolve(root, ...relativePath.split('/'));

  if (targetPath !== root && !targetPath.startsWith(`${root}${sep}`)) {
    throw new Error(`Generated file path ${JSON.stringify(file.path)} escapes the target folder.`);
  }

  return { relativePath, path: targetPath };
}

async function pathExists(path: string): Promise<boolean> {
  return fs.pathExists(path);
}

async function assertTargetDirectory(targetDir: string) {
  if (!(await pathExists(targetDir))) {
    return;
  }

  const targetStats = await fs.stat(targetDir);

  if (!targetStats.isDirectory()) {
    throw new Error(`Generated project target ${targetDir} exists but is not a directory.`);
  }
}

function assertTargetIsAllowed(targetDir: string, forbiddenTargetRoots: readonly string[] = []) {
  for (const forbiddenRoot of forbiddenTargetRoots) {
    if (isSameOrInside(targetDir, forbiddenRoot)) {
      throw new Error(
        `Generated project target ${resolve(targetDir)} must not be inside protected project root ${resolve(forbiddenRoot)}.`,
      );
    }
  }
}

function assertNoDuplicatePaths(tree: VirtualFileTree) {
  const seen = new Set<string>();

  for (const file of tree) {
    const relativePath = validateVirtualFilePath(file.path);

    if (seen.has(relativePath)) {
      throw new Error(
        `Generated file path ${JSON.stringify(relativePath)} appears more than once.`,
      );
    }

    seen.add(relativePath);
  }
}

async function planVirtualFileWrite({
  file,
  targetDir,
  overwrite,
}: {
  file: VirtualFile;
  targetDir: string;
  overwrite: WriteProjectOverwriteMode;
}): Promise<WriteTarget> {
  const target = resolveTargetPath(targetDir, file);

  if (await pathExists(target.path)) {
    const targetStats = await fs.stat(target.path);

    if (targetStats.isDirectory()) {
      throw new Error(`Generated project file ${target.relativePath} exists as a directory.`);
    }

    if (overwrite === 'never') {
      throw new Error(
        `Refusing to overwrite existing generated project file ${target.relativePath}. Use overwrite: "always" to replace it.`,
      );
    }

    if (overwrite === 'if-identical') {
      const existingContents =
        typeof file.contents === 'string'
          ? await fs.readFile(target.path, 'utf8')
          : await fs.readFile(target.path);

      if (
        typeof file.contents === 'string'
          ? existingContents !== file.contents
          : !Buffer.from(existingContents).equals(Buffer.from(file.contents))
      ) {
        throw new Error(
          `Refusing to overwrite changed generated project file ${target.relativePath}.`,
        );
      }

      return { ...target, file, outcome: 'skipped' };
    }
  }

  return { ...target, file, outcome: 'written' };
}

async function writeVirtualFile(target: WriteTarget): Promise<void> {
  await fs.ensureDir(dirname(target.path));
  await fs.writeFile(target.path, target.file.contents);
}

export async function writeProject(options: WriteProjectOptions): Promise<WriteProjectResult> {
  const overwrite = options.overwrite ?? 'never';

  assertNoDuplicatePaths(options.tree);
  assertTargetIsAllowed(options.targetDir, options.forbiddenTargetRoots);
  await assertTargetDirectory(options.targetDir);

  const targets: WriteTarget[] = [];

  for (const file of options.tree) {
    targets.push(await planVirtualFileWrite({ file, targetDir: options.targetDir, overwrite }));
  }

  const result: WriteProjectResult = {
    targetDir: resolve(options.targetDir),
    filesWritten: [],
    filesSkipped: [],
  };

  for (const target of targets) {
    if (target.outcome === 'written') {
      await writeVirtualFile(target);
      result.filesWritten.push(target.relativePath);
    } else {
      result.filesSkipped.push(target.relativePath);
    }
  }

  return result;
}
