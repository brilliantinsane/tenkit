import { resolve } from 'pathe';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@tenkit/template-generator': resolve(
        import.meta.dirname,
        '../template-generator/src/index.ts',
      ),
    },
  },
  test: {
    clearMocks: true,
    restoreMocks: true,
  },
});
