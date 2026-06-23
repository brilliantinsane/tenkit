/// <reference types="node" />

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { resolve } from 'node:path';

type PackageJson = {
  name?: string;
  private?: boolean;
  main?: string;
  scripts?: Record<string, string>;
};

const workspacePackageJson = JSON.parse(
  readFileSync(resolve('../..', 'package.json'), 'utf8'),
) as PackageJson;
const playgroundPackageJson = JSON.parse(readFileSync('package.json', 'utf8')) as PackageJson;

test('workspace root is a private command router rather than an Expo app package', () => {
  assert.equal(workspacePackageJson.name, 'tenkit-workspace');
  assert.equal(workspacePackageJson.private, true);
  assert.equal(workspacePackageJson.main, undefined);
  assert.equal(workspacePackageJson.scripts?.start, 'pnpm -F playground start');
  assert.equal(workspacePackageJson.scripts?.tenkit, 'pnpm -F playground tenkit');
  assert.equal(workspacePackageJson.scripts?.test, 'pnpm -F playground test');
  assert.equal(workspacePackageJson.scripts?.typecheck, 'pnpm -F playground typecheck');
  assert.equal(workspacePackageJson.scripts?.lint, 'pnpm -F playground lint');
});

test('playground remains the Expo app package', () => {
  assert.equal(playgroundPackageJson.name, 'playground');
  assert.equal(playgroundPackageJson.private, true);
  assert.equal(playgroundPackageJson.main, 'expo-router/entry');
  assert.equal(playgroundPackageJson.scripts?.tenkit, 'tsx scripts/tenkit-cli.ts');
});
