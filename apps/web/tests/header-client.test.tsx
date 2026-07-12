import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, test, vi } from "vitest"

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

vi.mock("@/components/configurator-header-trigger", () => ({
  ConfiguratorHeaderTrigger: () => <button>Configurator</button>,
}))

vi.mock("@/components/theme-switcher", () => ({
  ThemeSwitcher: () => <button>Theme</button>,
}))

vi.mock("@/hooks/use-scroll", () => ({
  useScroll: vi.fn(() => false),
}))

import { HeaderClient } from "@/components/header-client"

describe("HeaderClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePathname.mockReturnValue("/")
  })

  test("uses native anchors for every same-page navigation link", () => {
    const markup = renderToStaticMarkup(
      <HeaderClient desktopStats={{ github: null, npm: null }} />
    )

    expect(markup).toContain('href="#top"')
    expect(markup).toContain('href="#proof"')
    expect(markup).toContain('href="#setup-types"')
    expect(markup).toContain('href="#generated"')
    expect(markup).not.toContain('data-next-link="true"')
  })

  test("uses Next links to return home from another route", () => {
    mockUsePathname.mockReturnValue("/missing")

    const markup = renderToStaticMarkup(
      <HeaderClient desktopStats={{ github: null, npm: null }} />
    )

    expect(markup).toMatch(
      /<a data-next-link="true"[^>]+href="\/#top"[^>]+aria-label="Tenkit home"/
    )
    expect(markup).toContain('data-next-link="true" href="/#proof"')
    expect(markup).toContain('data-next-link="true" href="/#setup-types"')
    expect(markup).toContain('data-next-link="true" href="/#generated"')
    expect(markup.match(/data-next-link="true"/g)).toHaveLength(4)
  })
})
