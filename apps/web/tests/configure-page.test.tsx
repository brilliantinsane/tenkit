import { renderToStaticMarkup } from "react-dom/server"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { describe, expect, test } from "vitest"

import { ConfigurePageContent } from "@/components/configure-page-content"

describe("ConfigurePageContent", () => {
  function renderConfigurator(searchParams = "") {
    return renderToStaticMarkup(
      <NuqsTestingAdapter searchParams={searchParams}>
        <ConfigurePageContent />
      </NuqsTestingAdapter>
    )
  }

  test("renders the command panel and every configurator section", () => {
    const markup = renderConfigurator()

    expect(markup).toContain("Project configurator")
    expect(markup).toContain("Project name")
    expect(markup).toContain("Setup Type")
    expect(markup).toContain("Styling")
    expect(markup).toContain("App Variants")
    expect(markup).toContain("Package manager")
    expect(markup).toContain("Install dependencies")
    expect(markup).toContain("Initialize Git")
    expect(markup).toContain("Expand create command")
    expect(markup).toContain("Ready to inspect it")
    expect(markup).toContain('href="#configure-command"')
    expect(markup).toContain("lg:sticky")
    expect(markup).toContain("lg:sticky lg:top-16")
    expect(markup).not.toContain("relative h-px lg:hidden")
    expect(markup).toContain("Unistyles")
    expect(markup).toContain("Coming soon")
    expect(markup).toContain('disabled=""')
    expect(markup).toContain("Default package manager")
    expect(markup).toContain("Ships with Node.js")
    expect(markup).toContain("Fast Bun toolchain")
    expect(markup).toContain("bg-code")
    expect(markup).not.toContain("lg:border-l")
    expect(markup).not.toContain('class="sticky top-16')
    expect(markup).not.toContain("Configure create command")
    expect(
      markup.match(/pointer-events-none absolute inset-px z-10/g)
    ).toHaveLength(8)
    expect(markup.match(/data-position="bottom"/g)).toHaveLength(1)
    expect(markup.match(/data-position="top"/g)).toHaveLength(1)
  })

  test("derives the full Configurator state from route query params", () => {
    const markup = renderConfigurator(
      "?name=Shared%20App&setup=runtime-tenants&styling=uniwind&pm=npm&vn=Tenkit%20Network&vacc=%23123ABC&git=false&i=false"
    )

    expect(markup).toContain('value="Shared App"')
    expect(markup).toContain('value="Tenkit Network"')
    expect(markup).toContain('value="#123ABC"')
    expect(markup).toContain("npm create tenkit@latest -- --name shared-app")
    expect(markup).toContain("--setup runtime-tenants")
    expect(markup).toContain("--styling uniwind")
    expect(markup).toContain("--package-manager npm")
    expect(markup).toContain("--no-git --no-install")
  })
})
