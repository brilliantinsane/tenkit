/// <reference types="node" />

import { expect, test } from 'vitest';

import {
  createPr1GeneratedVerificationMatrixCells,
  runPr1StylingShapeVerification,
} from '../src/pr1-generated-verification';
import {
  createPr1BaselineCells,
  createPr1StylingShapeCells,
} from '../src/pr1-generated-verification-plan';

test('materializes baseline plans with exact environment key and resource evidence', () => {
  const cells = createPr1GeneratedVerificationMatrixCells({
    baseEnvironment: { PATH: '/safe/bin' },
    plans: createPr1BaselineCells(),
    resolveResource: (_plan, resourceClass) => ({
      resourceClass,
      acquire: async () => ({ cleanup: async () => ({ leaked: false }), environment: {} }),
    }),
  });
  const sqlClerk = cells.find(
    ({ selection }) =>
      selection.setupType === 'white-label-apps' &&
      selection.generatedAppOptions?.backend === 'express' &&
      selection.generatedAppOptions.auth === 'clerk' &&
      selection.generatedAppOptions.database === 'postgresql' &&
      selection.generatedAppOptions.orm === 'prisma',
  );

  expect(cells).toHaveLength(96);
  expect(sqlClerk?.environment.evidence).toEqual({
    environmentKeys: [
      'CLERK_PUBLISHABLE_KEY',
      'CLERK_SECRET_KEY',
      'CLIENT_ORIGIN',
      'DATABASE_URL',
      'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY',
      'PATH',
      'PORT',
    ],
    profile: 'deterministic',
    resourceClasses: ['local-node-port', 'disposable-postgresql'],
    sourceName: 'pr1-deterministic',
  });
  expect(sqlClerk?.environment.values).toEqual({ PATH: '/safe/bin' });
  expect(JSON.stringify(sqlClerk)).not.toContain('replace-me');
});

test('records all 27 generated Styling cells from one source SHA', async () => {
  const report = await runPr1StylingShapeVerification({
    cells: createPr1StylingShapeCells(),
    sourceSha: 'a'.repeat(40),
  });

  expect(report.sourceSha).toBe('a'.repeat(40));
  expect(report.summary).toEqual({ failed: 0, passed: 27, skipped: 0, total: 27 });
  expect(report.finalReadiness).toBe('ready');
  expect(report.cells).toHaveLength(27);
  expect(report.cells.every(({ status }) => status === 'passed')).toBe(true);
});
