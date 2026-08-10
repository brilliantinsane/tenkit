/// <reference types="node" />

import { fileURLToPath } from 'node:url';

import fs from 'fs-extra';
import { join, resolve } from 'pathe';
import { globSync } from 'tinyglobby';
import { assert, test } from 'vitest';

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const templatesRoot = join(packageRoot, 'templates');
const setupTypeTemplatePaths = ['white-label', 'runtime-tenants', 'generic-standalone'] as const;
const stylingTemplatePaths = ['bare', 'uniwind', 'unistyles'] as const;
const universalSharedPaths = [
  'app.config.ts.hbs',
  'src/constants/project-config.ts.hbs',
  'tsconfig.json.hbs',
] as const;
const pnpmWorkspaceTemplatePath = 'options/package-manager/pnpm/shared/pnpm-workspace.yaml.hbs';

function readPackageSource(path: string): string {
  return fs.readFileSync(join(packageRoot, path), 'utf8');
}

test('Template source paths use ADR 0009 owners', () => {
  const paths = globSync('**/*', { cwd: templatesRoot, dot: true, onlyFiles: true }).sort();
  const unexpectedPaths = paths.filter((path) => {
    if (path.startsWith('shared/') || path.startsWith('assets/')) {
      return false;
    }

    if (
      setupTypeTemplatePaths.some((setupType) =>
        ['shared', ...stylingTemplatePaths].some((layer) =>
          path.startsWith(`${setupType}/${layer}/`),
        ),
      )
    ) {
      return false;
    }

    return !/^options\/[^/]+\/[^/]+\/(?:shared|bare|uniwind|unistyles)\//.test(path);
  });

  assert.deepEqual(unexpectedPaths, []);
  for (const path of universalSharedPaths) {
    assert.ok(paths.includes(`shared/${path}`));
    for (const setupType of setupTypeTemplatePaths) {
      assert.notInclude(paths, `${setupType}/shared/${path}`);
    }
  }
  assert.ok(paths.includes(pnpmWorkspaceTemplatePath));
  assert.notInclude(paths, 'shared/pnpm-workspace.yaml.hbs');

  assert.deepEqual(
    paths.filter((path) => path.endsWith('package.json.hbs')),
    [
      'generic-standalone/shared/package.json.hbs',
      'options/backend/convex/shared/apps/server/package.json.hbs',
      'options/backend/express/shared/apps/server/package.json.hbs',
      'options/backend/nestjs/shared/apps/server/package.json.hbs',
      'runtime-tenants/shared/package.json.hbs',
      'white-label/shared/package.json.hbs',
    ],
  );

  assert.deepEqual(
    paths
      .filter((path) => path.startsWith('options/backend/convex/'))
      .map((path) => path.replace('options/backend/convex/shared/', ''))
      .filter((path) => !path.startsWith('apps/server/')),
    [],
  );
  assert.deepEqual(
    paths
      .filter((path) => path.startsWith('options/backend/express/'))
      .map((path) => path.replace('options/backend/express/shared/', ''))
      .filter((path) => !path.startsWith('apps/server/')),
    [],
  );
  assert.deepEqual(
    paths
      .filter((path) => path.startsWith('options/backend/nestjs/'))
      .map((path) => path.replace('options/backend/nestjs/shared/', ''))
      .filter((path) => !path.startsWith('apps/server/')),
    [],
  );
  assert.deepEqual(
    paths
      .filter((path) => path.startsWith('options/auth/clerk/shared/'))
      .map((path) => path.replace('options/auth/clerk/shared/', ''))
      .filter((path) => !path.startsWith('src/app/(auth)/') && !path.startsWith('src/auth/')),
    [],
  );
  for (const stylingChoice of stylingTemplatePaths) {
    assert.deepEqual(
      paths
        .filter((path) => path.startsWith(`options/auth/clerk/${stylingChoice}/`))
        .map((path) => path.replace(`options/auth/clerk/${stylingChoice}/`, ''))
        .filter((path) => !path.startsWith('src/auth/')),
      [],
    );
  }

  const appShellPaths = paths.filter(
    (path) =>
      path.includes('/src/app/') || /\/src\/components\/app-tabs(?:\.web)?\.tsx\.hbs$/.test(path),
  );

  for (const path of appShellPaths) {
    assert.ok(
      /^(?:white-label|runtime-tenants|generic-standalone)\/(?:bare|uniwind|unistyles)\//.test(
        path,
      ) || path.startsWith('options/auth/clerk/shared/src/app/(auth)/'),
    );
  }
});

test('generic Template orchestration does not own route or package policy', () => {
  const templateReader = readPackageSource('src/template-reader.ts');
  const generator = readPackageSource('src/generator.ts');

  assert.notMatch(templateReader, /explore\.tsx|settings\.tsx|hasRuntimeTenantRoutes/);
  assert.notMatch(templateReader, /pnpm-workspace\.yaml|isPnpmPackageManager/);
  assert.notMatch(
    generator,
    /createPackageJson|packageJsonTree|dependencies: Record<string, string>/,
  );
  assert.notMatch(
    generator,
    /hasRuntimeTenantRoutes|isWhiteLabelApps|isGenericWithStandaloneAppVariants/,
  );
});
