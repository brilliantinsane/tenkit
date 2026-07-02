import { expect, test, vi } from 'vitest';

import { DEFAULT_PROJECT_NAME } from '../src/constants';
import { validateProjectName } from '../src/create/validation';
import { createPromptAdapter } from '../src/prompts/create-prompts';

const textPrompt = vi.hoisted(() => vi.fn());

vi.mock('@clack/prompts', () => ({
  confirm: vi.fn(),
  isCancel: () => false,
  select: vi.fn(),
  text: textPrompt,
}));

test('text prompt accepts an empty submission as the default value', async () => {
  textPrompt.mockImplementationOnce(
    async (options: { defaultValue?: string; validate(value: string): string | undefined }) => {
      expect(options.defaultValue).toBeUndefined();
      expect(options.validate('')).toBeUndefined();
      return '';
    },
  );

  const prompts = createPromptAdapter();
  const answer = await prompts.text({
    message: 'Project name',
    placeholder: DEFAULT_PROJECT_NAME,
    defaultValue: DEFAULT_PROJECT_NAME,
    validate(value) {
      try {
        validateProjectName(value ?? '');
        return undefined;
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    },
  });

  expect(answer).toBe(DEFAULT_PROJECT_NAME);
});
