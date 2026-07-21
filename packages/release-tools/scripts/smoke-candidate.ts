import { resolve } from 'node:path';

import { runCandidateSmokeCommand } from '../src/candidate-smoke-command';

try {
  process.exitCode = await runCandidateSmokeCommand({
    args: process.argv.slice(2),
    workspaceRoot: resolve(import.meta.dirname, '../../..'),
    write(message) {
      process.stdout.write(message);
    },
  });
} catch (error) {
  process.stderr.write(
    `Candidate Smoke: STOP\n${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
