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

export type GeneratedSetupTypeDefinition = {
  setupType: GeneratedSetupType;
  publicSlug: PublicSetupSlug;
  templatePath: string;
  defaultProjectName: string;
  defaultPackageName: string;
  appVariantSlugs: readonly string[];
  readyMessage: string;
};

export const GENERATED_SETUP_TYPES = [
  {
    setupType: 'white-label-apps',
    publicSlug: 'white-label',
    templatePath: 'white-label',
    defaultProjectName: 'Tenkit White Label App',
    defaultPackageName: 'tenkit-white-label-app',
    appVariantSlugs: ['first-tenant', 'second-tenant'],
    readyMessage: 'Your Tenkit White Label app is ready!',
  },
  {
    setupType: 'single-app-runtime-tenants',
    publicSlug: 'runtime-tenants',
    templatePath: 'runtime-tenants',
    defaultProjectName: 'Tenkit Single App Runtime Tenants',
    defaultPackageName: 'tenkit-runtime-tenants',
    appVariantSlugs: ['acme-app'],
    readyMessage: 'Your Tenkit Single App Runtime Tenants app is ready!',
  },
  {
    setupType: 'generic-with-standalone-app-variants',
    publicSlug: 'generic-standalone',
    templatePath: 'generic-standalone',
    defaultProjectName: 'Tenkit Generic With Standalone App Variants',
    defaultPackageName: 'tenkit-generic-standalone',
    appVariantSlugs: ['atlas-network', 'west-studio'],
    readyMessage: 'Your Tenkit Generic With Standalone App Variants app is ready!',
  },
] as const satisfies readonly GeneratedSetupTypeDefinition[];

const PUBLIC_SETUP_SLUG_TO_SETUP_TYPE = {
  'white-label': 'white-label-apps',
  'runtime-tenants': 'single-app-runtime-tenants',
  'generic-standalone': 'generic-with-standalone-app-variants',
} as const satisfies Record<PublicSetupSlug, GeneratedSetupType>;

const SETUP_TYPE_DEFINITIONS = {
  'white-label-apps': GENERATED_SETUP_TYPES[0],
  'single-app-runtime-tenants': GENERATED_SETUP_TYPES[1],
  'generic-with-standalone-app-variants': GENERATED_SETUP_TYPES[2],
} as const satisfies Record<GeneratedSetupType, GeneratedSetupTypeDefinition>;

export function formatSupportedGeneratedSetupTypes(): string {
  return `public Setup slugs: ${SUPPORTED_PUBLIC_SETUP_SLUGS.join(', ')}; canonical Setup Type IDs: ${SUPPORTED_GENERATED_SETUP_TYPE_IDS.join(', ')}`;
}

export function normalizeGeneratedSetupType(setupType: string): GeneratedSetupType {
  if (SUPPORTED_PUBLIC_SETUP_SLUGS.includes(setupType as PublicSetupSlug)) {
    return PUBLIC_SETUP_SLUG_TO_SETUP_TYPE[setupType as PublicSetupSlug];
  }

  if (SUPPORTED_GENERATED_SETUP_TYPE_IDS.includes(setupType as GeneratedSetupType)) {
    return setupType as GeneratedSetupType;
  }

  throw new Error(
    `Unsupported generated Setup Type ${JSON.stringify(setupType)}. Expected ${formatSupportedGeneratedSetupTypes()}.`,
  );
}

export function getGeneratedSetupTypeDefinition(
  setupType: GeneratedSetupType,
): GeneratedSetupTypeDefinition {
  return SETUP_TYPE_DEFINITIONS[setupType];
}
