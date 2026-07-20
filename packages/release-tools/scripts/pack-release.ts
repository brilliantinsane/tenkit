import { resolve } from 'node:path';

import { runReleasePackCommand } from '../src/release-pack-command';

try {
  process.exitCode = await runReleasePackCommand({
    args: process.argv.slice(2),
    repositoryRoot: resolve(import.meta.dirname, '../../..'),
    write(message) {
      process.stdout.write(message);
    },
  });
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
