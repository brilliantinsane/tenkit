import { resolve } from 'node:path';

import { runReleasePlanCommand } from '../src/release-plan-command';

try {
  process.exitCode = await runReleasePlanCommand({
    args: process.argv.slice(2),
    workspaceRoot: resolve(import.meta.dirname, '../../..'),
    write(message) {
      process.stdout.write(message);
    },
  });
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
