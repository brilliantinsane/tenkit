export const SUPPORTED_PUBLIC_SETUP_SLUGS = [
  'white-label',
  'runtime-tenants',
  'generic-standalone',
] as const;

export const SUPPORTED_GENERATED_SETUP_TYPE_IDS = [
  'white-label-apps',
  'single-app-runtime-tenants',
  'generic-with-standalone-app-variants',
] as const;

export const SUPPORTED_GENERATED_SETUP_TYPES = SUPPORTED_GENERATED_SETUP_TYPE_IDS;

export type PublicSetupSlug = (typeof SUPPORTED_PUBLIC_SETUP_SLUGS)[number];
export type GeneratedSetupType = (typeof SUPPORTED_GENERATED_SETUP_TYPE_IDS)[number];
export type GeneratedSetupTypeInput = PublicSetupSlug | GeneratedSetupType;
export type GeneratedAppVariantRole = 'white-label' | 'generic' | 'standalone';

export type GeneratedAppVariantDefinition = {
  appVariantId: number;
  role: GeneratedAppVariantRole;
  defaultName: string;
  defaultAccent: `#${string}`;
};

export type GeneratedSetupTypeDefinition = {
  setupType: GeneratedSetupType;
  publicSlug: PublicSetupSlug;
  templatePath: string;
  defaultProjectName: string;
  defaultPackageName: string;
  appVariants: readonly GeneratedAppVariantDefinition[];
};

export const GENERATED_SETUP_TYPE_DEFINITIONS = [
  {
    setupType: 'white-label-apps',
    publicSlug: 'white-label',
    templatePath: 'white-label',
    defaultProjectName: 'Tenkit White Label App',
    defaultPackageName: 'tenkit-white-label-app',
    appVariants: [
      {
        appVariantId: 1,
        role: 'white-label',
        defaultName: 'First Tenant',
        defaultAccent: '#208AEF',
      },
      {
        appVariantId: 2,
        role: 'white-label',
        defaultName: 'Second Tenant',
        defaultAccent: '#EF8520',
      },
    ],
  },
  {
    setupType: 'single-app-runtime-tenants',
    publicSlug: 'runtime-tenants',
    templatePath: 'runtime-tenants',
    defaultProjectName: 'Tenkit Single App Runtime Tenants',
    defaultPackageName: 'tenkit-runtime-tenants',
    appVariants: [
      {
        appVariantId: 1,
        role: 'generic',
        defaultName: 'Acme App',
        defaultAccent: '#EB2556',
      },
    ],
  },
  {
    setupType: 'generic-with-standalone-app-variants',
    publicSlug: 'generic-standalone',
    templatePath: 'generic-standalone',
    defaultProjectName: 'Tenkit Generic With Standalone App Variants',
    defaultPackageName: 'tenkit-generic-standalone',
    appVariants: [
      {
        appVariantId: 1,
        role: 'generic',
        defaultName: 'Atlas Network',
        defaultAccent: '#20EF99',
      },
      {
        appVariantId: 2,
        role: 'standalone',
        defaultName: 'West Studio',
        defaultAccent: '#9A00CD',
      },
    ],
  },
] as const satisfies readonly GeneratedSetupTypeDefinition[];

export function getGeneratedSetupTypeDefinition(
  setupType: GeneratedSetupType,
): GeneratedSetupTypeDefinition {
  const definition = GENERATED_SETUP_TYPE_DEFINITIONS.find(
    (candidate) => candidate.setupType === setupType,
  );

  if (!definition) {
    throw new Error(`Missing Setup Type definition for ${JSON.stringify(setupType)}.`);
  }

  return definition;
}

export function getGeneratedSetupTypeDefinitionByPublicSlug(
  publicSlug: PublicSetupSlug,
): GeneratedSetupTypeDefinition {
  const definition = GENERATED_SETUP_TYPE_DEFINITIONS.find(
    (candidate) => candidate.publicSlug === publicSlug,
  );

  if (!definition) {
    throw new Error(`Missing Setup Type definition for ${JSON.stringify(publicSlug)}.`);
  }

  return definition;
}

export type AppVariantIdentity = {
  displayName: string;
  slug: string;
  scheme: string;
  bundleIdentifier: `com.example.${string}`;
  packageName: `com.example.${string}`;
  hasNumericPrefix: boolean;
};

const LATIN_CHARACTERS_WITHOUT_DECOMPOSITIONS: Readonly<Record<string, string>> = {
  Æ: 'AE',
  Ð: 'D',
  Ø: 'O',
  Þ: 'TH',
  ß: 'ss',
  æ: 'ae',
  ð: 'd',
  ø: 'o',
  þ: 'th',
  Đ: 'D',
  đ: 'd',
  Ł: 'L',
  ł: 'l',
  Œ: 'OE',
  œ: 'oe',
};

function normalizeLatinIdentity(value: string): string {
  return Array.from(value.normalize('NFKD'))
    .map((character) => LATIN_CHARACTERS_WITHOUT_DECOMPOSITIONS[character] ?? character)
    .join('')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeProjectName(projectName: string): string {
  const normalizedProjectName = normalizeLatinIdentity(projectName.trim());

  if (!normalizedProjectName) {
    throw new Error('Project name must contain a usable Latin letter or number.');
  }

  return normalizedProjectName;
}

function isPathSeparatorPresent(value: string): boolean {
  return value.includes('/') || value.includes('\\');
}

function slugifyPackageName(projectName: string): string {
  return projectName
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function validatePackageName(value: string): string {
  const packageName = value.trim();

  if (packageName.length === 0) {
    throw new Error('Package name is required.');
  }

  if (packageName.length > 214) {
    throw new Error('Package name must be 214 characters or fewer.');
  }

  if (packageName !== packageName.toLowerCase()) {
    throw new Error('Package name must be lowercase.');
  }

  if (isPathSeparatorPresent(packageName)) {
    throw new Error('Package name must not contain path separators.');
  }

  if (packageName.startsWith('.') || packageName.startsWith('_')) {
    throw new Error('Package name must not start with "." or "_".');
  }

  if (!/^[a-z0-9][a-z0-9._-]*$/.test(packageName)) {
    throw new Error(
      'Package name must contain only lowercase letters, numbers, ".", "_", and "-".',
    );
  }

  return packageName;
}

export function derivePackageName(projectName: string): string {
  return validatePackageName(slugifyPackageName(projectName));
}

export function deriveAppVariantIdentity(appVariantName: string): AppVariantIdentity {
  if (appVariantName.includes(',')) {
    throw new Error('App Variant name must not contain commas.');
  }

  if (/\p{Cc}/u.test(appVariantName)) {
    throw new Error('App Variant name must not contain control characters.');
  }

  const displayName = appVariantName.trim();
  const normalizedName = normalizeLatinIdentity(displayName);

  if (!normalizedName) {
    throw new Error('App Variant name must contain a usable Latin letter or number.');
  }

  const hasNumericPrefix = /^\d/.test(normalizedName);
  const slug = hasNumericPrefix ? `app-${normalizedName}` : normalizedName;
  const nativeSuffix = slug.replaceAll('-', '');
  const nativeIdentifier = `com.example.${nativeSuffix}` as const;

  return {
    displayName,
    slug,
    scheme: nativeSuffix,
    bundleIdentifier: nativeIdentifier,
    packageName: nativeIdentifier,
    hasNumericPrefix,
  };
}

export function deriveAppVariantIdentities(
  appVariantNames: readonly string[],
): readonly AppVariantIdentity[] {
  const identities = appVariantNames.map(deriveAppVariantIdentity);
  const seenMachineIdentities = new Set<string>();

  for (const identity of identities) {
    const machineIdentities = new Set([
      identity.slug,
      identity.scheme,
      identity.bundleIdentifier,
      identity.packageName,
    ]);

    for (const machineIdentity of machineIdentities) {
      if (seenMachineIdentities.has(machineIdentity)) {
        throw new Error(
          `Duplicate derived App Variant identity ${JSON.stringify(machineIdentity)}.`,
        );
      }

      seenMachineIdentities.add(machineIdentity);
    }
  }

  return identities;
}
