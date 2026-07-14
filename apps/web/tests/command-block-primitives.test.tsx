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
      <CommandActions
        packageManager="pnpm"
        command="pnpm create tenkit@latest --name Private Customer"
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Copy" }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        "pnpm create tenkit@latest --name Private Customer"
      )
      expect(trackDatabuddyEvent).toHaveBeenCalledWith(
        "create_command_copied",
        { packageManager: "pnpm" }
      )
    })
  })
})
