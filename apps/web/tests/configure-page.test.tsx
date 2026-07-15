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
    expect(markup).not.toContain("Create command")
    expect(markup).toContain("Project name")
    expect(markup).toContain("Setup Type")
    expect(markup).toContain("Styling")
    expect(markup).toContain("App Variants")
    expect(markup).toContain("Package manager")
    expect(markup).toContain("Install dependencies")
    expect(markup).toContain("Initialize Git")
    expect(markup).toContain("Expand create command")
    expect(markup).toContain("Ready to inspect it")
    expect(markup).not.toContain("Copy create command")
    expect(markup).not.toContain('href="#configure-command"')
    expect(markup).toContain("lg:sticky")
    expect(markup).toContain("lg:sticky lg:top-24")
    expect(markup).not.toContain("lg:sticky lg:top-16")
    expect(markup).not.toContain("relative h-px lg:hidden")
    expect(markup).toContain("Unistyles")
    expect(markup).toContain("Adaptive React Native styling")
    expect(markup).not.toContain("Coming soon")
    expect(markup).not.toContain('disabled=""')
    expect(markup).toContain("Randomize configuration")
    expect(markup).toContain("Reset defaults")
    expect(markup).toContain("Fast, disk-efficient installs")
    expect(markup).toContain("Largest software registry")
    expect(markup).toContain("All-in-one JS toolkit")
    expect(markup).toContain("Branded App Variants")
    expect(markup).toContain("React Native StyleSheet")
    expect(markup).toContain("Tailwind for React Native")
    expect(markup).toContain("bg-code")
    expect(markup).not.toContain("lg:border-l")
    expect(markup).not.toContain('class="sticky top-16')
    expect(markup).not.toContain("Configure create command")
    expect(markup).toContain('data-slot="configurator-command-panel-card"')
    const projectNameLabelClasses = markup
      .match(
        /<label data-slot="field-label" class="([^"]+)" for="page-configurator-project-name">Project name<\/label>/
      )?.[1]
      ?.split(" ")

    expect(projectNameLabelClasses).toEqual(
      expect.arrayContaining(["font-heading", "text-lg", "font-semibold"])
    )
    expect(
      markup.match(/pointer-events-none absolute inset-px z-10/g)
    ).toHaveLength(9)
    expect(markup.match(/data-position="bottom"/g)).toHaveLength(1)
    expect(markup.match(/data-position="top"/g)).toHaveLength(1)
  })

  test("uses one responsive gutter for outer padding, columns, and section rows", () => {
    const markup = renderConfigurator()
    const layoutClasses = markup
      .match(/data-slot="configurator-layout" class="([^"]+)"/)?.[1]
      ?.split(" ")

    expect(layoutClasses).toEqual(
      expect.arrayContaining([
        "grid",
        "gap-4",
        "p-4",
        "sm:gap-8",
        "sm:p-8",
        "lg:grid-cols-2",
      ])
    )
    const sectionStackClasses = markup
      .match(/data-slot="configurator-section-stack" class="([^"]+)"/)?.[1]
      ?.split(" ")

    expect(sectionStackClasses).toEqual(
      expect.arrayContaining([
        "flex",
        "min-w-0",
        "flex-col",
        "gap-4",
        "sm:gap-8",
      ])
    )
    expect(markup.match(/data-slot="configurator-section"/g)).toHaveLength(4)
    expect(markup).not.toContain("lg:col-start-2")
    expect(markup).not.toContain("px-4 py-12")
  })

  test("uses the homepage entrance motion with a reduced-motion fallback", () => {
    const markup = renderConfigurator()
    const classesForSlot = (slot: string) =>
      markup
        .match(new RegExp(`data-slot="${slot}" class="([^"]+)"`))?.[1]
        ?.split(" ")
    const sharedMotionClasses = [
      "animate-in",
      "duration-500",
      "ease-out",
      "fill-mode-backwards",
      "fade-in",
      "slide-in-from-bottom-3",
      "motion-reduce:animate-none",
    ]

    expect(classesForSlot("configurator-hero-title")).toEqual(
      expect.arrayContaining([...sharedMotionClasses, "delay-100"])
    )
    expect(classesForSlot("configurator-hero-description")).toEqual(
      expect.arrayContaining([...sharedMotionClasses, "delay-200"])
    )
    expect(classesForSlot("configurator-layout")).toEqual(
      expect.arrayContaining([...sharedMotionClasses, "delay-300"])
    )
  })

  test("derives the full Configurator state from route query params", () => {
    const markup = renderConfigurator(
      "?name=Shared%20App&setup=runtime-tenants&styling=unistyles&pm=npm&vn=Tenkit%20Network&vacc=%23123ABC&git=false&i=false"
    )

    expect(markup).toContain('value="Shared App"')
    expect(markup).toContain('value="Tenkit Network"')
    expect(markup).toContain('value="#123ABC"')
    expect(markup).toContain("npm create tenkit@latest -- --name shared-app")
    expect(markup).toContain("--setup runtime-tenants")
    expect(markup).toContain("--styling unistyles")
    expect(markup).toContain("--package-manager npm")
    expect(markup).toContain("--no-git --no-install")
  })
})
