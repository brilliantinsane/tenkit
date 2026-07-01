import { tmpdir } from 'node:os';

import fs from 'fs-extra';
import { join } from 'pathe';

import { runGeneratedAppCommand } from './generated-app-command-runner';
import { type GeneratedSetupType } from './generator';
import { runGenerationProof } from './local-proof';

export type VerifyGeneratedAppOptions = {
  setupType: GeneratedSetupType;
  workspaceRoot: string;
};

export async function verifyGeneratedApp({
  setupType,
  workspaceRoot,
}: VerifyGeneratedAppOptions): Promise<void> {
  const tempRoot = await fs.mkdtemp(join(tmpdir(), `tenkit-generated-${setupType}-`));
  const targetDir = join(tempRoot, 'app');

  try {
    await runGenerationProof({
      setupType,
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

    console.log(`Verified generated ${setupType} Expo app.`);
  } finally {
    await fs.remove(tempRoot);
  }
}
