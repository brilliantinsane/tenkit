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

afterEach(cleanup)

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

    await user.click(screen.getByRole("button", { name: "Reset to defaults" }))

    expect(onUrlUpdate).toHaveBeenCalledOnce()
    expect(onUrlUpdate.mock.lastCall?.[0].searchParams.toString()).toBe("")
  })
})
