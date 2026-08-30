import { describe, expect, test } from "vitest"

import {
  applyConfiguratorGeneratedAppOptionChoice,
  CONFIGURATOR_GENERATED_APP_OPTION_GROUPS,
  CONFIGURATOR_GENERATED_APP_OPTION_OPTIONS,
  getConfiguratorGeneratedAppOptionStatusCopy,
  getConfiguratorGeneratedAppOptionsState,
} from "@/lib/generated-app-options"
import {
  resolveGeneratedAppOptions,
  SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS,
} from "@tenkit/types/generated-app-option-definitions"

describe("Configurator Generated App Options", () => {
  test("keeps the selected Database and adjusts incompatible Generated App Options", () => {
    expect(
      applyConfiguratorGeneratedAppOptionChoice(
        {
          backend: "express",
          auth: "better-auth",
          database: "postgresql",
          orm: "prisma",
        },
        "database",
        "none"
      )
    ).toEqual({
      selection: {
        backend: "express",
        auth: "none",
        database: "none",
        orm: "none",
      },
      adjustments: [
        { group: "auth", from: "better-auth", to: "none" },
        { group: "orm", from: "prisma", to: "none" },
      ],
    })
  })

  test("resolves every visible Choice from every supported combination", () => {
    for (const currentSelection of SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS) {
      for (const group of CONFIGURATOR_GENERATED_APP_OPTION_GROUPS) {
        for (const option of CONFIGURATOR_GENERATED_APP_OPTION_OPTIONS[group]) {
          const update = applyConfiguratorGeneratedAppOptionChoice(
            currentSelection,
            group,
            option.value
          )

          expect(update.selection[group]).toBe(option.value)
          expect(resolveGeneratedAppOptions(update.selection)).toEqual({
            status: "resolved",
            selection: update.selection,
          })
        }
      }
    }
  })

  test("projects each supported combination into progressive choices", () => {
    const state = getConfiguratorGeneratedAppOptionsState({
      backend: "express",
      auth: "better-auth",
      database: "postgresql",
      orm: "drizzle",
    })

    expect(state.selection).toEqual({
      backend: "express",
      auth: "better-auth",
      database: "postgresql",
      orm: "drizzle",
    })
    expect(state.choices.backend.values).toEqual([
      "none",
      "express",
      "nestjs",
      "convex",
    ])
    expect(state.choices.auth.values).toEqual(["none", "clerk", "better-auth"])
    expect(state.choices.database.values).toEqual(["postgresql", "mysql"])
    expect(state.choices.orm.values).toEqual(["prisma", "drizzle"])
  })

  test.each(SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS)(
    "resolves the supported %s stack exactly",
    (combination) => {
      expect(
        getConfiguratorGeneratedAppOptionsState(combination).selection
      ).toEqual(combination)
    }
  )

  test("resolves stale dependent values without inventing a combination", () => {
    const state = getConfiguratorGeneratedAppOptionsState({
      backend: "convex",
      auth: "better-auth",
      database: "postgresql",
      orm: "drizzle",
    })

    expect(state.selection).toEqual({
      backend: "convex",
      auth: "better-auth",
      database: "none",
      orm: "none",
    })
    expect(state.choices.database).toMatchObject({
      status: "resolved",
      values: ["none"],
      value: "none",
    })
    expect(state.choices.orm).toMatchObject({
      status: "resolved",
      values: ["none"],
      value: "none",
    })
  })

  test("falls back to the zero-service combination for unsupported raw values", () => {
    expect(
      getConfiguratorGeneratedAppOptionsState({
        backend: "hono",
        auth: "passwordless",
        database: "sqlite",
        orm: "typeorm",
      }).selection
    ).toEqual({
      backend: "none",
      auth: "none",
      database: "none",
      orm: "none",
    })
  })

  test("explains resolved persistence choices", () => {
    const convex = {
      backend: "convex",
      auth: "clerk",
      database: "none",
      orm: "none",
    } as const

    expect(
      getConfiguratorGeneratedAppOptionStatusCopy("database", convex)
    ).toMatch(/Convex manages persistence/)
    expect(getConfiguratorGeneratedAppOptionStatusCopy("orm", convex)).toMatch(
      /not applicable/
    )
  })
})
