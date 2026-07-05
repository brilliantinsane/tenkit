/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assert, test } from 'vitest';

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
  assert.equal(workspacePackageJson.scripts?.['web:dev'], 'pnpm -F @tenkit/web dev');
  assert.equal(workspacePackageJson.scripts?.['web:build'], 'pnpm -F @tenkit/web build');
  assert.equal(workspacePackageJson.scripts?.['web:typecheck'], 'pnpm -F @tenkit/web typecheck');
  assert.equal(workspacePackageJson.scripts?.['web:lint'], 'pnpm -F @tenkit/web lint');
  assert.equal(
    workspacePackageJson.scripts?.test,
    'pnpm -F playground test && pnpm -F @tenkit/template-generator test && pnpm -F @tenkit/cli test',
  );
  assert.equal(
    workspacePackageJson.scripts?.typecheck,
    'pnpm -F playground typecheck && pnpm -F @tenkit/template-generator typecheck && pnpm -F @tenkit/cli typecheck && pnpm -F create-tenkit typecheck && pnpm -F @tenkit/web typecheck',
  );
  assert.equal(workspacePackageJson.scripts?.proof, 'pnpm -F @tenkit/template-generator proof');
  assert.equal(workspacePackageJson.scripts?.verify, 'pnpm -F @tenkit/template-generator verify');
  assert.equal(
    workspacePackageJson.scripts?.lint,
    'pnpm -F playground lint && pnpm -F @tenkit/web lint',
  );
});

test('playground remains the Expo app package', () => {
  assert.equal(playgroundPackageJson.name, 'playground');
  assert.equal(playgroundPackageJson.private, true);
  assert.equal(playgroundPackageJson.main, 'expo-router/entry');
  assert.equal(playgroundPackageJson.scripts?.tenkit, 'tsx scripts/tenkit-cli.ts');
});
