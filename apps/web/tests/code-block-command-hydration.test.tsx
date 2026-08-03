// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, test } from "vitest"

import { CodeBlockCommand } from "@/components/code-block-command"
import { CreateCommandAnalyticsProvider } from "@/components/create-command-analytics"

describe("CodeBlockCommand hydration", () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  test("reveals the persisted package manager after hydration", async () => {
    localStorage.setItem("tenkit:package-manager:v1", JSON.stringify("npm"))

    render(
      <CreateCommandAnalyticsProvider value={{ surface: "landing" }}>
        <CodeBlockCommand
          pnpm="pnpm create tenkit@latest"
          npm="npm create tenkit@latest"
        />
      </CreateCommandAnalyticsProvider>
    )

    await waitFor(() => {
      expect(
        document.querySelector('[data-slot="code-block-command"]')?.classList
      ).not.toContain("invisible")
    })

    expect(
      screen.getByRole("tab", { name: "npm" }).getAttribute("aria-selected")
    ).toBe("true")
  })
})
