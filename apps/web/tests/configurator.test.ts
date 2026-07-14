import { describe, expect, test } from "vitest"

import {
  buildConfiguratorCommand,
  createDefaultConfiguratorState,
  deriveConfiguratorAppVariantPreviews,
  deriveConfiguratorState,
  formatConfiguratorCommandMultiline,
  getConfiguratorAppVariantSectionCopy,
  isConfiguratorAccentHex,
  normalizeConfiguratorAccentHex,
  parseSerializedAppVariantAccents,
  parseSerializedAppVariantNames,
  randomizeConfiguratorState,
  serializeAppVariantAccents,
  serializeAppVariantNames,
  updateAppVariantValue,
  validateConfiguratorAppVariantNames,
} from "@/lib/configurator"

describe("Configurator command state", () => {
  test("keeps untouched and project-name-only commands minimal", () => {
    const defaults = createDefaultConfiguratorState()

    expect(buildConfiguratorCommand(defaults)).toBe(
      "pnpm create tenkit@latest --name tenkit-app --yes"
    )
    expect(
      buildConfiguratorCommand({
        ...defaults,
        projectName: "My New Fancy App",
      })
    ).toBe("pnpm create tenkit@latest --name my-new-fancy-app --yes")
  })

  test("expands every effective choice after a non-project change", () => {
    const state = {
      ...createDefaultConfiguratorState(),
      styling: "uniwind" as const,
    }

    expect(buildConfiguratorCommand(state)).toBe(
      "pnpm create tenkit@latest --name tenkit-app --setup white-label --variant-names 'First Tenant,Second Tenant' --variant-accents '#208AEF,#EF8520' --styling uniwind --package-manager pnpm --git --install"
    )
    expect(
      buildConfiguratorCommand(createDefaultConfiguratorState())
    ).toContain("--yes")
  })

  test("keeps invalid values out of the copyable command", () => {
    const derivedState = deriveConfiguratorState({
      ...createDefaultConfiguratorState(),
      projectName: "???",
    })

    expect(derivedState.projectNameError).toMatch(/usable Latin letter/)
    expect(derivedState.commandIsCopyable).toBe(false)
    expect(derivedState.command).toBe(derivedState.projectNameError)
  })

  test.each([
    ["pnpm", "pnpm create tenkit@latest"],
    ["npm", "npm create tenkit@latest --"],
    ["bun", "bun create tenkit@latest"],
  ] as const)(
    "uses the %s launcher and explicit package manager",
    (packageManager, launcher) => {
      const command = buildConfiguratorCommand({
        ...createDefaultConfiguratorState(),
        packageManager,
        styling: "uniwind",
      })

      expect(command).toMatch(new RegExp(`^${launcher.replaceAll(" ", "\\s")}`))
      expect(command).toContain(`--package-manager ${packageManager}`)
      expect(command).not.toContain("--yes")
    }
  )
})

describe("Configurator randomization", () => {
  test("changes every setup Choice while preserving the project name", () => {
    const randomizedState = randomizeConfiguratorState(
      {
        ...createDefaultConfiguratorState(),
        projectName: "Keep This Name",
      },
      () => 0
    )

    expect(randomizedState).toMatchObject({
      projectName: "Keep This Name",
      setupType: "runtime-tenants",
      styling: "uniwind",
      packageManager: "npm",
      appVariantNames: ["Atlas App"],
      appVariantAccents: ["#000000"],
      git: false,
      install: false,
    })
  })
})

describe("Configurator App Variant state", () => {
  test("serializes complete ordered lists after one position changes and clears defaults", () => {
    const defaults = createDefaultConfiguratorState()
    const changedNames = updateAppVariantValue(
      defaults.appVariantNames,
      1,
      "South App"
    )
    const changedAccents = updateAppVariantValue(
      defaults.appVariantAccents,
      0,
      "#123ABC"
    )

    expect(serializeAppVariantNames(changedNames, defaults.setupType)).toBe(
      "First Tenant,South App"
    )
    expect(serializeAppVariantAccents(changedAccents, defaults.setupType)).toBe(
      "#123ABC,#EF8520"
    )
    expect(
      serializeAppVariantNames(defaults.appVariantNames, defaults.setupType)
    ).toBe("")
    expect(
      serializeAppVariantAccents(defaults.appVariantAccents, defaults.setupType)
    ).toBe("")
  })

  test("parses complete ordered App Variant names and rejects the wrong shape", () => {
    const defaults = ["First Tenant", "Second Tenant"]

    expect(
      parseSerializedAppVariantNames("North Studio,South Studio", defaults)
    ).toEqual(["North Studio", "South Studio"])
    expect(parseSerializedAppVariantNames("Only One", defaults)).toBe(defaults)
  })

  test("round-trips valid App Variant names that resemble serialized state", () => {
    const names = ["~json:North", "South\\Brand"]
    const serialized = serializeAppVariantNames(names, "white-label")

    expect(
      parseSerializedAppVariantNames(serialized, ["First", "Second"])
    ).toEqual(names)
  })

  test("previews numeric-leading identities with a non-blocking warning", () => {
    const previews = deriveConfiguratorAppVariantPreviews(["123 Studio"])

    expect(previews).toEqual([
      expect.objectContaining({
        displayName: "123 Studio",
        slug: "app-123-studio",
        scheme: "app123studio",
        bundleIdentifier: "com.example.app123studio",
        packageName: "com.example.app123studio",
        warning:
          "Native identity starts with a number, so Tenkit adds the app prefix.",
      }),
    ])
  })

  test("uses setup-type-specific App Variant copy", () => {
    expect(getConfiguratorAppVariantSectionCopy("runtime-tenants")).toEqual({
      sectionTitle: "App Variant",
      sectionDescription: expect.stringMatching(/One native app identity/),
      items: [
        expect.objectContaining({
          legend: "Native app identity",
        }),
      ],
    })

    expect(
      getConfiguratorAppVariantSectionCopy("generic-standalone").items
    ).toEqual([
      expect.objectContaining({ legend: "Generic App Variant" }),
      expect.objectContaining({ legend: "Standalone App Variant" }),
    ])
  })

  test("formats expanded commands with line continuations", () => {
    const command = buildConfiguratorCommand({
      ...createDefaultConfiguratorState(),
      styling: "uniwind",
    })

    expect(formatConfiguratorCommandMultiline(command)).toBe(
      [
        "pnpm create tenkit@latest",
        "  --name tenkit-app \\",
        "  --setup white-label \\",
        "  --variant-names 'First Tenant,Second Tenant' \\",
        "  --variant-accents '#208AEF,#EF8520' \\",
        "  --styling uniwind \\",
        "  --package-manager pnpm \\",
        "  --git \\",
        "  --install",
      ].join("\n")
    )
  })

  test("normalizes accent values to hex and parses corrupted URL accents", () => {
    expect(isConfiguratorAccentHex("#208AEF")).toBe(true)
    expect(isConfiguratorAccentHex("#208aef")).toBe(false)
    expect(isConfiguratorAccentHex("rgba(26, 83, 138, 1)")).toBe(false)
    expect(normalizeConfiguratorAccentHex("rgba(26, 83, 138, 1)")).toBe(
      "#1A538A"
    )
    expect(
      parseSerializedAppVariantAccents("RGBA(26,+83,+138,+1),#EF8520", [
        "#208AEF",
        "#EF8520",
      ])
    ).toEqual(["#1A538A", "#EF8520"])
  })

  test("returns local errors for non-derivable and duplicate identities", () => {
    expect(validateConfiguratorAppVariantNames(["???"])).toEqual([
      expect.stringMatching(/usable Latin letter or number/),
    ])
    expect(
      validateConfiguratorAppVariantNames(["Cool App", "CoolApp"])
    ).toEqual([
      expect.stringMatching(/Duplicate derived App Variant identity/),
      expect.stringMatching(/Duplicate derived App Variant identity/),
    ])
  })
})
