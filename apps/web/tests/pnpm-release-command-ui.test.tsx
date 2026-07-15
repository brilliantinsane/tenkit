// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { CodeBlockCommand } from "@/components/code-block-command"
import { ExpandableCodeBlockCommand } from "@/components/expandable-code-block-command"
import { PNPM_LATEST_SAFE_AT } from "@/lib/pnpm-release-command"

vi.mock("@/lib/databuddy", () => ({ trackDatabuddyEvent: vi.fn() }))

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("pnpm release command UI", () => {
  test("shows and copies the pinned command with its release-age notice", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(PNPM_LATEST_SAFE_AT - 1_000)
    const writeText = vi.fn().mockResolvedValue(undefined)

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })

    render(
      <CodeBlockCommand
        pnpm="pnpm create tenkit@latest"
        npm="npm create tenkit@latest"
      />
    )

    const command = screen.getByText(
      (_, element) =>
        element?.getAttribute("data-slot") === "code-block" &&
        element.textContent?.includes("pnpm create tenkit@0.2.0") === true
    )

    expect(command.textContent).toContain("pnpm create tenkit@0.2.0")
    expect(screen.getByRole("note").textContent).toContain(
      "pnpm 11 may resolve the previous latest release"
    )

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy" }))
    })

    expect(writeText).toHaveBeenCalledWith("pnpm create tenkit@0.2.0")
  })

  test("preserves configurator flags and leaves other launchers unchanged", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(PNPM_LATEST_SAFE_AT - 1_000)
    const writeText = vi.fn().mockResolvedValue(undefined)

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })

    const { rerender } = render(
      <ExpandableCodeBlockCommand
        pnpm="pnpm create tenkit@latest --name tenkit-app --styling uniwind"
        npm="npm create tenkit@latest -- --name tenkit-app --styling uniwind"
        bun="bun create tenkit@latest --name tenkit-app --styling uniwind"
        value="npm"
        expanded={false}
        onValueChange={vi.fn()}
        onExpandedChange={vi.fn()}
      />
    )

    expect(screen.queryByRole("note")).toBeNull()
    expect(document.body.textContent).toContain("npm create tenkit@latest")

    rerender(
      <ExpandableCodeBlockCommand
        pnpm="pnpm create tenkit@latest --name tenkit-app --styling uniwind"
        npm="npm create tenkit@latest -- --name tenkit-app --styling uniwind"
        bun="bun create tenkit@latest --name tenkit-app --styling uniwind"
        value="pnpm"
        expanded={false}
        onValueChange={vi.fn()}
        onExpandedChange={vi.fn()}
      />
    )

    expect(screen.getByRole("note")).toBeDefined()
    expect(document.body.textContent).toContain(
      "pnpm create tenkit@0.2.0 --name tenkit-app --styling uniwind"
    )

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy" }))
    })

    expect(writeText).toHaveBeenCalledWith(
      "pnpm create tenkit@0.2.0 --name tenkit-app --styling uniwind"
    )
  })
})
