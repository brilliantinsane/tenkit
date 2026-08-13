/// <reference types="node" />

import { tmpdir } from 'node:os';

import fs from 'fs-extra';
import { join } from 'pathe';
import { afterEach, vi } from 'vitest';

import type { CreateFlowEnvironment, PromptAdapter } from '../src/create/types';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((tempRoot) => fs.remove(tempRoot)));
});

export async function createTempRoot(): Promise<string> {
  const tempRoot = await fs.mkdtemp(join(tmpdir(), 'tenkit-cli-options-test-'));
  tempRoots.push(tempRoot);
  return tempRoot;
}

export function createEnvironment(
  cwd: string,
  overrides: Partial<CreateFlowEnvironment> = {},
): CreateFlowEnvironment & { lines: string[] } {
  const lines: string[] = [];
  const prompts: PromptAdapter = {
    text: vi.fn(async () => {
      throw new Error('Unexpected text prompt.');
    }),
    select: vi.fn(async () => {
      throw new Error('Unexpected select prompt.');
    }),
    confirm: vi.fn(async () => false),
  };

  return {
    cwd,
    isInteractive: false,
    lines,
    output: {
      log(message = '') {
        lines.push(message);
      },
      error(message) {
        lines.push(message);
      },
    },
    prompts,
    ...overrides,
  };
}
