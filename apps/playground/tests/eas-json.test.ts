/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { assert, test } from 'vitest';

type EasJson = {
  cli?: {
    version?: string;
    appVersionSource?: string;
  };
  build?: Record<string, Record<string, unknown>>;
  submit?: unknown;
};

const easJson = JSON.parse(readFileSync('eas.json', 'utf8')) as EasJson;

test('eas.json defines tenant-neutral EAS build profiles', () => {
  assert.deepEqual(easJson.cli, {
    version: '>= 20.3.0',
    appVersionSource: 'remote',
  });
  assert.deepEqual(easJson.build?.development, {
    developmentClient: true,
    distribution: 'internal',
    environment: 'development',
  });
  assert.deepEqual(easJson.build?.['development-simulator'], {
    extends: 'development',
    ios: {
      simulator: true,
    },
  });
  assert.deepEqual(easJson.build?.preview, {
    distribution: 'internal',
    environment: 'preview',
    android: {
      buildType: 'apk',
    },
  });
  assert.deepEqual(easJson.build?.production, {
    autoIncrement: true,
    environment: 'production',
  });
});

test('eas.json does not commit tenant IDs or submission placeholders', () => {
  const serialized = JSON.stringify(easJson);

  assert.equal('submit' in easJson, false);
  assert.equal(serialized.includes('ascAppId'), false);
  assert.equal(serialized.includes('appleTeamId'), false);
  assert.equal(serialized.includes('projectId'), false);
  assert.equal(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(serialized),
    false,
  );
});
