import { describe, expect, test } from 'vitest';

import { parseExactStableVersion } from '../src/exact-stable-version';

describe('exact stable version parsing', () => {
  test.each([
    ['0.0.0', ['0', '0', '0']],
    ['12.34.56', ['12', '34', '56']],
  ])('parses exact stable version %s', (version, expectedParts) => {
    expect(parseExactStableVersion(version)).toEqual(expectedParts);
  });

  test.each([
    '',
    'v1.2.3',
    '1.2',
    '1.2.3.4',
    '1.2.3-beta.1',
    ' 1.2.3',
    '01.2.3',
    '1.02.3',
    '1.2.03',
  ])('rejects non-exact version %j', (version) => {
    expect(parseExactStableVersion(version)).toBeUndefined();
  });
});
