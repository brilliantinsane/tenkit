import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, test, vi } from "vitest"

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
  beforeEach(() => vi.clearAllMocks())

  test("uses native anchors for same-page section navigation", () => {
    const markup = renderToStaticMarkup(
      <HeaderClient desktopStats={{ github: null, npm: null }} />
    )

    expect(markup).toMatch(/<a data-next-link="true"[^>]+href="\/#top"/)
    expect(markup).toContain('href="/#proof"')
    expect(markup).toContain('href="/#setup-types"')
    expect(markup).toContain('href="/#generated"')
    expect(markup.match(/data-next-link="true"/g)).toHaveLength(1)
  })
})
