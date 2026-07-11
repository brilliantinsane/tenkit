import {
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
  type UrlKeys,
} from "nuqs/server"

import {
  DEFAULT_CONFIGURATOR_PROJECT_NAME,
  DEFAULT_CONFIGURATOR_SETUP_TYPE,
} from "@/lib/configurator"

const withDefaultClearing = { clearOnDefault: true } as const
export const CONFIGURATOR_OPEN_URL_KEY = "cfg"

export const configuratorSearchParams = {
  open: parseAsBoolean.withDefault(false).withOptions(withDefaultClearing),
  projectName: parseAsString
    .withDefault(DEFAULT_CONFIGURATOR_PROJECT_NAME)
    .withOptions(withDefaultClearing),
  setupType: parseAsStringLiteral([
    "white-label",
    "runtime-tenants",
    "generic-standalone",
  ] as const)
    .withDefault(DEFAULT_CONFIGURATOR_SETUP_TYPE)
    .withOptions(withDefaultClearing),
  styling: parseAsStringLiteral(["bare", "uniwind"] as const)
    .withDefault("bare")
    .withOptions(withDefaultClearing),
  packageManager: parseAsStringLiteral(["pnpm", "npm", "bun"] as const)
    .withDefault("pnpm")
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
  open: CONFIGURATOR_OPEN_URL_KEY,
  projectName: "name",
  setupType: "setup",
  styling: "styling",
  packageManager: "pm",
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
    appVariantNamesSerialized: null,
    appVariantAccentsSerialized: null,
    git: null,
    install: null,
  } as const
}
