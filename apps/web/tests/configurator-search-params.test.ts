import { describe, expect, test } from "vitest"
import { createLoader, createSerializer } from "nuqs/server"

import {
  configuratorSearchParams,
  configuratorUrlKeys,
  getConfiguratorDefaultsReset,
} from "@/lib/configurator-search-params"

describe("Configurator search params", () => {
  const serialize = createSerializer(configuratorSearchParams, {
    urlKeys: configuratorUrlKeys,
  })
  const load = createLoader(configuratorSearchParams, {
    urlKeys: configuratorUrlKeys,
  })

  test("serializes aliases, ordered lists, and false boolean choices", () => {
    const url = serialize({
      projectName: "My App",
      setupType: "generic-standalone",
      styling: "uniwind",
      packageManager: "npm",
      appVariantNamesSerialized: "Tenkit Network,North Studio",
      appVariantAccentsSerialized: "#208AEF,#123ABC",
      git: false,
      install: false,
    })
    const query = new URLSearchParams(url)

    expect(Object.fromEntries(query)).toEqual({
      name: "My App",
      setup: "generic-standalone",
      styling: "uniwind",
      pm: "npm",
      vn: "Tenkit Network,North Studio",
      vacc: "#208AEF,#123ABC",
      git: "false",
      i: "false",
    })
    expect(load(query)).toMatchObject({
      projectName: "My App",
      appVariantNamesSerialized: "Tenkit Network,North Studio",
      appVariantAccentsSerialized: "#208AEF,#123ABC",
      git: false,
      install: false,
    })
  })

  test("clears values after they return to parser defaults", () => {
    expect(
      serialize({
        projectName: "tenkit-app",
        setupType: "white-label",
        styling: "bare",
        packageManager: "pnpm",
        appVariantNamesSerialized: "",
        appVariantAccentsSerialized: "",
        git: true,
        install: true,
      })
    ).toBe("")
  })

  test("resets every choice without closing the Configurator", () => {
    expect(getConfiguratorDefaultsReset()).toEqual({
      projectName: null,
      setupType: null,
      styling: null,
      packageManager: null,
      appVariantNamesSerialized: null,
      appVariantAccentsSerialized: null,
      git: null,
      install: null,
    })
    expect(getConfiguratorDefaultsReset()).not.toHaveProperty("open")
  })
})
