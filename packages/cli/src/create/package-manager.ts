export const SUPPORTED_PACKAGE_MANAGERS = ['pnpm', 'npm', 'bun'] as const;

export type PublicCliPackageManager = (typeof SUPPORTED_PACKAGE_MANAGERS)[number];

export function normalizePackageManagerInput(
  packageManager: string | undefined,
): PublicCliPackageManager | undefined {
  if (packageManager === undefined) {
    return undefined;
  }

  const normalized = packageManager.trim();

  if (!normalized) {
    throw new Error(`Package manager must be one of: ${SUPPORTED_PACKAGE_MANAGERS.join(', ')}.`);
  }

  if (isPublicCliPackageManager(normalized)) {
    return normalized;
  }

  throw new Error(
    `Unsupported package manager ${JSON.stringify(packageManager)}. Expected one of: ${SUPPORTED_PACKAGE_MANAGERS.join(', ')}.`,
  );
}

export function detectPackageManager(userAgent: string | undefined): PublicCliPackageManager {
  if (userAgent?.startsWith('pnpm')) {
    return 'pnpm';
  }

  if (userAgent?.startsWith('bun')) {
    return 'bun';
  }

  if (userAgent?.startsWith('npm')) {
    return 'npm';
  }

  return 'pnpm';
}

export function formatInstallCommand(packageManager: PublicCliPackageManager): string {
  return `${packageManager} install`;
}

export function formatRunCommand(packageManager: PublicCliPackageManager, script: string): string {
  return `${packageManager} run ${script}`;
}

function isPublicCliPackageManager(value: string): value is PublicCliPackageManager {
  return SUPPORTED_PACKAGE_MANAGERS.some((packageManager) => packageManager === value);
}
