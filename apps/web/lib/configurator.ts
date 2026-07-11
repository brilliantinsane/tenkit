import { parseColor } from "@ark-ui/react/color-picker"

import {
  deriveAppVariantIdentities,
  deriveAppVariantIdentity,
  GENERATED_SETUP_TYPE_DEFINITIONS,
  normalizeProjectName,
  type AppVariantIdentity,
  type PublicSetupSlug,
} from "@tenkit/template-generator/setup-type-definitions"

const CONFIGURATOR_ACCENT_HEX_PATTERN = /^#[0-9A-F]{6}$/

export const DEFAULT_CONFIGURATOR_PROJECT_NAME = "tenkit-app"
export const DEFAULT_CONFIGURATOR_SETUP_TYPE: PublicSetupSlug = "white-label"

export type ConfiguratorStyling = "bare" | "uniwind"
export type ConfiguratorPackageManager = "pnpm" | "npm" | "bun"

export type ConfiguratorState = {
  projectName: string
  setupType: PublicSetupSlug
  styling: ConfiguratorStyling
  packageManager: ConfiguratorPackageManager
  appVariantNames: readonly string[]
  appVariantAccents: readonly string[]
  git: boolean
  install: boolean
}

export type ConfiguratorAppVariantPreview = AppVariantIdentity & {
  warning?: string
}

function getSetupTypeDefinition(setupType: PublicSetupSlug) {
  const definition = GENERATED_SETUP_TYPE_DEFINITIONS.find(
    (candidate) => candidate.publicSlug === setupType
  )

  if (!definition) {
    throw new Error(
      `Missing Setup Type definition for ${JSON.stringify(setupType)}.`
    )
  }

  return definition
}

function getDefaultAppVariantValues(setupType: PublicSetupSlug) {
  const definition = getSetupTypeDefinition(setupType)

  return {
    appVariantNames: definition.appVariants.map(
      ({ defaultName }) => defaultName
    ),
    appVariantAccents: definition.appVariants.map(
      ({ defaultAccent }) => defaultAccent
    ),
  }
}

export function createDefaultConfiguratorState(
  setupType: PublicSetupSlug = DEFAULT_CONFIGURATOR_SETUP_TYPE
): ConfiguratorState {
  return {
    projectName: DEFAULT_CONFIGURATOR_PROJECT_NAME,
    setupType,
    styling: "bare",
    packageManager: "pnpm",
    ...getDefaultAppVariantValues(setupType),
    git: true,
    install: true,
  }
}

function arraysEqual(
  left: readonly string[],
  right: readonly string[]
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`
}

function getCreateLauncher(packageManager: ConfiguratorPackageManager): string {
  return packageManager === "npm"
    ? "npm create tenkit@latest --"
    : `${packageManager} create tenkit@latest`
}

export function buildConfiguratorCommand(state: ConfiguratorState): string {
  const normalizedProjectName = normalizeProjectName(state.projectName)
  const defaults = createDefaultConfiguratorState(state.setupType)
  const hasNonProjectChange =
    state.setupType !== DEFAULT_CONFIGURATOR_SETUP_TYPE ||
    state.styling !== "bare" ||
    state.packageManager !== "pnpm" ||
    !arraysEqual(state.appVariantNames, defaults.appVariantNames) ||
    !arraysEqual(state.appVariantAccents, defaults.appVariantAccents) ||
    !state.git ||
    !state.install

  if (!hasNonProjectChange) {
    return `pnpm create tenkit@latest --name ${normalizedProjectName} --yes`
  }

  return [
    getCreateLauncher(state.packageManager),
    "--name",
    normalizedProjectName,
    "--setup",
    state.setupType,
    "--variant-names",
    shellQuote(state.appVariantNames.join(",")),
    "--variant-accents",
    shellQuote(state.appVariantAccents.join(",")),
    "--styling",
    state.styling,
    "--package-manager",
    state.packageManager,
    state.git ? "--git" : "--no-git",
    state.install ? "--install" : "--no-install",
  ].join(" ")
}

export function updateAppVariantValue(
  values: readonly string[],
  index: number,
  nextValue: string
): readonly string[] {
  if (index < 0 || index >= values.length) {
    throw new Error(`App Variant position ${index} is out of range.`)
  }

  return values.map((value, valueIndex) =>
    valueIndex === index ? nextValue : value
  )
}

export function serializeAppVariantNames(
  appVariantNames: readonly string[],
  setupType: PublicSetupSlug
): string {
  const defaults = getDefaultAppVariantValues(setupType).appVariantNames
  return arraysEqual(appVariantNames, defaults) ? "" : appVariantNames.join(",")
}

function sanitizeConfiguratorAccentInput(value: string): string {
  return value.trim().replaceAll("+", " ").replace(/^RGBA/i, "rgba")
}

export function normalizeConfiguratorAccentHex(value: string): string {
  const trimmed = value.trim()

  if (CONFIGURATOR_ACCENT_HEX_PATTERN.test(trimmed)) {
    return trimmed.toUpperCase()
  }

  const candidates = [trimmed, sanitizeConfiguratorAccentInput(trimmed)]

  for (const candidate of candidates) {
    try {
      const color = parseColor(candidate)
      let hex = color.toString("hex")

      if (!hex.startsWith("#")) {
        hex = `#${hex}`
      }

      return hex.toUpperCase()
    } catch {
      continue
    }
  }

  return trimmed.toUpperCase()
}

export function isConfiguratorAccentHex(value: string): boolean {
  return CONFIGURATOR_ACCENT_HEX_PATTERN.test(value)
}

export function parseSerializedAppVariantAccents(
  serialized: string,
  defaults: readonly string[]
): readonly string[] {
  if (!serialized) {
    return defaults
  }

  const segments = serialized.split(/,(?=#)/)
  const normalized = segments.map(normalizeConfiguratorAccentHex)

  if (normalized.length === defaults.length) {
    return normalized
  }

  const hexMatches = [...serialized.matchAll(/#[0-9A-Fa-f]{6}/g)].map((match) =>
    match[0].toUpperCase()
  )

  if (hexMatches.length === defaults.length) {
    return hexMatches
  }

  return defaults
}

export function serializeAppVariantAccents(
  appVariantAccents: readonly string[],
  setupType: PublicSetupSlug
): string {
  const defaults = getDefaultAppVariantValues(setupType).appVariantAccents
  const normalized = appVariantAccents.map(normalizeConfiguratorAccentHex)
  const normalizedDefaults = defaults.map(normalizeConfiguratorAccentHex)

  return arraysEqual(normalized, normalizedDefaults) ? "" : normalized.join(",")
}

export function deriveConfiguratorAppVariantPreviews(
  appVariantNames: readonly string[]
): readonly ConfiguratorAppVariantPreview[] {
  return appVariantNames.map((appVariantName) => {
    const identity = deriveAppVariantIdentity(appVariantName)

    return {
      ...identity,
      warning: identity.hasNumericPrefix
        ? "Native identity starts with a number, so Tenkit adds the app prefix."
        : undefined,
    }
  })
}

export type ConfiguratorAppVariantItemCopy = {
  legend: string
  description?: string
}

export type ConfiguratorAppVariantSectionCopy = {
  sectionTitle: string
  sectionDescription: string
  items: readonly ConfiguratorAppVariantItemCopy[]
}

export function getConfiguratorAppVariantSectionCopy(
  setupType: PublicSetupSlug
): ConfiguratorAppVariantSectionCopy {
  const definition = getSetupTypeDefinition(setupType)

  if (setupType === "runtime-tenants") {
    return {
      sectionTitle: "App Variant",
      sectionDescription:
        "One native app identity shared by every Runtime Tenant. Runtime Tenant records are not customized here.",
      items: [
        {
          legend: "Native app identity",
          description:
            "Name, accent, and native identifiers for the installed app shell.",
        },
      ],
    }
  }

  if (setupType === "generic-standalone") {
    return {
      sectionTitle: "App Variants",
      sectionDescription:
        "A generic App Variant holds most Runtime Tenants. Selected brands can also ship as standalone App Variants.",
      items: definition.appVariants.map((appVariant) => {
        if (appVariant.role === "generic") {
          return {
            legend: "Generic App Variant",
            description:
              "The default native app most Runtime Tenants run inside.",
          }
        }

        return {
          legend: "Standalone App Variant",
          description:
            "A separate native app for a brand that breaks out of the generic shell.",
        }
      }),
    }
  }

  return {
    sectionTitle: "App Variants",
    sectionDescription:
      "Fixed by the selected Setup Type. Each App Variant owns its own native identity.",
    items: definition.appVariants.map((_, index) => ({
      legend: `App Variant ${index + 1}`,
    })),
  }
}

export function formatConfiguratorCommandMultiline(command: string): string {
  const parts = command.split(/\s+(?=--)/)

  if (parts.length <= 1) {
    return command
  }

  const [launcher, ...flags] = parts

  return [
    launcher,
    ...flags.map((flag, index) => {
      const line = `  ${flag}`
      return index === flags.length - 1 ? line : `${line} \\`
    }),
  ].join("\n")
}

export function validateConfiguratorAppVariantNames(
  appVariantNames: readonly string[]
): readonly (string | undefined)[] {
  const errors = appVariantNames.map((appVariantName) => {
    try {
      deriveAppVariantIdentity(appVariantName)
      return undefined
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  })

  if (errors.some(Boolean)) {
    return errors
  }

  try {
    deriveAppVariantIdentities(appVariantNames)
    return errors
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return appVariantNames.map(() => message)
  }
}
