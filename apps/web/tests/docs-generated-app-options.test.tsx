import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, test } from "vitest"

import { SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS } from "@tenkit/types/generated-app-option-definitions"

import { CompatibilityMatrix } from "@/components/docs/compatibility-matrix"
import { getDocsGeneratedAppOptionRows } from "@/lib/docs-generated-app-options"

describe("Fumadocs Generated App Option compatibility", () => {
  test("renders every released stack from the shared compatibility contract", () => {
    const rows = getDocsGeneratedAppOptionRows()

    expect(rows).toHaveLength(32)
    expect(new Set(rows.map((row) => row.id)).size).toBe(32)
    expect(rows.map((row) => row.selection)).toEqual(
      SUPPORTED_GENERATED_APP_OPTION_COMBINATIONS
    )
  })

  test("keeps provider-owned storage states legible", () => {
    const rows = getDocsGeneratedAppOptionRows()

    expect(
      rows.find((row) => row.id === "convex-better-auth-none-none")?.values
    ).toEqual(["convex", "better-auth", "Convex-managed", "Not applicable"])
  })

  test("renders an accessible table for the released combinations", () => {
    const markup = renderToStaticMarkup(<CompatibilityMatrix />)

    expect(markup).toContain(
      "The 32 supported Backend, Auth, Database, and ORM combinations."
    )
    expect(markup.match(/<tr>/g)).toHaveLength(33)
    expect(markup).toContain("Convex-managed")
    expect(markup).toContain("Not applicable")
  })
})
