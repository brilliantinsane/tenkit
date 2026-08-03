import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, test } from "vitest"

import { CodeBlockCommand } from "@/components/code-block-command"
import { CreateCommandAnalyticsProvider } from "@/components/create-command-analytics"

describe("CodeBlockCommand", () => {
  test("uses the accent background in light mode and page background in dark mode", () => {
    const markup = renderToStaticMarkup(
      <CreateCommandAnalyticsProvider value={{ surface: "landing" }}>
        <CodeBlockCommand pnpm="pnpm create tenkit@latest" />
      </CreateCommandAnalyticsProvider>
    )

    expect(markup).toMatch(/class="[^"]*bg-accent dark:bg-background/)
  })

  test("keeps the server-rendered command visible before hydration", () => {
    const markup = renderToStaticMarkup(
      <CreateCommandAnalyticsProvider value={{ surface: "landing" }}>
        <CodeBlockCommand pnpm="pnpm create tenkit@latest" />
      </CreateCommandAnalyticsProvider>
    )

    const commandRoot = markup.match(
      /<div[^>]*data-slot="code-block-command"[^>]*>/
    )?.[0]

    expect(commandRoot).not.toContain('aria-hidden="true"')
    expect(commandRoot).not.toMatch(/class="[^"]*invisible/)
    expect(markup).toContain("pnpm create tenkit@latest")
  })
})
