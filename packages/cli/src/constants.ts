import {
  SUPPORTED_PUBLIC_SETUP_SLUGS,
  type GeneratedSetupTypeInput,
  type PublicSetupSlug,
} from '@tenkit/template-generator';

export const CLI_VERSION = '0.1.0';
export const DEFAULT_PROJECT_NAME = 'tenkit-app';
export const DEFAULT_PUBLIC_SETUP_SLUG: PublicSetupSlug = 'white-label';
export const PROMPT_CANCELLED = Symbol('prompt-cancelled');

export type PromptChoice = {
  value: PublicSetupSlug;
  label: string;
};

export const SETUP_PROMPT_CHOICES = [
  { value: 'white-label', label: 'White Label Apps' },
  { value: 'runtime-tenants', label: 'Runtime Tenant App' },
  { value: 'generic-standalone', label: 'Generic + Standalone Apps' },
] as const satisfies readonly PromptChoice[];

export function supportedSetupValues(): readonly GeneratedSetupTypeInput[] {
  return SUPPORTED_PUBLIC_SETUP_SLUGS;
}
