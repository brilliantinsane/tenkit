import { runGeneratedAppCommand } from './generated-app-command-runner';
import {
  deriveAppVariantIdentities,
  getGeneratedSetupTypeDefinition,
} from './generated-setup-type-definitions';
import type { GeneratedProjectPackageManager, GeneratedSetupType } from './generator';

export type VerifyGeneratedProjectOptions = {
  targetDir: string;
  setupType: GeneratedSetupType;
  packageManager: GeneratedProjectPackageManager;
  appVariantNames?: readonly (string | undefined)[];
  env?: Record<string, string>;
  inheritProcessEnv?: boolean;
};

export async function verifyGeneratedProject({
  targetDir,
  setupType,
  packageManager,
  appVariantNames,
  env,
  inheritProcessEnv,
}: VerifyGeneratedProjectOptions): Promise<void> {
  await runGeneratedAppCommand(targetDir, packageManager, ['install'], env, inheritProcessEnv);
  await runGeneratedAppCommand(
    targetDir,
    packageManager,
    ['run', 'typecheck'],
    env,
    inheritProcessEnv,
  );
  await runGeneratedAppCommand(
    targetDir,
    packageManager,
    ['run', 'expo:config'],
    env,
    inheritProcessEnv,
  );

  const setupTypeDefinition = getGeneratedSetupTypeDefinition(setupType);
  const resolvedNames = setupTypeDefinition.appVariants.map(
    ({ defaultName }, index) => appVariantNames?.[index] ?? defaultName,
  );
  const remainingAppVariantSlugs = deriveAppVariantIdentities(resolvedNames)
    .slice(1)
    .map(({ slug }) => slug);

  for (const appVariantSlug of remainingAppVariantSlugs) {
    await runGeneratedAppCommand(
      targetDir,
      packageManager,
      ['run', 'expo:config'],
      { ...env, APP_VARIANT_SLUG: appVariantSlug },
      inheritProcessEnv,
    );
  }
}
