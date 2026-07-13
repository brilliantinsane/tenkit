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

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
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

    await user.click(screen.getByRole("button", { name: /^Uniwind/ }))
    expect(onUrlUpdate.mock.lastCall?.[0].searchParams.get("styling")).toBe(
      "uniwind"
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

  test("reset clears every non-default query parameter", async () => {
    const user = userEvent.setup()
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>()

    render(
      <NuqsTestingAdapter
        hasMemory
        resetUrlUpdateQueueOnMount={false}
        searchParams="?name=Shared+App&setup=runtime-tenants&styling=uniwind&pm=npm&vn=Tenkit+Network&vacc=%23123ABC&git=false&i=false"
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
    expect(unselectedChoices).toHaveLength(5)

    for (const selectedChoice of selectedChoices) {
      expect(
        selectedChoice.querySelector("[data-selected-indicator]")
      ).not.toBeNull()
    }

    for (const unselectedChoice of unselectedChoices) {
      expect(
        unselectedChoice.querySelector("[data-selected-indicator]")
      ).toBeNull()
    }
  })
})
