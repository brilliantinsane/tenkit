import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

type WebPackage = {
  scripts: Record<string, string>
}

const webPackage = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
) as WebPackage

describe("web package scripts", () => {
  it("builds workspace dependencies before commands that import them", () => {
    expect(webPackage.scripts["build:workspace-dependencies"]).toBe(
      "pnpm -F @tenkit/template-generator build"
    )

    for (const command of ["dev", "build", "test", "lint", "typecheck"]) {
      expect(webPackage.scripts[`pre${command}`]).toBe(
        "pnpm run build:workspace-dependencies"
      )
    }
  })
})
