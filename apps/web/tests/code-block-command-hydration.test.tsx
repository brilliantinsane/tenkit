// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Provider } from "jotai"
import type { PropsWithChildren } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, test } from "vitest"

import { CodeBlockCommand } from "@/components/code-block-command"
import { CreateCommandAnalyticsProvider } from "@/components/create-command-analytics"

function TestProviders({ children }: PropsWithChildren) {
  return (
    <Provider>
      <CreateCommandAnalyticsProvider value={{ surface: "landing" }}>
        {children}
      </CreateCommandAnalyticsProvider>
    </Provider>
  )
}

describe("CodeBlockCommand hydration", () => {
  afterEach(() => {
    cleanup()
    document.body.replaceChildren()
    localStorage.clear()
  })

  test("selects the persisted package manager before hydration", () => {
    localStorage.setItem("tenkit:package-manager:v1", JSON.stringify("npm"))

    document.body.innerHTML = renderToStaticMarkup(
      <TestProviders>
        <CodeBlockCommand
          pnpm="pnpm create tenkit@latest"
          npm="npm create tenkit@latest"
        />
      </TestProviders>
    )

    const script = document.querySelector("script")
    window.eval(script?.textContent ?? "")

    expect(
      document
        .querySelector('[role="tab"][data-package-manager-value="npm"]')
        ?.getAttribute("aria-selected")
    ).toBe("true")
    expect(
      document
        .querySelector('[role="tabpanel"][data-package-manager-value="npm"]')
        ?.getAttribute("data-state")
    ).toBe("active")
    expect(
      document
        .querySelector('[role="tabpanel"][data-package-manager-value="pnpm"]')
        ?.getAttribute("data-state")
    ).toBe("inactive")
  })

  test("reveals the persisted package manager after hydration", async () => {
    localStorage.setItem("tenkit:package-manager:v1", JSON.stringify("npm"))

    render(
      <TestProviders>
        <CodeBlockCommand
          pnpm="pnpm create tenkit@latest"
          npm="npm create tenkit@latest"
        />
      </TestProviders>
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

  test("falls back to the first available package manager", async () => {
    localStorage.setItem("tenkit:package-manager:v1", JSON.stringify("yarn"))

    render(
      <TestProviders>
        <CodeBlockCommand
          pnpm="pnpm create tenkit@latest"
          npm="npm create tenkit@latest"
        />
      </TestProviders>
    )

    await waitFor(() => {
      expect(
        screen.getByRole("tab", { name: "pnpm" }).getAttribute("aria-selected")
      ).toBe("true")
    })
  })

  test("animates the package manager icon after hydration", async () => {
    const user = userEvent.setup()

    render(
      <TestProviders>
        <CodeBlockCommand
          pnpm="pnpm create tenkit@latest"
          npm="npm create tenkit@latest"
        />
      </TestProviders>
    )

    const initialIcon = await waitFor(() => {
      const icon = document.querySelector(
        '[data-slot="animated-package-manager-icon"]'
      )
      expect(icon).not.toBeNull()
      return icon
    })

    expect(initialIcon?.getAttribute("data-package-manager-value")).toBe("pnpm")

    await user.click(screen.getByRole("tab", { name: "npm" }))

    const nextIcon = document.querySelector(
      '[data-slot="animated-package-manager-icon"][data-package-manager-value="npm"]'
    )

    expect(nextIcon).not.toBeNull()
    expect(nextIcon).not.toBe(initialIcon)
  })
})
