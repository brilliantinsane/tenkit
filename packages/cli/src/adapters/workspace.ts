import { fileURLToPath } from 'node:url';

import fs from 'fs-extra';
import { dirname, resolve } from 'pathe';

type PackageJsonShape = {
  name?: unknown;
};

function isPackageJsonShape(value: unknown): value is PackageJsonShape {
  return typeof value === 'object' && value !== null;
}

export async function findTenkitWorkspaceRoot(startUrl: string): Promise<string | undefined> {
  let current = dirname(fileURLToPath(startUrl));

  while (true) {
    const packageJsonPath = resolve(current, 'package.json');

    if (await fs.pathExists(packageJsonPath)) {
      const packageJson: unknown = await fs.readJson(packageJsonPath);

      if (isPackageJsonShape(packageJson) && packageJson.name === 'tenkit-workspace') {
        return current;
      }
    }

    const parent = dirname(current);

    if (parent === current) {
      return undefined;
    }

    current = parent;
  }
}

export function isDirectCliRun(entryUrl: string, argvEntry: string | undefined): boolean {
  if (!argvEntry) {
    return false;
  }

  return resolveRealPath(fileURLToPath(entryUrl)) === resolveRealPath(argvEntry);
}

function resolveRealPath(path: string): string {
  try {
    return fs.realpathSync(path);
  } catch {
    return resolve(path);
  }
}
