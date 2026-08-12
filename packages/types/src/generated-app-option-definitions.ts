export const SUPPORTED_GENERATED_BACKEND_VALUES = Object.freeze([
  'none',
  'express',
  'nestjs',
  'convex',
] as const);
export const SUPPORTED_GENERATED_AUTH_VALUES = Object.freeze([
  'none',
  'better-auth',
  'clerk',
] as const);
export const SUPPORTED_GENERATED_DATABASE_VALUES = Object.freeze([
  'none',
  'postgresql',
  'mysql',
] as const);
export const SUPPORTED_GENERATED_ORM_VALUES = Object.freeze(['none', 'prisma', 'drizzle'] as const);

export type GeneratedBackend = (typeof SUPPORTED_GENERATED_BACKEND_VALUES)[number];
export type GeneratedNodeBackend = Extract<GeneratedBackend, 'express' | 'nestjs'>;
export type GeneratedAuth = (typeof SUPPORTED_GENERATED_AUTH_VALUES)[number];
export type GeneratedDatabase = (typeof SUPPORTED_GENERATED_DATABASE_VALUES)[number];
export type GeneratedOrm = (typeof SUPPORTED_GENERATED_ORM_VALUES)[number];

export function isGeneratedNodeBackend(backend: GeneratedBackend): backend is GeneratedNodeBackend {
  return backend === 'express' || backend === 'nestjs';
}

export type GeneratedAppOptions = {
  readonly backend: GeneratedBackend;
  readonly auth: GeneratedAuth;
  readonly database: GeneratedDatabase;
  readonly orm: GeneratedOrm;
};

export type RawGeneratedAppOptions = {
  backend?: string;
  auth?: string;
  database?: string;
  orm?: string;
};

export const DEFAULT_GENERATED_APP_OPTIONS = Object.freeze({
  backend: 'none',
  auth: 'none',
  database: 'none',
  orm: 'none',
} as const satisfies GeneratedAppOptions);

export const SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS = Object.freeze([
  DEFAULT_GENERATED_APP_OPTIONS,
  Object.freeze({
    backend: 'express',
    auth: 'none',
    database: 'none',
    orm: 'none',
  } as const satisfies GeneratedAppOptions),
  Object.freeze({
    backend: 'nestjs',
    auth: 'none',
    database: 'none',
    orm: 'none',
  } as const satisfies GeneratedAppOptions),
  Object.freeze({
    backend: 'convex',
    auth: 'none',
    database: 'none',
    orm: 'none',
  } as const satisfies GeneratedAppOptions),
  Object.freeze({
    backend: 'express',
    auth: 'clerk',
    database: 'none',
    orm: 'none',
  } as const satisfies GeneratedAppOptions),
  Object.freeze({
    backend: 'nestjs',
    auth: 'clerk',
    database: 'none',
    orm: 'none',
  } as const satisfies GeneratedAppOptions),
  Object.freeze({
    backend: 'express',
    auth: 'none',
    database: 'postgresql',
    orm: 'prisma',
  } as const satisfies GeneratedAppOptions),
  Object.freeze({
    backend: 'express',
    auth: 'better-auth',
    database: 'postgresql',
    orm: 'prisma',
  } as const satisfies GeneratedAppOptions),
  Object.freeze({
    backend: 'express',
    auth: 'clerk',
    database: 'postgresql',
    orm: 'prisma',
  } as const satisfies GeneratedAppOptions),
  Object.freeze({
    backend: 'nestjs',
    auth: 'none',
    database: 'postgresql',
    orm: 'prisma',
  } as const satisfies GeneratedAppOptions),
] as const satisfies readonly GeneratedAppOptions[]);

export type GeneratedAppOptionGroup = keyof GeneratedAppOptions;

export type GeneratedAppOptionIssue =
  | {
      code: 'unsupported-value';
      option: GeneratedAppOptionGroup;
      value: string;
      supportedValues: readonly string[];
    }
  | {
      code: 'unsupported-combination';
      selection: Readonly<Partial<GeneratedAppOptions>>;
      supportedCombinations: readonly GeneratedAppOptions[];
    };

export type GeneratedAppOptionsResolution =
  | { status: 'resolved'; selection: GeneratedAppOptions }
  | { status: 'invalid'; issues: readonly GeneratedAppOptionIssue[] };

export type GeneratedAppOptionChoice<Value extends string> = {
  status: 'selected' | 'resolved' | 'selectable';
  values: readonly Value[];
  value?: Value;
};

export type GeneratedAppOptionChoiceState =
  | {
      status: 'available';
      backend: GeneratedAppOptionChoice<GeneratedBackend>;
      auth: GeneratedAppOptionChoice<GeneratedAuth>;
      database: GeneratedAppOptionChoice<GeneratedDatabase>;
      orm: GeneratedAppOptionChoice<GeneratedOrm>;
    }
  | { status: 'invalid'; issues: readonly GeneratedAppOptionIssue[] };

type NormalizedPartialGeneratedAppOptions = Readonly<Partial<GeneratedAppOptions>>;
type MutablePartialGeneratedAppOptions = {
  -readonly [Option in GeneratedAppOptionGroup]?: GeneratedAppOptions[Option];
};

type PartialNormalization =
  | { status: 'normalized'; selection: NormalizedPartialGeneratedAppOptions }
  | { status: 'invalid'; issues: readonly GeneratedAppOptionIssue[] };

function isGeneratedBackend(value: string): value is GeneratedBackend {
  return SUPPORTED_GENERATED_BACKEND_VALUES.some((candidate) => candidate === value);
}

function isGeneratedAuth(value: string): value is GeneratedAuth {
  return SUPPORTED_GENERATED_AUTH_VALUES.some((candidate) => candidate === value);
}

function isGeneratedDatabase(value: string): value is GeneratedDatabase {
  return SUPPORTED_GENERATED_DATABASE_VALUES.some((candidate) => candidate === value);
}

function isGeneratedOrm(value: string): value is GeneratedOrm {
  return SUPPORTED_GENERATED_ORM_VALUES.some((candidate) => candidate === value);
}

function normalizePartialGeneratedAppOptions(
  rawOptions: RawGeneratedAppOptions,
): PartialNormalization {
  const issues: GeneratedAppOptionIssue[] = [];
  const selection: MutablePartialGeneratedAppOptions = {};

  if (rawOptions.backend !== undefined) {
    if (isGeneratedBackend(rawOptions.backend)) {
      selection.backend = rawOptions.backend;
    } else {
      issues.push({
        code: 'unsupported-value',
        option: 'backend',
        value: rawOptions.backend,
        supportedValues: SUPPORTED_GENERATED_BACKEND_VALUES,
      });
    }
  }

  if (rawOptions.auth !== undefined) {
    if (isGeneratedAuth(rawOptions.auth)) {
      selection.auth = rawOptions.auth;
    } else {
      issues.push({
        code: 'unsupported-value',
        option: 'auth',
        value: rawOptions.auth,
        supportedValues: SUPPORTED_GENERATED_AUTH_VALUES,
      });
    }
  }

  if (rawOptions.database !== undefined) {
    if (isGeneratedDatabase(rawOptions.database)) {
      selection.database = rawOptions.database;
    } else {
      issues.push({
        code: 'unsupported-value',
        option: 'database',
        value: rawOptions.database,
        supportedValues: SUPPORTED_GENERATED_DATABASE_VALUES,
      });
    }
  }

  if (rawOptions.orm !== undefined) {
    if (isGeneratedOrm(rawOptions.orm)) {
      selection.orm = rawOptions.orm;
    } else {
      issues.push({
        code: 'unsupported-value',
        option: 'orm',
        value: rawOptions.orm,
        supportedValues: SUPPORTED_GENERATED_ORM_VALUES,
      });
    }
  }

  return issues.length > 0 ? { status: 'invalid', issues } : { status: 'normalized', selection };
}

function matchesPartialSelection(
  combination: GeneratedAppOptions,
  selection: NormalizedPartialGeneratedAppOptions,
): boolean {
  return (
    (selection.backend === undefined || combination.backend === selection.backend) &&
    (selection.auth === undefined || combination.auth === selection.auth) &&
    (selection.database === undefined || combination.database === selection.database) &&
    (selection.orm === undefined || combination.orm === selection.orm)
  );
}

function uniqueChoiceValues<Option extends GeneratedAppOptionGroup>(
  combinations: readonly GeneratedAppOptions[],
  option: Option,
): readonly GeneratedAppOptions[Option][] {
  return [...new Set(combinations.map((combination) => combination[option]))];
}

function createChoice<Option extends GeneratedAppOptionGroup>(
  combinations: readonly GeneratedAppOptions[],
  option: Option,
  selectedValue: GeneratedAppOptions[Option] | undefined,
): GeneratedAppOptionChoice<GeneratedAppOptions[Option]> {
  const values = uniqueChoiceValues(combinations, option);

  if (selectedValue !== undefined) {
    return { status: 'selected', values, value: selectedValue };
  }

  if (values.length === 1) {
    return { status: 'resolved', values, value: values[0] };
  }

  return { status: 'selectable', values };
}

export function resolveGeneratedAppOptions(
  rawOptions: RawGeneratedAppOptions,
): GeneratedAppOptionsResolution {
  const normalization = normalizePartialGeneratedAppOptions(rawOptions);
  if (normalization.status === 'invalid') {
    return normalization;
  }

  const selection: GeneratedAppOptions = {
    backend: normalization.selection.backend ?? DEFAULT_GENERATED_APP_OPTIONS.backend,
    auth: normalization.selection.auth ?? DEFAULT_GENERATED_APP_OPTIONS.auth,
    database: normalization.selection.database ?? DEFAULT_GENERATED_APP_OPTIONS.database,
    orm: normalization.selection.orm ?? DEFAULT_GENERATED_APP_OPTIONS.orm,
  };
  const supportedCombination = SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS.find((combination) =>
    matchesPartialSelection(combination, selection),
  );

  if (supportedCombination === undefined) {
    return {
      status: 'invalid',
      issues: [
        {
          code: 'unsupported-combination',
          selection,
          supportedCombinations: SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS,
        },
      ],
    };
  }

  return { status: 'resolved', selection: Object.freeze({ ...supportedCombination }) };
}

export function getGeneratedAppOptionChoiceState(
  rawSelection: RawGeneratedAppOptions,
): GeneratedAppOptionChoiceState {
  const normalization = normalizePartialGeneratedAppOptions(rawSelection);
  if (normalization.status === 'invalid') {
    return normalization;
  }

  const compatibleCombinations = SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS.filter((combination) =>
    matchesPartialSelection(combination, normalization.selection),
  );
  if (compatibleCombinations.length === 0) {
    return {
      status: 'invalid',
      issues: [
        {
          code: 'unsupported-combination',
          selection: normalization.selection,
          supportedCombinations: SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS,
        },
      ],
    };
  }

  return {
    status: 'available',
    backend: createChoice(compatibleCombinations, 'backend', normalization.selection.backend),
    auth: createChoice(compatibleCombinations, 'auth', normalization.selection.auth),
    database: createChoice(compatibleCombinations, 'database', normalization.selection.database),
    orm: createChoice(compatibleCombinations, 'orm', normalization.selection.orm),
  };
}
