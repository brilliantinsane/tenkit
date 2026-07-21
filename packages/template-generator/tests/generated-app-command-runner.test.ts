/// <reference types="node" />

import { assert, test } from 'vitest';

import { runGeneratedAppCommand } from '../src/generated-app-command-runner';

test('generated app verification reports command failures', async () => {
  let thrown: unknown;

  try {
    await runGeneratedAppCommand(process.cwd(), process.execPath, ['-e', 'process.exit(17)']);
  } catch (error) {
    thrown = error;
  }

  assert.ok(thrown instanceof Error);
  assert.match(thrown.message, /Generated app verification command failed:/);
  assert.match(thrown.message, /-e process\.exit\(17\)/);
  assert.match(thrown.message, /exit code 17/);
});

test('generated app verification can avoid inheriting process environment', async () => {
  await runGeneratedAppCommand(
    process.cwd(),
    process.execPath,
    [
      '-e',
      'if (process.env.HOME || process.env.npm_package_name || process.env.NODE_OPTIONS) process.exit(1)',
    ],
    { SAFE_VALUE: 'preserved' },
    false,
  );
});
