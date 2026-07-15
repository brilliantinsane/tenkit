// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { CommandActions } from "@/components/command-block-primitives"
import { CreateCommandAnalyticsProvider } from "@/components/create-command-analytics"

const { trackDatabuddyEvent } = vi.hoisted(() => ({
  trackDatabuddyEvent: vi.fn(),
}))

vi.mock("@/lib/databuddy", () => ({ trackDatabuddyEvent }))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("CommandActions", () => {
  test("tracks bounded command metadata without copied user input", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })

    render(
      <CreateCommandAnalyticsProvider value={{ surface: "landing" }}>
        <CommandActions
          packageManager="pnpm"
          command="pnpm create tenkit@latest --name Private Customer"
        />
      </CreateCommandAnalyticsProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Copy" }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        "pnpm create tenkit@latest --name Private Customer"
      )
      expect(trackDatabuddyEvent).toHaveBeenCalledWith(
        "create_command_copied",
        { surface: "landing", packageManager: "pnpm" }
      )
    })
  })

  test("enriches Configurator copies with bounded selections", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })

    render(
      <CreateCommandAnalyticsProvider
        value={{
          surface: "configurator",
          setupType: "runtime-tenants",
          styling: "uniwind",
          git: false,
          install: true,
          projectNameCustomized: true,
        }}
      >
        <CommandActions
          packageManager="bun"
          command="bun create tenkit@latest --name Private Customer"
        />
      </CreateCommandAnalyticsProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Copy" }))

    await waitFor(() => {
      expect(trackDatabuddyEvent).toHaveBeenCalledWith(
        "create_command_copied",
        {
          surface: "configurator",
          setupType: "runtime-tenants",
          styling: "uniwind",
          packageManager: "bun",
          git: false,
          install: true,
          projectNameCustomized: true,
        }
      )
    })
  })
})
