// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing"
import { afterEach, describe, expect, test, vi } from "vitest"

import { ConfigurePageContent } from "@/components/configure-page-content"

const { trackDatabuddyEvent } = vi.hoisted(() => ({
  trackDatabuddyEvent: vi.fn(),
}))

vi.mock("@/lib/databuddy", () => ({ trackDatabuddyEvent }))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  trackDatabuddyEvent.mockClear()
})

describe("ConfigurePageContent interactions", () => {
  test("writes selections, inputs, and toggles to the route query", async () => {
    const user = userEvent.setup()
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>()

    render(
      <NuqsTestingAdapter
        hasMemory
        resetUrlUpdateQueueOnMount={false}
        onUrlUpdate={onUrlUpdate}
      >
        <ConfigurePageContent />
      </NuqsTestingAdapter>
    )

    await user.click(screen.getByRole("button", { name: /^Runtime/ }))
    expect(onUrlUpdate.mock.lastCall?.[0].searchParams.get("setup")).toBe(
      "runtime-tenants"
    )

    await user.click(screen.getByRole("button", { name: /^Unistyles/ }))
    expect(onUrlUpdate.mock.lastCall?.[0].searchParams.get("styling")).toBe(
      "unistyles"
    )

    await user.click(screen.getByRole("button", { name: /^npm/ }))
    expect(onUrlUpdate.mock.lastCall?.[0].searchParams.get("pm")).toBe("npm")

    const projectNameInput = screen.getByLabelText("Project name")
    fireEvent.change(projectNameInput, { target: { value: "Shared App" } })
    await waitFor(() => {
      expect(onUrlUpdate.mock.lastCall?.[0].searchParams.get("name")).toBe(
        "Shared App"
      )
    })

    const appVariantNameInput = screen.getByLabelText("Name")
    fireEvent.change(appVariantNameInput, {
      target: { value: "Tenkit Network" },
    })
    await waitFor(() => {
      expect(onUrlUpdate.mock.lastCall?.[0].searchParams.get("vn")).toBe(
        "Tenkit Network"
      )
    })

    await user.click(
      screen.getByRole("switch", { name: "Install dependencies" })
    )
    expect(onUrlUpdate.mock.lastCall?.[0].searchParams.get("i")).toBe("false")
    expect(onUrlUpdate.mock.lastCall?.[0].options).toMatchObject({
      history: "replace",
      shallow: true,
    })
  })

  test("keeps partial Accent text editable until a complete hex value is entered", async () => {
    const user = userEvent.setup()
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>()

    render(
      <NuqsTestingAdapter
        hasMemory
        resetUrlUpdateQueueOnMount={false}
        onUrlUpdate={onUrlUpdate}
      >
        <ConfigurePageContent />
      </NuqsTestingAdapter>
    )

    const accentInput = screen.getAllByLabelText("Accent")[0]

    if (!(accentInput instanceof HTMLInputElement)) {
      throw new Error(
        "Expected the first App Variant Accent control to be an input."
      )
    }

    await user.clear(accentInput)
    await user.type(accentInput, "#123ABC")

    expect(accentInput.value).toBe("#123ABC")
    expect(onUrlUpdate.mock.lastCall?.[0].searchParams.get("vacc")).toBe(
      "#123ABC,#EF8520"
    )
  })

  test("keeps an invalid comma in an App Variant name visible for validation", async () => {
    render(
      <NuqsTestingAdapter hasMemory>
        <ConfigurePageContent />
      </NuqsTestingAdapter>
    )

    const nameInput = screen.getAllByLabelText("Name")[0]

    if (!(nameInput instanceof HTMLInputElement)) {
      throw new Error(
        "Expected the first App Variant Name control to be an input."
      )
    }

    fireEvent.change(nameInput, { target: { value: "North, Studio" } })

    await waitFor(() => {
      expect(nameInput.value).toBe("North, Studio")
      expect(screen.getByText(/must not contain commas/i)).toBeDefined()
    })
    const copyButton = screen.getByRole("button", { name: "Copy" })

    if (!(copyButton instanceof HTMLButtonElement)) {
      throw new Error("Expected the copy control to be a button.")
    }

    expect(copyButton.disabled).toBe(true)
  })

  test("reset clears every non-default query parameter", async () => {
    const user = userEvent.setup()
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>()

    render(
      <NuqsTestingAdapter
        hasMemory
        resetUrlUpdateQueueOnMount={false}
        searchParams="?name=Shared+App&setup=runtime-tenants&styling=unistyles&pm=npm&vn=Tenkit+Network&vacc=%23123ABC&git=false&i=false"
        onUrlUpdate={onUrlUpdate}
      >
        <ConfigurePageContent />
      </NuqsTestingAdapter>
    )

    await user.click(screen.getByRole("button", { name: "Reset defaults" }))

    expect(onUrlUpdate).toHaveBeenCalledOnce()
    expect(onUrlUpdate.mock.lastCall?.[0].searchParams.toString()).toBe("")
  })

  test("randomizes setup Choices without changing the project name", async () => {
    const user = userEvent.setup()
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>()
    vi.spyOn(Math, "random").mockReturnValue(0)

    render(
      <NuqsTestingAdapter
        hasMemory
        resetUrlUpdateQueueOnMount={false}
        searchParams="?name=Shared+App"
        onUrlUpdate={onUrlUpdate}
      >
        <ConfigurePageContent />
      </NuqsTestingAdapter>
    )

    await user.click(
      screen.getByRole("button", { name: "Randomize configuration" })
    )

    const searchParams = onUrlUpdate.mock.lastCall?.[0].searchParams
    expect(searchParams?.get("name")).toBe("Shared App")
    expect(searchParams?.get("setup")).toBe("runtime-tenants")
    expect(searchParams?.get("styling")).toBe("uniwind")
    expect(searchParams?.get("pm")).toBe("npm")
    expect(searchParams?.get("vn")).toBe("Atlas App")
    expect(searchParams?.get("vacc")).toBe("#000000")
    expect(searchParams?.get("git")).toBe("false")
    expect(searchParams?.get("i")).toBe("false")
    expect(trackDatabuddyEvent).toHaveBeenCalledOnce()
    expect(trackDatabuddyEvent).toHaveBeenCalledWith(
      "configurator_randomized",
      {
        setupType: "runtime-tenants",
        styling: "uniwind",
        packageManager: "npm",
      }
    )
  })

  test("tracks changed bounded Configurator Choices", async () => {
    const user = userEvent.setup()

    render(
      <NuqsTestingAdapter hasMemory>
        <ConfigurePageContent />
      </NuqsTestingAdapter>
    )

    await user.click(screen.getByRole("button", { name: /^Runtime/ }))
    await user.click(screen.getByRole("button", { name: /^Unistyles/ }))
    await user.click(screen.getByRole("button", { name: /^npm/ }))
    await user.click(
      screen.getByRole("switch", { name: "Install dependencies" })
    )
    await user.click(screen.getByRole("switch", { name: "Initialize Git" }))

    expect(trackDatabuddyEvent.mock.calls).toEqual([
      [
        "configurator_choice_changed",
        { group: "setup_type", value: "runtime-tenants" },
      ],
      ["configurator_choice_changed", { group: "styling", value: "unistyles" }],
      [
        "configurator_choice_changed",
        { group: "package_manager", value: "npm" },
      ],
      ["configurator_choice_changed", { group: "install", value: false }],
      ["configurator_choice_changed", { group: "git", value: false }],
    ])
  })

  test("does not track already-selected Configurator Choices", async () => {
    const user = userEvent.setup()

    render(
      <NuqsTestingAdapter hasMemory>
        <ConfigurePageContent />
      </NuqsTestingAdapter>
    )

    await user.click(screen.getByRole("button", { name: /^White label/ }))
    await user.click(screen.getByRole("button", { name: /^Bare/ }))
    await user.click(screen.getByRole("button", { name: /^pnpm/ }))

    expect(trackDatabuddyEvent).not.toHaveBeenCalled()
  })

  test("shows the selected indicator only on pressed Choice cards", () => {
    render(
      <NuqsTestingAdapter>
        <ConfigurePageContent />
      </NuqsTestingAdapter>
    )

    const selectedChoices = screen.getAllByRole("button", { pressed: true })
    const unselectedChoices = screen.getAllByRole("button", { pressed: false })

    expect(selectedChoices).toHaveLength(3)
    expect(unselectedChoices).toHaveLength(6)

    for (const selectedChoice of selectedChoices) {
      expect(
        selectedChoice.querySelector("[data-selected-indicator]")
      ).not.toBeNull()
      expect(selectedChoice.classList.contains("border-foreground")).toBe(true)
      expect(selectedChoice.classList.contains("ring-2")).toBe(false)
    }

    for (const unselectedChoice of unselectedChoices) {
      expect(
        unselectedChoice.querySelector("[data-selected-indicator]")
      ).toBeNull()
      expect(unselectedChoice.classList.contains("border-foreground")).toBe(
        false
      )
    }
  })

  test("keeps one fixed chevron while expanding and collapsing the command", async () => {
    const user = userEvent.setup()

    render(
      <NuqsTestingAdapter>
        <ConfigurePageContent />
      </NuqsTestingAdapter>
    )

    const expandButton = screen.getByRole("button", {
      name: "Expand create command",
    })
    const chevron = expandButton.querySelector(
      '[data-slot="command-expand-icon"]'
    )
    const commandPanelCard = document.querySelector(
      '[data-slot="configurator-command-panel-card"]'
    )
    const commandExpansion = document.querySelector(
      '[data-slot="command-expansion"]'
    )

    expect(expandButton.getAttribute("aria-expanded")).toBe("false")
    expect(expandButton.classList.contains("top-2")).toBe(true)
    expect(commandPanelCard?.getAttribute("data-expanded")).toBe("false")
    expect(commandExpansion?.classList.contains("grid-rows-[0fr]")).toBe(true)

    await user.click(expandButton)

    const collapseButton = screen.getByRole("button", {
      name: "Collapse create command",
    })

    expect(collapseButton.getAttribute("aria-expanded")).toBe("true")
    expect(
      collapseButton.querySelector('[data-slot="command-expand-icon"]')
    ).toBe(chevron)
    expect(commandPanelCard?.getAttribute("data-expanded")).toBe("true")
    expect(commandExpansion?.classList.contains("grid-rows-[1fr]")).toBe(true)

    await user.click(collapseButton)

    expect(
      screen
        .getByRole("button", { name: "Expand create command" })
        .getAttribute("aria-expanded")
    ).toBe("false")
    expect(commandPanelCard?.getAttribute("data-expanded")).toBe("false")
    expect(commandExpansion?.classList.contains("grid-rows-[0fr]")).toBe(true)
  })
})
