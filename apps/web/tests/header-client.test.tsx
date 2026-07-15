// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

const { mockUsePathname } = vi.hoisted(() => ({
  mockUsePathname: vi.fn(),
}))

vi.mock("next/image", () => ({
  default: (props: React.ComponentProps<"img">) => (
    <span aria-label={props.alt} data-image-src={props.src} />
  ),
}))

vi.mock("next/link", () => ({
  default: (props: React.ComponentProps<"a">) => (
    <a data-next-link="true" {...props} />
  ),
}))

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
}))

vi.mock("@/components/theme-switcher", () => ({
  ThemeSwitcher: () => <button>Theme</button>,
}))

vi.mock("@/hooks/use-scroll", () => ({
  useScroll: vi.fn(() => false),
}))

import { HeaderClient } from "@/components/header-client"

const emptyStats = { github: null, npm: null }

describe("HeaderClient", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePathname.mockReturnValue("/")
  })

  test("uses native anchors for every same-page navigation link", () => {
    const markup = renderToStaticMarkup(
      <HeaderClient desktopStats={emptyStats} mobileStats={emptyStats} />
    )

    expect(markup).toContain('href="#top"')
    expect(markup).toContain('href="#proof"')
    expect(markup).toContain('href="#setup-types"')
    expect(markup).toContain('href="#generated"')
    expect(
      markup.match(/data-next-link="true" href="\/configure"/g)
    ).toHaveLength(2)
  })

  test("uses Next links to return home from another route", () => {
    mockUsePathname.mockReturnValue("/missing")

    const markup = renderToStaticMarkup(
      <HeaderClient desktopStats={emptyStats} mobileStats={emptyStats} />
    )

    expect(markup).toMatch(
      /<a data-next-link="true"[^>]+href="\/#top"[^>]+aria-label="Tenkit home"/
    )
    expect(markup).toContain('data-next-link="true" href="/#proof"')
    expect(markup).toContain('data-next-link="true" href="/#setup-types"')
    expect(markup).toContain('data-next-link="true" href="/#generated"')
    expect(
      markup.match(/data-next-link="true" href="\/configure"/g)
    ).toHaveLength(2)
    expect(markup.match(/data-next-link="true"/g)).toHaveLength(6)
  })

  test("exposes primary navigation from the mobile menu", async () => {
    const user = userEvent.setup()

    render(
      <HeaderClient
        desktopStats={emptyStats}
        mobileStats={{ github: <a href="/github">GitHub</a>, npm: null }}
      />
    )

    await user.click(screen.getByRole("button", { name: "Toggle menu" }))

    const mobileMenu = document.querySelector("#mobile-menu")

    if (!(mobileMenu instanceof HTMLElement)) {
      throw new Error("Expected the mobile navigation portal to be open.")
    }

    expect(
      within(mobileMenu)
        .getByRole("link", { name: "Signals" })
        .getAttribute("href")
    ).toBe("#proof")
    expect(
      within(mobileMenu)
        .getByRole("link", { name: "Setup types" })
        .getAttribute("href")
    ).toBe("#setup-types")
    expect(
      within(mobileMenu)
        .getByRole("link", { name: "Generated" })
        .getAttribute("href")
    ).toBe("#generated")
    expect(
      within(mobileMenu)
        .getByRole("link", { name: "GitHub" })
        .getAttribute("href")
    ).toBe("/github")
  })

  test("uses the same header divider on home and configure routes", () => {
    const homeMarkup = renderToStaticMarkup(
      <HeaderClient desktopStats={emptyStats} mobileStats={emptyStats} />
    )
    const homeHeaderClasses = homeMarkup
      .match(/<header class="([^"]+)"/)?.[1]
      ?.split(" ")

    mockUsePathname.mockReturnValue("/configure")

    const configureMarkup = renderToStaticMarkup(
      <HeaderClient desktopStats={emptyStats} mobileStats={emptyStats} />
    )
    const configureHeaderClasses = configureMarkup
      .match(/<header class="([^"]+)"/)?.[1]
      ?.split(" ")

    expect(configureHeaderClasses).toEqual(homeHeaderClasses)
    expect(configureHeaderClasses).toContain("after:bg-border")
  })
})
