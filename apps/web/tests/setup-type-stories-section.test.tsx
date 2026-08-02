// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import { SetupTypeStoriesSection } from "@/components/setup-type-stories-section"

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserverMock {
      disconnect() {}
      observe() {}
      unobserve() {}
    }
  )
  vi.stubGlobal(
    "IntersectionObserver",
    class IntersectionObserverMock {
      disconnect() {}
      observe() {}
      takeRecords() {
        return []
      }
      unobserve() {}
    }
  )
})

afterAll(() => {
  vi.unstubAllGlobals()
})

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
    expect(container.querySelector('[data-slot="tree-view"]')).not.toBeNull()
    expect(screen.getByText("Branded App Variants")).toBeDefined()
    expect(
      screen.getByRole("heading", {
        name: "Different customer experiences One product to maintain",
      })
    ).toBeDefined()

    const storyShell = container.querySelector(
      '[data-slot="setup-type-story-shell"]'
    )
    const distributionCard = container.querySelector(
      '[data-slot="setup-type-distribution-card"]'
    )
    expect(storyShell?.className).toContain("lg:grid-cols-2")
    expect(storyShell?.className).toContain("lg:h-[37rem]")
    expect(distributionCard?.className).toContain("bg-foreground")
    expect(distributionCard?.className).toContain("text-background")

    await user.click(runtimeTenantsChoice)

    expect(whiteLabelChoice.getAttribute("aria-pressed")).toBe("false")
    expect(runtimeTenantsChoice.getAttribute("aria-pressed")).toBe("true")
    expect(
      screen.getByRole("heading", {
        name: "One app for every location.",
      })
    ).toBeDefined()
    expect(screen.getAllByText("Single App Runtime Tenants")).toHaveLength(2)
    expect(screen.getByText("Runtime Tenant access")).toBeDefined()
    expect(screen.getByText("runtime-tenants.ts")).toBeDefined()

    await user.click(hybridChoice)

    expect(runtimeTenantsChoice.getAttribute("aria-pressed")).toBe("false")
    expect(hybridChoice.getAttribute("aria-pressed")).toBe("true")
    expect(
      screen.getByRole("heading", {
        name: "Keep most partners in one app. Give selected partners their own.",
      })
    ).toBeDefined()
    expect(
      screen.getAllByText("Generic With Standalone App Variants")
    ).toHaveLength(1)
    expect(screen.getByText("Shared + Standalone App Variants")).toBeDefined()
    expect(screen.getByText("app-variants.ts")).toBeDefined()
    expect(screen.queryByText("Prototype D")).toBeNull()
  })

  test("shows the generated project tree for each Setup Type", async () => {
    const user = userEvent.setup()

    const { container } = render(<SetupTypeStoriesSection />)

    expect(container.querySelector('[data-slot="tree-view"]')).not.toBeNull()
    expect(screen.getByText("Branded App Variants")).toBeDefined()
    expect(screen.getByText("Key files")).toBeDefined()
    expect(screen.getByText("constants")).toBeDefined()
    expect(screen.getByText("first-tenant")).toBeDefined()
    expect(screen.getByText("app-variants.ts")).toBeDefined()
    expect(screen.queryByText("package.json")).toBeNull()
    expect(
      container
        .querySelector('[data-orientation="vertical"]')
        ?.className.includes("scroll-fade-effect-y")
    ).toBe(true)

    await user.click(
      screen.getByRole("button", {
        name: /Single App Runtime Tenants\s*One app, many businesses/,
      })
    )

    expect(screen.getByText("Runtime Tenant access")).toBeDefined()
    expect(screen.getByText("runtime-tenants.ts")).toBeDefined()
    expect(screen.queryByText("first-tenant")).toBeNull()

    await user.click(
      screen.getByRole("button", {
        name: /Generic \+ Standalone Apps\s*Shared app plus partner apps/,
      })
    )

    expect(screen.getByText("Shared + Standalone App Variants")).toBeDefined()
    expect(screen.getByText("app-variants.ts")).toBeDefined()
    expect(screen.getByText("atlas-network")).toBeDefined()
    expect(screen.getByText("west-studio")).toBeDefined()
  })
})
