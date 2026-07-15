import {
  SUPPORTED_PUBLIC_SETUP_SLUGS,
  type GeneratedSetupTypeInput,
  type PublicSetupSlug,
} from '@tenkit/template-generator';
import {
  SUPPORTED_GENERATED_STYLING_CHOICES,
  type GeneratedStylingChoice,
} from '@tenkit/template-generator/styling-definitions';

export const CLI_VERSION = '0.1.2';
export const DEFAULT_PROJECT_NAME = 'tenkit-app';
export const DEFAULT_PUBLIC_SETUP_SLUG: PublicSetupSlug = 'white-label';
export const DEFAULT_STYLING_CHOICE: GeneratedStylingChoice = 'bare';
export const PROMPT_CANCELLED = Symbol('prompt-cancelled');

export type PromptChoice<Value extends string> = {
  value: Value;
  label: string;
};

export const SETUP_PROMPT_CHOICES = [
  { value: 'white-label', label: 'White Label Apps' },
  { value: 'runtime-tenants', label: 'Runtime Tenant App' },
  { value: 'generic-standalone', label: 'Generic + Standalone Apps' },
] as const satisfies readonly PromptChoice<PublicSetupSlug>[];

const STYLING_PROMPT_LABELS = {
  bare: 'Bare',
  uniwind: 'Uniwind',
  unistyles: 'Unistyles',
} as const satisfies Record<GeneratedStylingChoice, string>;

export const STYLING_PROMPT_CHOICES: readonly PromptChoice<GeneratedStylingChoice>[] =
  SUPPORTED_GENERATED_STYLING_CHOICES.map((value) => ({
    value,
    label: STYLING_PROMPT_LABELS[value],
  }));

export function supportedSetupValues(): readonly GeneratedSetupTypeInput[] {
  return SUPPORTED_PUBLIC_SETUP_SLUGS;
}

export function supportedStylingValues(): readonly GeneratedStylingChoice[] {
  return SUPPORTED_GENERATED_STYLING_CHOICES;
}
