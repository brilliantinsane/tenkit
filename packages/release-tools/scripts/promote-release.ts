import { resolve } from 'node:path';

import { runPromotionCommand } from '../src/promotion-command';

try {
  process.exitCode = await runPromotionCommand({
    args: process.argv.slice(2),
    workspaceRoot: resolve(import.meta.dirname, '../../..'),
    write(message) {
      process.stdout.write(message);
    },
  });
} catch (error) {
  process.stderr.write(
    `Promotion: STOP\n${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
