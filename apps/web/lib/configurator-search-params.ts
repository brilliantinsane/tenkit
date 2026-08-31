import {
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
  type UrlKeys,
} from "nuqs/server"

import {
  CONFIGURATOR_PACKAGE_MANAGER_VALUES,
  CONFIGURATOR_SETUP_TYPE_VALUES,
  CONFIGURATOR_STYLING_VALUES,
  DEFAULT_CONFIGURATOR_PROJECT_NAME,
  DEFAULT_CONFIGURATOR_SETUP_TYPE,
} from "@/lib/configurator"
import {
  DEFAULT_GENERATED_APP_OPTIONS,
  SUPPORTED_GENERATED_AUTH_VALUES,
  SUPPORTED_GENERATED_BACKEND_VALUES,
  SUPPORTED_GENERATED_DATABASE_VALUES,
  SUPPORTED_GENERATED_ORM_VALUES,
} from "@tenkit/types/generated-app-option-definitions"

const withDefaultClearing = { clearOnDefault: true } as const

export const configuratorSearchParams = {
  projectName: parseAsString
    .withDefault(DEFAULT_CONFIGURATOR_PROJECT_NAME)
    .withOptions(withDefaultClearing),
  setupType: parseAsStringLiteral(CONFIGURATOR_SETUP_TYPE_VALUES)
    .withDefault(DEFAULT_CONFIGURATOR_SETUP_TYPE)
    .withOptions(withDefaultClearing),
  styling: parseAsStringLiteral(CONFIGURATOR_STYLING_VALUES)
    .withDefault("bare")
    .withOptions(withDefaultClearing),
  packageManager: parseAsStringLiteral(CONFIGURATOR_PACKAGE_MANAGER_VALUES)
    .withDefault("pnpm")
    .withOptions(withDefaultClearing),
  backend: parseAsStringLiteral(SUPPORTED_GENERATED_BACKEND_VALUES)
    .withDefault(DEFAULT_GENERATED_APP_OPTIONS.backend)
    .withOptions(withDefaultClearing),
  auth: parseAsStringLiteral(SUPPORTED_GENERATED_AUTH_VALUES)
    .withDefault(DEFAULT_GENERATED_APP_OPTIONS.auth)
    .withOptions(withDefaultClearing),
  database: parseAsStringLiteral(SUPPORTED_GENERATED_DATABASE_VALUES)
    .withDefault(DEFAULT_GENERATED_APP_OPTIONS.database)
    .withOptions(withDefaultClearing),
  orm: parseAsStringLiteral(SUPPORTED_GENERATED_ORM_VALUES)
    .withDefault(DEFAULT_GENERATED_APP_OPTIONS.orm)
    .withOptions(withDefaultClearing),
  appVariantNamesSerialized: parseAsString
    .withDefault("")
    .withOptions(withDefaultClearing),
  appVariantAccentsSerialized: parseAsString
    .withDefault("")
    .withOptions(withDefaultClearing),
  git: parseAsBoolean.withDefault(true).withOptions(withDefaultClearing),
  install: parseAsBoolean.withDefault(true).withOptions(withDefaultClearing),
}

export const configuratorUrlKeys: UrlKeys<typeof configuratorSearchParams> = {
  projectName: "name",
  setupType: "setup",
  styling: "styling",
  packageManager: "pm",
  backend: "backend",
  auth: "auth",
  database: "db",
  orm: "orm",
  appVariantNamesSerialized: "vn",
  appVariantAccentsSerialized: "vacc",
  git: "git",
  install: "i",
}

export function getConfiguratorDefaultsReset() {
  return {
    projectName: null,
    setupType: null,
    styling: null,
    packageManager: null,
    backend: null,
    auth: null,
    database: null,
    orm: null,
    appVariantNamesSerialized: null,
    appVariantAccentsSerialized: null,
    git: null,
    install: null,
  } as const
}
