import { describe, expect, test } from 'vitest';

import { defaultRunCommand } from '../src/adapters/command-runner';

describe('defaultRunCommand', () => {
  test('passes scoped child environment values without mutating the parent process', async () => {
    const variableName = 'TENKIT_TEST_CHILD_ENV';
    expect(process.env[variableName]).toBeUndefined();

    const result = await defaultRunCommand(
      process.execPath,
      ['-e', `process.exit(process.env.${variableName} === 'scoped' ? 0 : 1)`],
      process.cwd(),
      {
        env: { [variableName]: 'scoped' },
        stdio: 'ignore',
      },
    );

    expect(result).toEqual({ ok: true, code: 0 });
    expect(process.env[variableName]).toBeUndefined();
  });
});
