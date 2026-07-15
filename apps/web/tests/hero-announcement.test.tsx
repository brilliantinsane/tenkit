import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, test, vi } from "vitest"

vi.mock("next/link", () => ({
  default: (props: React.ComponentProps<"a">) => <a {...props} />,
}))

import { HeroAnnouncement } from "@/components/hero-announcement"

describe("HeroAnnouncement", () => {
  test("links directly to the Configure route", () => {
    const markup = renderToStaticMarkup(<HeroAnnouncement />)

    expect(markup).toContain('href="/configure"')
    expect(markup).not.toContain("<button")
  })
})
