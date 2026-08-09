import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, test } from "vitest"

import { Spinner } from "@/components/ui/spinner"

describe("Spinner", () => {
  test("animates an HTML wrapper instead of the SVG", () => {
    const markup = renderToStaticMarkup(<Spinner />)

    expect(markup).toMatch(/<span[^>]*class="[^"]*animate-spin/)
    expect(markup).not.toMatch(/<svg[^>]*class="[^"]*animate-spin/)
  })
})
