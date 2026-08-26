import {
  SUPPORTED_GENERATED_AUTH_VALUES,
  SUPPORTED_GENERATED_BACKEND_VALUES,
  SUPPORTED_GENERATED_DATABASE_VALUES,
  SUPPORTED_GENERATED_ORM_VALUES,
  type GeneratedAuth,
  type GeneratedBackend,
  type GeneratedDatabase,
  type GeneratedOrm,
} from '@tenkit/types/generated-app-option-definitions';
import {
  SUPPORTED_PUBLIC_SETUP_SLUGS,
  type GeneratedSetupTypeInput,
  type PublicSetupSlug,
} from '@tenkit/types/setup-type-definitions';
import {
  SUPPORTED_GENERATED_STYLING_CHOICES,
  type GeneratedStylingChoice,
} from '@tenkit/types/styling-definitions';
import cliPackageMetadata from '../package.json' with { type: 'json' };

export const CLI_VERSION = cliPackageMetadata.version;
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

const BACKEND_PROMPT_LABELS = {
  none: 'None',
  express: 'Express',
  nestjs: 'NestJS',
  convex: 'Convex',
} as const satisfies Record<GeneratedBackend, string>;

export const BACKEND_PROMPT_CHOICES: readonly PromptChoice<GeneratedBackend>[] =
  SUPPORTED_GENERATED_BACKEND_VALUES.map((value) => ({
    value,
    label: BACKEND_PROMPT_LABELS[value],
  }));

const AUTH_PROMPT_LABELS = {
  none: 'None',
  'better-auth': 'Better Auth',
  clerk: 'Clerk',
} as const satisfies Record<GeneratedAuth, string>;

export const AUTH_PROMPT_CHOICES: readonly PromptChoice<GeneratedAuth>[] =
  SUPPORTED_GENERATED_AUTH_VALUES.map((value) => ({
    value,
    label: AUTH_PROMPT_LABELS[value],
  }));

const DATABASE_PROMPT_LABELS = {
  none: 'None',
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
} as const satisfies Record<GeneratedDatabase, string>;

export const DATABASE_PROMPT_CHOICES: readonly PromptChoice<GeneratedDatabase>[] =
  SUPPORTED_GENERATED_DATABASE_VALUES.map((value) => ({
    value,
    label: DATABASE_PROMPT_LABELS[value],
  }));

const ORM_PROMPT_LABELS = {
  none: 'None',
  prisma: 'Prisma',
  drizzle: 'Drizzle',
} as const satisfies Record<GeneratedOrm, string>;

export const ORM_PROMPT_CHOICES: readonly PromptChoice<GeneratedOrm>[] =
  SUPPORTED_GENERATED_ORM_VALUES.map((value) => ({
    value,
    label: ORM_PROMPT_LABELS[value],
  }));

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

export function supportedBackendValues(): readonly GeneratedBackend[] {
  return SUPPORTED_GENERATED_BACKEND_VALUES;
}

export function supportedAuthValues(): readonly GeneratedAuth[] {
  return SUPPORTED_GENERATED_AUTH_VALUES;
}

export function supportedDatabaseValues(): readonly GeneratedDatabase[] {
  return SUPPORTED_GENERATED_DATABASE_VALUES;
}

export function supportedOrmValues(): readonly GeneratedOrm[] {
  return SUPPORTED_GENERATED_ORM_VALUES;
}
