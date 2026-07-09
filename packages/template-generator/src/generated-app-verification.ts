import { tmpdir } from 'node:os';

import fs from 'fs-extra';
import { join } from 'pathe';

import { runGeneratedAppCommand } from './generated-app-command-runner';
import { type GeneratedSetupType, type GeneratedStylingChoice } from './generator';
import { runGenerationProof } from './local-proof';

export type VerifyGeneratedAppOptions = {
  setupType: GeneratedSetupType;
  accent?: string;
  stylingChoice: GeneratedStylingChoice;
  workspaceRoot: string;
};

export async function verifyGeneratedApp({
  setupType,
  accent,
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
      accent,
      stylingChoice,
      targetDir,
      git: false,
      workspaceRoot,
    });

    await runGeneratedAppCommand(targetDir, 'pnpm', ['install']);
    await runGeneratedAppCommand(targetDir, 'pnpm', ['run', 'typecheck']);
    await runGeneratedAppCommand(targetDir, 'pnpm', ['expo:config']);

    if (setupType === 'generic-with-standalone-app-variants') {
      await runGeneratedAppCommand(targetDir, 'pnpm', ['expo:config'], {
        APP_VARIANT_SLUG: 'west-studio',
      });
    }

    console.log(`Verified generated ${setupType} Expo app with ${stylingChoice} Styling.`);
  } finally {
    await fs.remove(tempRoot);
  }
}
