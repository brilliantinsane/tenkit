import {
  formatSupportedGeneratedSetupTypes,
  normalizeGeneratedAccentColor,
  normalizeGeneratedSetupType,
  normalizeGeneratedStylingChoice,
  type GeneratedAccentColor,
  type GeneratedStylingChoice,
  type GeneratedSetupType,
} from '@tenkit/template-generator';
import {
  deriveAppVariantIdentity,
  deriveAppVariantIdentities,
  getGeneratedSetupTypeDefinition,
  normalizeProjectName,
} from '@tenkit/template-generator/setup-type-definitions';

import { DEFAULT_PUBLIC_SETUP_SLUG, supportedStylingValues } from '../constants';

function isPathSeparatorPresent(value: string): boolean {
  return value.includes('/') || value.includes('\\');
}

export function validateProjectName(value: string): string {
  try {
    return normalizeProjectName(value);
  } catch {
    throw new Error('Project name must contain a usable Latin letter or number.');
  }
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
  const packageName = slugifyPackageName(projectName);

  return validatePackageName(packageName);
}

export function normalizeAppVariantNameInput(value: string): string {
  return deriveAppVariantIdentity(value).displayName;
}

export function normalizeAppVariantAccentInput(value: string): GeneratedAccentColor {
  const accent = value.trim();
  const normalizedInput = accent.startsWith('#') ? accent : `#${accent}`;

  try {
    const normalizedAccent = normalizeGeneratedAccentColor(normalizedInput);

    if (normalizedAccent) {
      return normalizedAccent;
    }
  } catch {}

  throw new Error(
    `Invalid App Variant Accent ${JSON.stringify(accent)}. Expected a six-digit hex color such as "#208AEF".`,
  );
}

export function normalizeSetupInput(
  setup: string | undefined,
  setupType: string | undefined,
): GeneratedSetupType {
  if (setup !== undefined && setupType !== undefined && setup !== setupType) {
    throw new Error('Use either --setup or --setup-type, not both with different values.');
  }

  const selectedSetup = setup ?? setupType ?? DEFAULT_PUBLIC_SETUP_SLUG;

  try {
    return normalizeGeneratedSetupType(selectedSetup);
  } catch {
    throw new Error(
      `Unsupported Setup Type ${JSON.stringify(selectedSetup)}. Expected ${formatSupportedGeneratedSetupTypes()}.`,
    );
  }
}

export function normalizeStylingInput(value: string | undefined): GeneratedStylingChoice {
  try {
    return normalizeGeneratedStylingChoice(value);
  } catch {
    throw new Error(
      `Unsupported Styling Choice ${JSON.stringify(value)}. Expected one of: ${supportedStylingValues().join(', ')}.`,
    );
  }
}

export function normalizeAppVariantCustomization(
  setupType: GeneratedSetupType,
  appVariantNamesInput: string | undefined,
  appVariantAccentsInput: string | undefined,
): {
  appVariantNames: readonly string[];
  appVariantAccents: readonly GeneratedAccentColor[];
} {
  const definition = getGeneratedSetupTypeDefinition(setupType);

  const appVariantNames =
    appVariantNamesInput === undefined
      ? definition.appVariants.map(({ defaultName }) => defaultName)
      : appVariantNamesInput.split(',').map((name) => name.trim());

  if (appVariantNames.some((name) => name.length === 0)) {
    throw new Error('App Variant names must not contain empty items.');
  }

  if (appVariantNames.length !== definition.appVariants.length) {
    throw new Error(
      `Expected exactly ${definition.appVariants.length} App Variant names for ${definition.publicSlug}.`,
    );
  }

  deriveAppVariantIdentities(appVariantNames);

  const rawAccents =
    appVariantAccentsInput === undefined
      ? definition.appVariants.map(({ defaultAccent }) => defaultAccent)
      : appVariantAccentsInput.split(',').map((accent) => accent.trim());

  if (rawAccents.some((accent) => accent.length === 0)) {
    throw new Error('App Variant Accents must not contain empty items.');
  }

  if (rawAccents.length !== definition.appVariants.length) {
    throw new Error(
      `Expected exactly ${definition.appVariants.length} App Variant Accents for ${definition.publicSlug}.`,
    );
  }

  const appVariantAccents = rawAccents.map(normalizeAppVariantAccentInput);

  return { appVariantNames, appVariantAccents };
}
