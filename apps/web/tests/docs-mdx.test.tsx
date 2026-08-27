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
    expect(markup).toContain("npm create tenkit@latest -- --yes")
    expect(markup).toContain("bun create tenkit@latest --yes")
  })

  test("converts every line and omits npm's empty argument separator", () => {
    const { pre: Pre } = getMDXComponents()
    const markup = renderToStaticMarkup(
      createElement(
        Pre,
        null,
        createElement("code", null, "pnpm create tenkit@latest")
      )
    )

    expect(markup).toContain("npm create tenkit@latest")
    expect(markup).not.toContain("npm create tenkit@latest --")

    const multilineMarkup = renderToStaticMarkup(
      createElement(
        Pre,
        null,
        createElement(
          "code",
          null,
          "pnpm typecheck\npnpm test\npnpm expo:config"
        )
      )
    )

    expect(multilineMarkup).toContain(
      "npm typecheck\nnpm test\nnpm expo:config"
    )
    expect(multilineMarkup).toContain(
      "bun typecheck\nbun test\nbun expo:config"
    )
  })

  test("rejects empty fenced commands", () => {
    const { pre: Pre } = getMDXComponents()

    expect(() => renderToStaticMarkup(createElement(Pre))).toThrow(
      "Documentation code blocks must contain a command."
    )
  })
})
