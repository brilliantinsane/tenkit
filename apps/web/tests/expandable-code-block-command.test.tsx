// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, describe, expect, test } from "vitest"

import { CreateCommandAnalyticsProvider } from "@/components/create-command-analytics"
import { ExpandableCodeBlockCommand } from "@/components/expandable-code-block-command"
import type { ConfiguratorPackageManager } from "@/lib/configurator"

afterEach(cleanup)

describe("ExpandableCodeBlockCommand", () => {
  test("animates the package manager icon when the selected tab changes", async () => {
    const user = userEvent.setup()

    function CommandHarness() {
      const [packageManager, setPackageManager] =
        useState<ConfiguratorPackageManager>("pnpm")

      return (
        <CreateCommandAnalyticsProvider
          value={{
            surface: "configurator",
            setupType: "white-label",
            styling: "bare",
            generatedAppOptions: {
              backend: "none",
              auth: "none",
              database: "none",
              orm: "none",
            },
            git: true,
            install: true,
            projectNameCustomized: false,
          }}
        >
          <ExpandableCodeBlockCommand
            pnpm="pnpm create tenkit@latest"
            npm="npm create tenkit@latest"
            bun="bun create tenkit@latest"
            value={packageManager}
            onValueChange={setPackageManager}
            expanded={false}
            onExpandedChange={() => undefined}
          />
        </CreateCommandAnalyticsProvider>
      )
    }

    render(<CommandHarness />)

    const initialIcon = document.querySelector(
      '[data-slot="animated-package-manager-icon"]'
    )

    expect(initialIcon?.getAttribute("data-package-manager-value")).toBe("pnpm")
    expect(initialIcon?.getAttribute("style")).toContain("opacity")

    await user.click(screen.getByRole("tab", { name: "npm" }))

    const nextIcon = document.querySelector(
      '[data-slot="animated-package-manager-icon"][data-package-manager-value="npm"]'
    )

    expect(nextIcon).not.toBeNull()
    expect(nextIcon).not.toBe(initialIcon)
  })
})
