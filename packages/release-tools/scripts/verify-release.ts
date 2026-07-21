import { resolve } from 'node:path';

import { runReleaseVerificationCommand } from '../src/release-verification-command';

try {
  process.exitCode = await runReleaseVerificationCommand({
    args: process.argv.slice(2),
    workspaceRoot: resolve(import.meta.dirname, '../../..'),
    write(message) {
      process.stdout.write(message);
    },
  });
} catch (error) {
  process.stderr.write(
    `Release Verification: STOP\n${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
