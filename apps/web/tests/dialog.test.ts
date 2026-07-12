import { describe, expect, test } from "vitest"

import { dialogOverlayVariants } from "@/components/ui/dialog"

describe("DialogOverlay", () => {
  test("cannot intercept page interactions after closing", () => {
    expect(dialogOverlayVariants()).toContain(
      "data-[state=closed]:pointer-events-none"
    )
  })
})
