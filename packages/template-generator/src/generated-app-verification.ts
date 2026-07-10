import { tmpdir } from 'node:os';

import fs from 'fs-extra';
import { join } from 'pathe';

import { runGeneratedAppCommand } from './generated-app-command-runner';
import { deriveAppVariantIdentities } from './generated-setup-type-definitions';
import { getGeneratedSetupTypeDefinition } from './generated-setup-types';
import { type GeneratedSetupType, type GeneratedStylingChoice } from './generator';
import { runGenerationProof } from './local-proof';

export type VerifyGeneratedAppOptions = {
  setupType: GeneratedSetupType;
  appVariantAccents?: readonly (string | undefined)[];
  appVariantNames?: readonly (string | undefined)[];
  stylingChoice: GeneratedStylingChoice;
  workspaceRoot: string;
};

export async function verifyGeneratedApp({
  setupType,
  appVariantAccents,
  appVariantNames,
  stylingChoice,
  workspaceRoot,
}: VerifyGeneratedAppOptions): Promise<void> {
  const tempRoot = await fs.mkdtemp(
    join(tmpdir(), `tenkit-generated-${setupType}-${stylingChoice}-`),
  );
  const targetDir = join(tempRoot, 'app');

  try {
    await runGenerationProof({
      setupType,
      appVariantAccents,
      appVariantNames,
      stylingChoice,
      targetDir,
      git: false,
      workspaceRoot,
    });

    await runGeneratedAppCommand(targetDir, 'pnpm', ['install']);
    await runGeneratedAppCommand(targetDir, 'pnpm', ['run', 'typecheck']);
    await runGeneratedAppCommand(targetDir, 'pnpm', ['expo:config']);

    if (setupType === 'generic-with-standalone-app-variants') {
      const setupTypeDefinition = getGeneratedSetupTypeDefinition(setupType);
      const resolvedNames = setupTypeDefinition.appVariants.map(
        ({ defaultName }, index) => appVariantNames?.[index] ?? defaultName,
      );
      const standaloneSlug = deriveAppVariantIdentities(resolvedNames)[1]?.slug;

      if (!standaloneSlug) {
        throw new Error('Missing Standalone App Variant Slug for generated app verification.');
      }

      await runGeneratedAppCommand(targetDir, 'pnpm', ['expo:config'], {
        APP_VARIANT_SLUG: standaloneSlug,
      });
    }

    console.log(`Verified generated ${setupType} Expo app with ${stylingChoice} Styling.`);
  } finally {
    await fs.remove(tempRoot);
  }
}
