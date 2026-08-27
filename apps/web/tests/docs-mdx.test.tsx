import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, test } from "vitest"

import { getMDXComponents } from "@/components/docs/mdx"

describe("documentation MDX components", () => {
  test("renders fenced commands with the shared command block", () => {
    const { pre: Pre } = getMDXComponents()
    const markup = renderToStaticMarkup(
      createElement(
        Pre,
        null,
        createElement("code", null, "pnpm create tenkit@latest --yes")
      )
    )

    expect(markup).toContain('data-slot="code-block-command"')
    expect(markup).toContain("pnpm create tenkit@latest --yes")
  })

  test("rejects empty fenced commands", () => {
    const { pre: Pre } = getMDXComponents()

    expect(() => renderToStaticMarkup(createElement(Pre))).toThrow(
      "Documentation code blocks must contain a command."
    )
  })
})
