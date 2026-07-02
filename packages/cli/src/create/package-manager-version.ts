import { tmpdir } from 'node:os';

import fs from 'fs-extra';
import { join } from 'pathe';

import type { PublicCliPackageManager } from './package-manager';
import type { RunCommand } from './types';

type PackageJsonObject = Record<string, unknown>;

export async function setGeneratedPackageManagerVersion({
  targetDir,
  packageManager,
  runCommand,
}: {
  targetDir: string;
  packageManager: PublicCliPackageManager;
  runCommand: RunCommand;
}): Promise<void> {
  const packageJsonPath = join(targetDir, 'package.json');

  if (!(await fs.pathExists(packageJsonPath))) {
    return;
  }

  const versionResult = await runCommand(packageManager, ['--version'], tmpdir(), {
    stdio: 'pipe',
  });
  const packageJson: unknown = await fs.readJson(packageJsonPath);

  if (!isPackageJsonObject(packageJson)) {
    throw new Error(`Generated package.json at ${packageJsonPath} must contain an object.`);
  }

  if (versionResult.ok) {
    const version = versionResult.stdout?.trim();

    if (version) {
      packageJson.packageManager = `${packageManager}@${version}`;
    } else {
      delete packageJson.packageManager;
    }
  } else {
    delete packageJson.packageManager;
  }

  await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
}

function isPackageJsonObject(value: unknown): value is PackageJsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
