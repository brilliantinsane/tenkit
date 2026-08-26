/// <reference types="node" />

import { afterEach, assert, test, vi } from 'vitest';

import {
  createGeneratedAppCommandEnvironment,
  runGeneratedAppCommand,
} from '../src/generated-app-command-runner';

afterEach(() => {
  vi.unstubAllEnvs();
});

test('generated app command failures return bounded sanitized evidence', async () => {
  const secret = 'secret-value-that-must-not-escape';
  const result = await runGeneratedAppCommand(
    process.cwd(),
    process.execPath,
    [
      '-e',
      `process.stderr.write(${JSON.stringify(`${process.cwd()} ${secret}`)}); process.exit(17)`,
    ],
    { env: { SAFE_SECRET: secret } },
  );

  assert.equal(result.status, 'failed');
  assert.equal(result.exitCode, 17);
  assert.equal(result.command, 'node');
  assert.match(result.diagnostics ?? '', /<generated-project>/);
  assert.match(result.diagnostics ?? '', /<redacted>/);
  assert.notMatch(JSON.stringify(result), new RegExp(secret));
  assert.notMatch(JSON.stringify(result), new RegExp(process.cwd()));
});

test('generated app command execution never inherits process environment', async () => {
  const result = await runGeneratedAppCommand(
    process.cwd(),
    process.execPath,
    [
      '-e',
      'if (process.env.HOME || process.env.npm_package_name || process.env.NODE_OPTIONS || process.env.SAFE_VALUE !== "preserved") process.exit(1)',
    ],
    { env: { SAFE_VALUE: 'preserved' } },
  );

  assert.equal(result.status, 'passed');
});

test('generated app command execution returns timeout evidence', async () => {
  const result = await runGeneratedAppCommand(
    process.cwd(),
    process.execPath,
    ['-e', 'setInterval(() => {}, 1_000)'],
    { env: {}, timeoutMs: 25 },
  );

  assert.equal(result.status, 'timed-out');
  assert.equal(result.signal, 'SIGTERM');
});

test('generated app verification environment uses an explicit host allowlist', () => {
  vi.stubEnv('HOME', '/safe/home');
  vi.stubEnv('NODE_OPTIONS', '--require secret-hook');
  vi.stubEnv('PATH', '/safe/bin');
  vi.stubEnv('SECRET_TOKEN', 'must-not-pass');
  vi.stubEnv('TMPDIR', '/safe/tmp');

  const environment = createGeneratedAppCommandEnvironment({
    APP_VARIANT_SLUG: 'first-tenant',
  });

  assert.equal(environment.APP_VARIANT_SLUG, 'first-tenant');
  assert.equal(environment.HOME, '/safe/home');
  assert.equal(environment.PATH, '/safe/bin');
  assert.equal(environment.TMPDIR, '/safe/tmp');
  assert.equal(environment.NODE_OPTIONS, undefined);
  assert.equal(environment.SECRET_TOKEN, undefined);
});
