import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, test, vi } from "vitest"

vi.mock("next/link", () => ({
  default: (props: React.ComponentProps<"a">) => <a {...props} />,
}))

vi.mock("@/components/code-block-command", () => ({
  CodeBlockCommand: () => <div data-slot="create-command" />,
}))

vi.mock("@/components/hero-demo-video", () => ({
  HeroDemoVideo: () => <div data-slot="hero-demo" />,
}))

import { HeroSection } from "@/components/hero"

describe("HeroSection", () => {
  test("explains the product, generated outcome, and action hierarchy", () => {
    const markup = renderToStaticMarkup(<HeroSection />)

    expect(markup).toContain(
      '<span class="block whitespace-nowrap">Multi-tenant mobile apps</span>'
    )
    expect(markup).toContain(
      '<span class="block whitespace-nowrap">Set up in seconds.</span>'
    )
    expect(markup).toMatch(
      /data-slot="hero-title" class="[^"]*max-w-5xl[^"]*text-\[clamp\(1\.5rem,7vw,4\.5rem\)\]/
    )
    expect(markup).toContain(
      "Generate an Expo project with white-label and tenant setup built in."
    )
    expect(markup).toContain('href="/configure"')
    expect(markup.indexOf('href="/configure"')).toBeLessThan(
      markup.indexOf("View source")
    )
    expect(markup).toContain("What you get")
    expect(markup).toContain("Ready-to-run starter")
    expect(markup).toContain("Shared product code")
    expect(markup).toContain("Typed setup files")
    expect(markup).toContain("Native identity and build workflows")
    expect(markup).toContain('data-slot="hero-command-card"')
    expect(markup).toMatch(
      /data-slot="hero-command-card" class="[^"]*max-w-2xl/
    )
    expect(markup).not.toMatch(
      /data-slot="hero-outcomes-panel" class="[^"]*border-t/
    )
    expect(markup.indexOf('data-slot="create-command"')).toBeLessThan(
      markup.indexOf("What you get")
    )
    expect(markup).toMatch(
      /data-slot="hero-outcomes" class="[^"]*text-sm[^"]*sm:grid-cols-2/
    )
    expect(markup).toMatch(
      /data-slot="hero-outcomes-title" class="[^"]*text-xs[^"]*tracking-\[0\.18em\]/
    )
  })
})
