import { confirm, isCancel, select, text } from '@clack/prompts';

import { PROMPT_CANCELLED } from '../constants';
import type { PromptAdapter } from '../create/types';

export function createPromptAdapter(): PromptAdapter {
  return {
    async text(options) {
      const { defaultValue, validate, ...promptOptions } = options;
      const answer = await text({
        ...promptOptions,
        validate(value) {
          return validate(value === '' || value === undefined ? defaultValue : value);
        },
      });
      return isCancel(answer)
        ? PROMPT_CANCELLED
        : answer === '' || answer === undefined
          ? defaultValue
          : String(answer);
    },
    async select(options) {
      const answer = await select<string>({
        message: options.message,
        initialValue: options.initialValue,
        options: options.options.map((option) => ({
          value: option.value,
          label: option.label,
        })),
      });

      if (isCancel(answer)) {
        return PROMPT_CANCELLED;
      }

      const selectedOption = options.options.find((option) => option.value === answer);

      if (!selectedOption) {
        throw new Error(`Prompt returned unsupported selection ${JSON.stringify(answer)}.`);
      }

      return selectedOption.value;
    },
    async confirm(options) {
      const answer = await confirm(options);
      return isCancel(answer) ? PROMPT_CANCELLED : answer;
    },
  };
}
