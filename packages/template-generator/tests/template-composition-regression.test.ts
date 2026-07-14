/// <reference types="node" />

import { fileURLToPath } from 'node:url';

import fs from 'fs-extra';
import { join, resolve } from 'pathe';
import { globSync } from 'tinyglobby';
import { assert, test } from 'vitest';

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const templatesRoot = join(packageRoot, 'templates');
const setupTypeTemplatePaths = ['white-label', 'runtime-tenants', 'generic-standalone'] as const;
const stylingTemplatePaths = ['bare', 'uniwind'] as const;
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

    return !/^options\/[^/]+\/[^/]+\/(?:shared|bare|uniwind)\//.test(path);
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
    setupTypeTemplatePaths.map((setupType) => `${setupType}/shared/package.json.hbs`).sort(),
  );

  const appShellPaths = paths.filter(
    (path) =>
      path.includes('/src/app/') || /\/src\/components\/app-tabs(?:\.web)?\.tsx\.hbs$/.test(path),
  );

  for (const path of appShellPaths) {
    assert.match(path, /^(?:white-label|runtime-tenants|generic-standalone)\/(?:bare|uniwind)\//);
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
