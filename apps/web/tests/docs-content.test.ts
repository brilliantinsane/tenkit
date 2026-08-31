import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, test } from "vitest"

import { SUPPORTED_GENERATED_STYLING_CHOICES } from "@tenkit/types/styling-definitions"

const docsRoot = path.resolve(import.meta.dirname, "../content/docs")
const requiredDocs = [
  "index.mdx",
  "setup-types.mdx",
  "generated-app-options.mdx",
  "generated-project.mdx",
  "verification.mdx",
] as const

describe("Fumadocs content contract", () => {
  test("keeps every public guide in the generated navigation order", () => {
    const navigation = JSON.parse(
      readFileSync(path.join(docsRoot, "meta.json"), "utf8")
    ) as { pages?: string[] }

    expect(navigation.pages).toEqual(
      requiredDocs.map((filename) => filename.replace(/\.mdx$/, ""))
    )

    for (const filename of requiredDocs) {
      const contents = readFileSync(path.join(docsRoot, filename), "utf8")

      expect(contents).toMatch(/^---\ntitle: .+\ndescription: .+\n---/)
    }
  })

  test("keeps guide links inside the published docs and configurator surfaces", () => {
    const validPaths = new Set([
      "/configure",
      ...requiredDocs.map(
        (filename) => `/docs/${filename.replace(/\.mdx$/, "")}`
      ),
    ])

    for (const filename of requiredDocs) {
      const contents = readFileSync(path.join(docsRoot, filename), "utf8")
      const links = [...contents.matchAll(/\]\((\/[^)#]+)\)/g)].map(
        ([, href]) => href
      )

      for (const href of links) {
        expect(validPaths).toContain(href)
      }
    }
  })

  test("documents every released Styling Choice", () => {
    const options = readFileSync(
      path.join(docsRoot, "generated-app-options.mdx"),
      "utf8"
    )

    for (const styling of SUPPORTED_GENERATED_STYLING_CHOICES) {
      expect(options).toContain(`- \`${styling}\``)
    }
  })

  test("documents the released stack contract without stale pre-PR2 claims", () => {
    const options = readFileSync(
      path.join(docsRoot, "generated-app-options.mdx"),
      "utf8"
    )

    expect(options).toContain(
      "exactly 32 supported Backend/Auth/Database/ORM combinations"
    )
    expect(options).toContain("Express")
    expect(options).toContain("Better Auth")
    expect(options).toContain("PostgreSQL")
    expect(options).toContain("Drizzle")
    expect(options).not.toContain("Tenkit does not handle backend")
  })
})
