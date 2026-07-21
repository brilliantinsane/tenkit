import { tmpdir } from 'node:os';

import fs from 'fs-extra';
import { join } from 'pathe';

import { verifyGeneratedProject } from './generated-project-verification';
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

    await verifyGeneratedProject({
      targetDir,
      setupType,
      packageManager: 'pnpm',
      appVariantNames,
    });

    console.log(`Verified generated ${setupType} Expo app with ${stylingChoice} Styling.`);
  } finally {
    await fs.remove(tempRoot);
  }
}
