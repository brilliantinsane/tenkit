import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, test, vi } from "vitest"

const { mockSetConfiguratorOpen } = vi.hoisted(() => ({
  mockSetConfiguratorOpen: vi.fn(),
}))

vi.mock("@/hooks/use-configurator-open", () => ({
  useConfiguratorOpen: () => [false, mockSetConfiguratorOpen],
}))

import { ConfiguratorHeaderTrigger } from "@/components/configurator-header-trigger"

describe("ConfiguratorHeaderTrigger", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("uses one query-state button on every route", () => {
    const markup = renderToStaticMarkup(<ConfiguratorHeaderTrigger />)

    expect(markup).toContain("<button")
    expect(markup).toContain("Configurator")
    expect(markup).not.toContain("href=")
  })
})
