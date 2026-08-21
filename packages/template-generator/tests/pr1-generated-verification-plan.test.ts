/// <reference types="node" />

import { describe, expect, test } from 'vitest';

import {
  createPr1BaselineCells,
  createPr1InstalledRepresentativeCells,
  createPr1StylingShapeCells,
  countPr1ExpoConfigEvaluations,
} from '../src/pr1-generated-verification-plan';

describe('PR1 generated verification plan', () => {
  test('plans the exact canonical baseline and App Variant Expo config count', () => {
    const cells = createPr1BaselineCells();

    expect(cells).toHaveLength(96);
    expect(new Set(cells.map(({ id }) => id))).toHaveLength(96);
    expect(cells.every(({ selection }) => selection.stylingChoice === 'bare')).toBe(true);
    expect(cells.every(({ selection }) => selection.packageManager === 'pnpm')).toBe(true);
    expect(countPr1ExpoConfigEvaluations(cells)).toBe(160);
  });

  test('plans 27 generated Styling cells across the three representative Auth shapes', () => {
    const cells = createPr1StylingShapeCells();

    expect(cells).toHaveLength(27);
    expect(new Set(cells.map(({ id }) => id))).toHaveLength(27);
    expect(new Set(cells.map(({ selection }) => selection.setupType))).toEqual(
      new Set([
        'white-label-apps',
        'single-app-runtime-tenants',
        'generic-with-standalone-app-variants',
      ]),
    );
    expect(new Set(cells.map(({ selection }) => selection.stylingChoice))).toEqual(
      new Set(['bare', 'uniwind', 'unistyles']),
    );
    expect(new Set(cells.map(({ selection }) => selection.generatedAppOptions.auth))).toEqual(
      new Set(['none', 'better-auth', 'clerk']),
    );
  });

  test('plans the exact nine installed representative cells from the verification decision', () => {
    const cells = createPr1InstalledRepresentativeCells();

    expect(cells).toHaveLength(9);
    expect(new Set(cells.map(({ id }) => id))).toHaveLength(9);
    expect(
      new Set(cells.map(({ selection }) => `${selection.setupType}:${selection.stylingChoice}`)),
    ).toHaveLength(9);
    expect(
      new Set(cells.map(({ selection }) => `${selection.setupType}:${selection.packageManager}`)),
    ).toHaveLength(9);
    expect(cells.map(({ id }) => id)).toEqual([
      'installed-white-label-bare-pnpm-none-none-none-none',
      'installed-white-label-uniwind-npm-express-better-auth-postgresql-prisma',
      'installed-white-label-unistyles-bun-convex-clerk-none-none',
      'installed-runtime-tenants-bare-npm-convex-better-auth-none-none',
      'installed-runtime-tenants-uniwind-bun-none-none-none-none',
      'installed-runtime-tenants-unistyles-pnpm-nestjs-clerk-mysql-drizzle',
      'installed-generic-standalone-bare-bun-express-none-mysql-prisma',
      'installed-generic-standalone-uniwind-pnpm-convex-none-none-none',
      'installed-generic-standalone-unistyles-npm-none-none-none-none',
    ]);
  });
});
