import { assert } from 'vitest';

import type { GeneratedAppOptions } from '@tenkit/types/generated-app-option-definitions';
import { SUPPORTED_GENERATED_SETUP_TYPE_IDS } from '@tenkit/types/setup-type-definitions';
import { SUPPORTED_GENERATED_STYLING_CHOICES } from '@tenkit/types/styling-definitions';

import { generateProject } from '../src/generator';
import type { VirtualFileTree } from '../src/virtual-file-tree';

function readVirtualText(tree: VirtualFileTree, path: string): string {
  const file = tree.find((candidate) => candidate.path === path);
  if (!file || typeof file.contents !== 'string') {
    throw new Error(`Missing generated text file ${path}.`);
  }

  return file.contents;
}

export function assertClerkProtectedRoutes(generatedAppOptions: GeneratedAppOptions): void {
  for (const setupType of SUPPORTED_GENERATED_SETUP_TYPE_IDS) {
    const expectedSecondRoute = setupType === 'white-label-apps' ? 'explore' : 'settings';

    for (const stylingChoice of SUPPORTED_GENERATED_STYLING_CHOICES) {
      const tree = generateProject({
        setupType,
        stylingChoice,
        packageManager: 'pnpm',
        generatedAppOptions,
      });
      const rootLayout = readVirtualText(tree, 'src/app/_layout.tsx');

      assert.match(rootLayout, /Stack\.Protected/);
      assert.match(rootLayout, /name="index"/);
      assert.match(rootLayout, new RegExp(`name="${expectedSecondRoute}"`));
      assert.match(rootLayout, /isSignedIn !== true/);
      assert.match(rootLayout, /sessionRouteState === 'app'/);
    }
  }
}
