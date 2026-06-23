/// <reference types="node" />

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
};

test('Tenkit CLI package script is wired without changing normal Expo start', () => {
  assert.equal(packageJson.scripts.start, 'expo start');
  assert.equal('start:native' in packageJson.scripts, false);
  assert.equal(packageJson.scripts.ios, 'expo run:ios');
  assert.equal(packageJson.scripts.android, 'expo run:android');
  assert.equal(packageJson.scripts.tenkit, 'tsx scripts/tenkit-cli.ts');
  assert.equal('build:prepare' in packageJson.scripts, false);
  assert.equal('build:reset' in packageJson.scripts, false);
  assert.equal(packageJson.scripts.test, 'tsx --test tests/*.test.ts');
  assert.equal(packageJson.scripts.typecheck, 'tsc --noEmit --pretty false');
  assert.equal(packageJson.scripts.lint, 'expo lint');
});

test('Tenkit CLI dependencies are development tooling', () => {
  assert.ok(packageJson.devDependencies.commander);
  assert.ok(packageJson.devDependencies['@inquirer/prompts']);
});
