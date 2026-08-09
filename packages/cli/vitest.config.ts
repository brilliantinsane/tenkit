import { resolve } from 'pathe';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@tenkit/types/generated-app-option-definitions',
        replacement: resolve(
          import.meta.dirname,
          '../types/src/generated-app-option-definitions.ts',
        ),
      },
      {
        find: '@tenkit/types/setup-type-definitions',
        replacement: resolve(import.meta.dirname, '../types/src/setup-type-definitions.ts'),
      },
      {
        find: '@tenkit/types/styling-definitions',
        replacement: resolve(import.meta.dirname, '../types/src/styling-definitions.ts'),
      },
      {
        find: '@tenkit/template-generator',
        replacement: resolve(import.meta.dirname, '../template-generator/src/index.ts'),
      },
    ],
  },
  test: {
    clearMocks: true,
    restoreMocks: true,
  },
});
