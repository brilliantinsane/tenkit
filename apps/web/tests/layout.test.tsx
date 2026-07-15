import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, test, vi } from "vitest"

vi.mock("next/font/google", () => ({
  Dosis: () => ({ className: "", variable: "" }),
  Geist_Mono: () => ({ className: "", variable: "" }),
  Inter: () => ({ className: "", variable: "" }),
  Space_Grotesk: () => ({ className: "", variable: "" }),
}))

vi.mock("nuqs/adapters/next/app", () => ({
  NuqsAdapter: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("@/components/databuddy-analytics", () => ({
  DatabuddyAnalytics: () => null,
}))

vi.mock("@/components/header", () => ({
  Header: () => <header />,
}))

vi.mock("@/components/jotai-provider", () => ({
  JotaiProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("@/components/theme-provider", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
}))

import RootLayout from "@/app/layout"

describe("RootLayout", () => {
  test("renders route content without a global Configurator modal", () => {
    const markup = renderToStaticMarkup(
      <RootLayout>
        <main>Route content</main>
      </RootLayout>
    )

    expect(markup).toContain('data-slot="app-content"')
    expect(markup).not.toContain("configurator-dialog")
  })
})
