import fs from 'fs-extra';
import { resolve } from 'pathe';
import { expect, test } from 'vitest';

import { CLI_VERSION } from '../src/constants';

test('Public CLI --version comes from its package metadata', () => {
  const packageMetadata = fs.readJsonSync(resolve(import.meta.dirname, '../package.json')) as {
    version?: unknown;
  };

  expect(CLI_VERSION).toBe(packageMetadata.version);
});
