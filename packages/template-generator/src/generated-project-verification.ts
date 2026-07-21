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
  const runVerificationCommand = (
    args: string[],
    commandEnv: Record<string, string> | undefined = env,
  ) =>
    runGeneratedAppCommand(targetDir, packageManager, args, {
      env: commandEnv,
      inheritProcessEnv,
    });

  await runVerificationCommand(['install']);
  await runVerificationCommand(['run', 'typecheck']);
  await runVerificationCommand(['run', 'expo:config']);

  const setupTypeDefinition = getGeneratedSetupTypeDefinition(setupType);
  const resolvedNames = setupTypeDefinition.appVariants.map(
    ({ defaultName }, index) => appVariantNames?.[index] ?? defaultName,
  );
  const remainingAppVariantSlugs = deriveAppVariantIdentities(resolvedNames)
    .slice(1)
    .map(({ slug }) => slug);

  for (const appVariantSlug of remainingAppVariantSlugs) {
    await runVerificationCommand(['run', 'expo:config'], {
      ...env,
      APP_VARIANT_SLUG: appVariantSlug,
    });
  }
}
