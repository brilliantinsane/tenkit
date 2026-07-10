import { resolve } from 'pathe';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@tenkit/template-generator/setup-type-definitions',
        replacement: resolve(
          import.meta.dirname,
          '../template-generator/src/generated-setup-type-definitions.ts',
        ),
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
