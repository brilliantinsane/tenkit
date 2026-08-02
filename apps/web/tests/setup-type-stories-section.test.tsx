// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, test } from "vitest"

import { SetupTypeStoriesSection } from "@/components/setup-type-stories-section"

afterEach(cleanup)

describe("SetupTypeStoriesSection", () => {
  test("switches the visible story and distribution context", async () => {
    const user = userEvent.setup()

    const { container } = render(<SetupTypeStoriesSection />)

    const whiteLabelChoice = screen.getByRole("button", {
      name: /White Label Apps\s*A branded app per customer/,
    })
    const runtimeTenantsChoice = screen.getByRole("button", {
      name: /Single App Runtime Tenants\s*One app, many businesses/,
    })
    const hybridChoice = screen.getByRole("button", {
      name: /Generic \+ Standalone Apps\s*Shared app plus partner apps/,
    })

    expect(whiteLabelChoice.getAttribute("aria-pressed")).toBe("true")
    expect(
      screen.getByRole("heading", {
        name: "Give every customer their own app without copying your product.",
      })
    ).toBeDefined()
    expect(screen.getAllByText("White Label Apps")).toHaveLength(2)
    expect(
      screen.getByRole("group", {
        name: "One shared product codebase branches into three separately branded App Variants.",
      })
    ).toBeDefined()
    expect(
      screen.getByRole("heading", {
        name: "Choose the app structure your product needs.",
      })
    ).toBeDefined()

    const storyShell = container.querySelector(
      '[data-slot="setup-type-story-shell"]'
    )
    const distributionCard = container.querySelector(
      '[data-slot="setup-type-distribution-card"]'
    )
    const whiteLabelSourceNode = container.querySelector(
      '[data-slot="shared-product-code-node"]'
    )

    expect(storyShell?.className).toContain("lg:grid-cols-2")
    expect(storyShell?.className).toContain("lg:h-[37rem]")
    expect(distributionCard?.className).toContain("bg-foreground")
    expect(distributionCard?.className).toContain("text-background")
    expect(whiteLabelSourceNode?.className).toContain("h-12")
    expect(whiteLabelSourceNode?.className).toContain("w-40")

    await user.click(runtimeTenantsChoice)

    expect(whiteLabelChoice.getAttribute("aria-pressed")).toBe("false")
    expect(runtimeTenantsChoice.getAttribute("aria-pressed")).toBe("true")
    expect(
      screen.getByRole("heading", {
        name: "One app for every location.",
      })
    ).toBeDefined()
    expect(screen.getAllByText("Berlin").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Single App Runtime Tenants")).toHaveLength(2)
    expect(screen.queryByText("Member app")).toBeNull()
    expect(screen.getByText("1 App Variant")).toBeDefined()

    const runtimeDistributionCard = container.querySelector(
      '[data-slot="setup-type-distribution-card"]'
    )
    if (!runtimeDistributionCard) {
      throw new Error("Expected runtime distribution card")
    }
    await user.hover(runtimeDistributionCard)
    expect(
      container.querySelector('[data-slot="runtime-orbit-pulse"]')
    ).not.toBeNull()

    await user.click(hybridChoice)

    expect(runtimeTenantsChoice.getAttribute("aria-pressed")).toBe("false")
    expect(hybridChoice.getAttribute("aria-pressed")).toBe("true")
    expect(
      screen.getByRole("heading", {
        name: "Keep most partners in one app. Give selected partners their own.",
      })
    ).toBeDefined()
    expect(screen.getAllByText("Partner business").length).toBeGreaterThan(0)
    expect(
      screen.getAllByText("Generic With Standalone App Variants")
    ).toHaveLength(1)
    const hybridSourceNode = container.querySelector(
      '[data-slot="shared-product-code-node"]'
    )
    expect(hybridSourceNode?.className).toBe(whiteLabelSourceNode?.className)
    expect(screen.queryByText("Prototype D")).toBeNull()
  })
})
