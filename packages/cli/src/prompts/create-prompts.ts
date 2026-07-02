import { confirm, isCancel, select, text } from '@clack/prompts';

import { PROMPT_CANCELLED } from '../constants';
import type { PromptAdapter } from '../create/types';

export function createPromptAdapter(): PromptAdapter {
  return {
    async text(options) {
      const answer = await text({
        ...options,
        validate(value) {
          return options.validate(
            value === '' || value === undefined ? options.defaultValue : value,
          );
        },
      });
      return isCancel(answer)
        ? PROMPT_CANCELLED
        : answer === ''
          ? options.defaultValue
          : String(answer);
    },
    async select(options) {
      const answer = await select({
        ...options,
        options: options.options.map((option) => ({
          value: option.value,
          label: option.label,
        })),
      });

      return isCancel(answer) ? PROMPT_CANCELLED : answer;
    },
    async confirm(options) {
      const answer = await confirm(options);
      return isCancel(answer) ? PROMPT_CANCELLED : answer;
    },
  };
}
