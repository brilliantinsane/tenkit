import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join, relative, resolve } from "node:path"

import { describe, expect, test } from "vitest"

import { SUPPORTED_PUBLIC_SETUP_SLUGS } from "@tenkit/types/setup-type-definitions"

import { CONFIGURATOR_SETUP_TYPE_VALUES } from "@/lib/configurator"

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)))
const sourceDirectories = ["app", "components", "constants", "hooks", "lib"]

function listTypeScriptFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) {
      return listTypeScriptFiles(path)
    }

    return entry.isFile() && /\.(?:ts|tsx|mts)$/.test(path) ? [path] : []
  })
}

describe("Public Web App shared-definition ownership", () => {
  test("consumes canonical definitions directly from @tenkit/types", () => {
    const sourcePaths = [
      ...sourceDirectories.flatMap((directory) =>
        listTypeScriptFiles(join(packageRoot, directory))
      ),
      join(packageRoot, "next.config.ts"),
      join(packageRoot, "vitest.config.ts"),
    ]
    const compatibilityConsumers = sourcePaths
      .filter((path) =>
        /@tenkit\/template-generator\/(?:setup-type-definitions|styling-definitions)/.test(
          readFileSync(path, "utf8")
        )
      )
      .map((path) => relative(packageRoot, path))

    expect(compatibilityConsumers).toEqual([])
    expect(
      readFileSync(join(packageRoot, "lib/configurator.ts"), "utf8")
    ).toMatch(/@tenkit\/types\/setup-type-definitions/)
    expect(
      readFileSync(join(packageRoot, "lib/configurator.ts"), "utf8")
    ).toMatch(/@tenkit\/types\/styling-definitions/)
    expect(readFileSync(join(packageRoot, "lib/seo.ts"), "utf8")).toMatch(
      /@tenkit\/types\/styling-definitions/
    )
    expect(CONFIGURATOR_SETUP_TYPE_VALUES).toEqual(SUPPORTED_PUBLIC_SETUP_SLUGS)
  })

  test("declares production and test-only workspace dependencies for fresh installs", () => {
    const packageMetadata = JSON.parse(
      readFileSync(join(packageRoot, "package.json"), "utf8")
    ) as {
      scripts?: Record<string, string>
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }

    expect(packageMetadata.dependencies?.["@tenkit/types"]).toBe("workspace:*")
    expect(packageMetadata.dependencies).not.toHaveProperty(
      "@tenkit/template-generator"
    )
    expect(
      packageMetadata.devDependencies?.["@tenkit/template-generator"]
    ).toBe("workspace:*")
    expect(packageMetadata.scripts).toMatchObject({
      prebuild: "pnpm -F @tenkit/types build",
      pretest: "pnpm -F @tenkit/template-generator build",
      pretypecheck: "pnpm -F @tenkit/template-generator build",
    })
  })
})
