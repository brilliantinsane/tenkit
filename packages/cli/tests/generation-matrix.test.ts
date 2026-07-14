/// <reference types="node" />

import { tmpdir } from 'node:os';

import fs from 'fs-extra';
import { join } from 'pathe';
import { afterEach, assert, describe, expect, test } from 'vitest';

import {
  assertGeneratedProjectMatches,
  createExhaustiveGenerationCases,
  createInstalledVerificationCases,
  finalizeGenerationMatrix,
  GENERATION_MATRIX_ROOT,
  planInstalledProjectVerificationCommands,
  runGenerationMatrix,
  type GenerationMatrixReport,
} from '../src/verification/generation-matrix';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.remove(root)));
});

describe('generation matrix coverage', () => {
  test('uses the fixed user-facing matrix root', () => {
    assert.equal(GENERATION_MATRIX_ROOT, '/tmp/tenkit-test');
  });

  test('covers every Setup Type, Styling Choice, package manager, and value profile', () => {
    const cases = createExhaustiveGenerationCases();

    assert.equal(cases.length, 36);
    assert.deepEqual(
      new Set(cases.map(({ setupType }) => setupType)),
      new Set([
        'white-label-apps',
        'single-app-runtime-tenants',
        'generic-with-standalone-app-variants',
      ]),
    );
    assert.deepEqual(
      new Set(cases.map(({ stylingChoice }) => stylingChoice)),
      new Set(['bare', 'uniwind']),
    );
    assert.deepEqual(
      new Set(cases.map(({ packageManager }) => packageManager)),
      new Set(['pnpm', 'npm', 'bun']),
    );
    assert.deepEqual(
      new Set(cases.map(({ valueProfile }) => valueProfile)),
      new Set(['default', 'custom']),
    );
    assert.ok(cases.every(({ install, git }) => !install && !git));
    assert.equal(new Set(cases.map(({ id }) => id)).size, cases.length);

    const customWhiteLabel = cases.find(
      ({ setupType, stylingChoice, packageManager, valueProfile }) =>
        setupType === 'white-label-apps' &&
        stylingChoice === 'bare' &&
        packageManager === 'pnpm' &&
        valueProfile === 'custom',
    );
    assert.deepEqual(customWhiteLabel?.appVariantNames, ['Café North', '123 South']);
    assert.deepEqual(customWhiteLabel?.appVariantAccents, ['#123ABC', '#F59E0B']);

    const defaultRuntimeTenants = cases.find(
      ({ setupType, stylingChoice, packageManager, valueProfile }) =>
        setupType === 'single-app-runtime-tenants' &&
        stylingChoice === 'bare' &&
        packageManager === 'pnpm' &&
        valueProfile === 'default',
    );
    assert.deepEqual(defaultRuntimeTenants?.appVariantNames, ['Acme App']);
    assert.deepEqual(defaultRuntimeTenants?.appVariantAccents, ['#EB2556']);
  });

  test('uses six installed cases to cover native output, package managers, and Git choices', () => {
    const cases = createInstalledVerificationCases();

    assert.equal(cases.length, 6);
    assert.equal(
      new Set(cases.map(({ setupType, stylingChoice }) => `${setupType}:${stylingChoice}`)).size,
      6,
    );
    assert.deepEqual(
      cases.reduce<Record<string, number>>((counts, matrixCase) => {
        counts[matrixCase.packageManager] = (counts[matrixCase.packageManager] ?? 0) + 1;
        return counts;
      }, {}),
      { pnpm: 2, npm: 2, bun: 2 },
    );
    assert.ok(cases.every(({ install }) => install));
    assert.deepEqual(new Set(cases.map(({ git }) => git)), new Set([true, false]));
    assert.deepEqual(
      new Set(cases.map(({ valueProfile }) => valueProfile)),
      new Set(['default', 'custom']),
    );
  });
});

describe('generated project inspection', () => {
  test('plans Expo config verification for every White Label App Variant', () => {
    assert.deepEqual(
      planInstalledProjectVerificationCommands({
        packageManager: 'pnpm',
        targetDir: '/tmp/white-label',
        appVariantNames: ['North Brand', 'South Brand'],
      }),
      [
        {
          command: 'pnpm',
          args: ['run', 'typecheck'],
          cwd: '/tmp/white-label',
          operation: 'generated app typecheck',
        },
        {
          command: 'pnpm',
          args: ['run', 'expo:config'],
          cwd: '/tmp/white-label',
          operation: 'generated app Expo config',
        },
        {
          command: 'pnpm',
          args: ['run', 'expo:config'],
          cwd: '/tmp/white-label',
          env: { APP_VARIANT_SLUG: 'south-brand' },
          operation: 'generated app Expo config for non-default App Variant',
        },
      ],
    );
  });

  test('compares every expected byte and rejects unexpected files', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'tenkit-matrix-inspection-'));
    tempRoots.push(root);
    await fs.outputFile(join(root, 'README.md'), 'expected\n');
    await fs.outputFile(join(root, 'assets/icon.bin'), Uint8Array.from([1, 2, 3]));

    await assertGeneratedProjectMatches({
      targetDir: root,
      tree: [
        { path: 'README.md', contents: 'expected\n' },
        { path: 'assets/icon.bin', contents: Uint8Array.from([1, 2, 3]) },
      ],
    });

    await fs.outputFile(join(root, 'unexpected.txt'), 'unexpected');

    await expect(
      assertGeneratedProjectMatches({
        targetDir: root,
        tree: [
          { path: 'README.md', contents: 'expected\n' },
          { path: 'assets/icon.bin', contents: Uint8Array.from([1, 2, 3]) },
        ],
      }),
    ).rejects.toThrow(/Unexpected generated file "unexpected\.txt"/);
  });
});

describe('matrix evidence lifecycle', () => {
  function createReport(status: GenerationMatrixReport['status']): GenerationMatrixReport {
    return {
      rootDir: '/tmp/tenkit-test',
      startedAt: '2026-07-11T00:00:00.000Z',
      finishedAt: '2026-07-11T00:01:00.000Z',
      status,
      cases: [],
      toolVersions: {},
    };
  }

  test('deletes the matrix root only after every case passes', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'tenkit-matrix-green-'));
    tempRoots.push(root);
    await fs.outputFile(join(root, 'evidence.txt'), 'green');

    await finalizeGenerationMatrix({ rootDir: root, report: createReport('passed') });

    assert.equal(await fs.pathExists(root), false);
  });

  test('preserves failed projects and writes the report for iteration', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'tenkit-matrix-red-'));
    tempRoots.push(root);
    await fs.outputFile(join(root, 'failing-project/evidence.txt'), 'red');

    const report = createReport('failed');
    await finalizeGenerationMatrix({ rootDir: root, report });

    assert.equal(await fs.pathExists(join(root, 'failing-project/evidence.txt')), true);
    assert.deepEqual(await fs.readJson(join(root, 'verification-report.json')), report);
  });

  test('persists bounded diagnostics when external tool preflight fails', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'tenkit-matrix-diagnostics-'));
    tempRoots.push(root);
    const originalPath = process.env.PATH;

    try {
      process.env.PATH = '';
      const report = await runGenerationMatrix({ workspaceRoot: root, rootDir: root });
      const preflight = report.cases[0];

      assert.equal(report.status, 'failed');
      assert.equal(preflight?.status, 'failed');
      const error = preflight && 'error' in preflight ? preflight.error : undefined;
      assert.equal(
        error,
        'External verification command failed during tool preflight: pnpm version check.',
      );
      assert.notMatch(error ?? '', /pnpm --version|spawn pnpm|stdout|stderr/);
      assert.equal((error ?? '').includes(tmpdir()), false);
    } finally {
      process.env.PATH = originalPath;
    }
  });
});
