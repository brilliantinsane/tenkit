import { describe, expect, test } from 'vitest';

import { parseExactReleaseSetVersion } from '../src/exact-release-set-version';

describe('exact Release Set versions', () => {
  test.each([
    [
      '1.2.3',
      {
        channel: 'stable',
        version: '1.2.3',
        targetVersion: '1.2.3',
      },
    ],
    [
      '1.2.3-rc.4',
      {
        channel: 'rc',
        version: '1.2.3-rc.4',
        targetVersion: '1.2.3',
        ordinal: 4,
      },
    ],
  ] as const)('parses %s', (version, expected) => {
    expect(parseExactReleaseSetVersion(version)).toEqual(expected);
  });

  test.each([
    'v1.2.3',
    '1.2',
    '01.2.3',
    '1.2.3-next.1',
    '1.2.3-rc.0',
    '1.2.3-rc.01',
    '1.2.3-rc.-1',
    '1.2.3-rc.999999999999999999999999',
  ])('rejects %s', (version) => {
    expect(parseExactReleaseSetVersion(version)).toBeUndefined();
  });
});
