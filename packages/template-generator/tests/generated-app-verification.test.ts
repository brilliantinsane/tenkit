/// <reference types="node" />

import { afterEach, expect, test, vi } from 'vitest';

import { verifyGeneratedApp } from '../src/generated-app-verification';

const { runGeneratedAppCommand, runGenerationProof } = vi.hoisted(() => ({
  runGeneratedAppCommand: vi.fn().mockResolvedValue(undefined),
  runGenerationProof: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/generated-app-command-runner', () => ({ runGeneratedAppCommand }));
vi.mock('../src/local-proof', () => ({ runGenerationProof }));

afterEach(() => {
  vi.clearAllMocks();
});

test('generated app verification evaluates every White Label App Variant', async () => {
  await verifyGeneratedApp({
    setupType: 'white-label-apps',
    appVariantNames: ['North Brand', 'South Brand'],
    appVariantAccents: ['#123ABC', '#F59E0B'],
    stylingChoice: 'uniwind',
    workspaceRoot: '/workspace',
  });

  const targetDir = expect.any(String);
  expect(runGeneratedAppCommand.mock.calls).toEqual([
    [targetDir, 'pnpm', ['install']],
    [targetDir, 'pnpm', ['run', 'typecheck']],
    [targetDir, 'pnpm', ['expo:config']],
    [targetDir, 'pnpm', ['expo:config'], { APP_VARIANT_SLUG: 'south-brand' }],
  ]);
});
