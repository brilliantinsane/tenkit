// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

const { toast } = vi.hoisted(() => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock("sonner", () => ({ toast }))

import { CopyButton } from "@/components/copy-button"

describe("CopyButton", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  test("shows transient success feedback and preserves the callback", async () => {
    const onCopySuccess = vi.fn()
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })

    render(
      <CopyButton text="pnpm create tenkit" onCopySuccess={onCopySuccess} />
    )
    fireEvent.click(screen.getByRole("button", { name: "Copy" }))

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Copied to clipboard")
      expect(onCopySuccess).toHaveBeenCalledWith("pnpm create tenkit")
    })
  })

  test("shows transient error feedback and preserves the callback", async () => {
    const copyError = new Error("Clipboard unavailable")
    const onCopyError = vi.fn()
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(copyError) },
    })

    render(<CopyButton text="pnpm create tenkit" onCopyError={onCopyError} />)
    fireEvent.click(screen.getByRole("button", { name: "Copy" }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Unable to copy")
      expect(onCopyError).toHaveBeenCalledWith(copyError)
    })
  })
})
