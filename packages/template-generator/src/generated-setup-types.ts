import {
  deriveAppVariantIdentity,
  getGeneratedSetupTypeDefinition,
  getGeneratedSetupTypeDefinitionByPublicSlug,
  SUPPORTED_GENERATED_SETUP_TYPE_IDS,
  SUPPORTED_PUBLIC_SETUP_SLUGS,
  type GeneratedSetupType,
  type GeneratedSetupTypeDefinition as SharedGeneratedSetupTypeDefinition,
  type PublicSetupSlug,
} from './generated-setup-type-definitions';

export {
  SUPPORTED_GENERATED_SETUP_TYPE_IDS,
  SUPPORTED_GENERATED_SETUP_TYPES,
  SUPPORTED_PUBLIC_SETUP_SLUGS,
  type GeneratedSetupType,
  type GeneratedSetupTypeInput,
  type PublicSetupSlug,
} from './generated-setup-type-definitions';

export type GeneratedSetupTypeDefinition = SharedGeneratedSetupTypeDefinition & {
  appVariantSlugs: readonly string[];
  readyMessage: string;
};

const READY_MESSAGES = {
  'white-label-apps': 'Your Tenkit White Label app is ready!',
  'single-app-runtime-tenants': 'Your Tenkit Single App Runtime Tenants app is ready!',
  'generic-with-standalone-app-variants':
    'Your Tenkit Generic With Standalone App Variants app is ready!',
} as const satisfies Record<GeneratedSetupType, string>;

export function formatSupportedGeneratedSetupTypes(): string {
  return `public Setup slugs: ${SUPPORTED_PUBLIC_SETUP_SLUGS.join(', ')}; canonical Setup Type IDs: ${SUPPORTED_GENERATED_SETUP_TYPE_IDS.join(', ')}`;
}

export function normalizeGeneratedSetupType(setupType: string): GeneratedSetupType {
  if (SUPPORTED_PUBLIC_SETUP_SLUGS.includes(setupType as PublicSetupSlug)) {
    return getGeneratedSetupTypeDefinitionByPublicSlug(setupType as PublicSetupSlug).setupType;
  }

  if (SUPPORTED_GENERATED_SETUP_TYPE_IDS.includes(setupType as GeneratedSetupType)) {
    return setupType as GeneratedSetupType;
  }

  throw new Error(
    `Unsupported generated Setup Type ${JSON.stringify(setupType)}. Expected ${formatSupportedGeneratedSetupTypes()}.`,
  );
}

export function getGeneratedSetupTypeMetadata(
  setupType: GeneratedSetupType,
): GeneratedSetupTypeDefinition {
  const definition = getGeneratedSetupTypeDefinition(setupType);

  return {
    ...definition,
    appVariantSlugs: definition.appVariants.map(
      ({ defaultName }) => deriveAppVariantIdentity(defaultName).slug,
    ),
    readyMessage: READY_MESSAGES[setupType],
  };
}
