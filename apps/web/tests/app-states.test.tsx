// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, test, vi } from "vitest"

import AppError from "@/app/error"
import ConfigureRouteLoading from "@/app/configure/loading"

describe("App Router states", () => {
  test("renders a useful Configurator loading state", () => {
    const markup = renderToStaticMarkup(<ConfigureRouteLoading />)

    expect(markup).toContain("Loading configurator")
    expect(markup).toContain("Project configurator")
    expect(markup).toContain(
      "Shape the generated project, inspect the exact command, then copy it into your terminal."
    )
    expect(markup).toContain('aria-busy="true"')
    expect(markup).toContain('data-slot="configure-page-loading"')
    expect(markup.match(/data-slot="skeleton"/g)?.length).toBeGreaterThan(10)
    expect(markup).not.toContain('data-slot="spinner"')
  })

  test("offers recovery from an unexpected route error", () => {
    const unstableRetry = vi.fn()

    render(
      <AppError
        error={new Error("Private failure detail")}
        unstable_retry={unstableRetry}
      />
    )

    expect(screen.queryByText("Private failure detail")).toBeNull()
    expect(screen.getByText("500")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }))
    expect(unstableRetry).toHaveBeenCalledOnce()
    expect(
      screen.getByRole("link", { name: "Go Home" }).getAttribute("href")
    ).toBe("/")
  })
})
