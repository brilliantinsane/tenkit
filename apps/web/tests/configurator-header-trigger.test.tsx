import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, test, vi } from "vitest"

const { mockSetConfiguratorOpen, mockUsePathname } = vi.hoisted(() => ({
  mockSetConfiguratorOpen: vi.fn(),
  mockUsePathname: vi.fn(),
}))

vi.mock("next/link", () => ({
  default: (props: React.ComponentProps<"a">) => (
    <a data-next-link="true" {...props} />
  ),
}))

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
}))

vi.mock("@/hooks/use-configurator-open", () => ({
  useConfiguratorOpen: () => [false, mockSetConfiguratorOpen],
}))

import { ConfiguratorHeaderTrigger } from "@/components/configurator-header-trigger"

describe("ConfiguratorHeaderTrigger", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePathname.mockReturnValue("/")
  })

  test("uses the query-state trigger on the home page", () => {
    const markup = renderToStaticMarkup(<ConfiguratorHeaderTrigger />)

    expect(markup).toContain("<button")
    expect(markup).toContain("Configurator")
    expect(markup).not.toContain('data-next-link="true"')
  })

  test("links to the open Configurator on another route", () => {
    mockUsePathname.mockReturnValue("/missing")

    const markup = renderToStaticMarkup(<ConfiguratorHeaderTrigger />)

    expect(markup).toContain('data-next-link="true"')
    expect(markup).toContain('href="/?cfg=true"')
    expect(markup).toContain("Configurator")
  })
})
