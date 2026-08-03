import { renderToStaticMarkup } from "react-dom/server"
import type { ComponentProps } from "react"
import { describe, expect, test, vi } from "vitest"

vi.mock("motion/react", () => ({
  motion: {
    div: ({
      animate: _animate,
      custom: _custom,
      initial: _initial,
      variants: _variants,
      ...props
    }: ComponentProps<"div"> & Record<string, unknown>) => {
      void [_animate, _custom, _initial, _variants]
      return <div data-motion-element="div" {...props} />
    },
    path: ({
      animate: _animate,
      custom: _custom,
      initial: _initial,
      variants: _variants,
      ...props
    }: ComponentProps<"path"> & Record<string, unknown>) => {
      void [_animate, _custom, _initial, _variants]
      return <path data-motion-element="path" {...props} />
    },
  },
  useReducedMotion: () => false,
}))

import { CursorClickIcon } from "@/components/ui/cursor-click"

describe("CursorClickIcon", () => {
  test("animates HTML wrappers instead of SVG paths", () => {
    const markup = renderToStaticMarkup(<CursorClickIcon animation="click" />)

    expect(markup).toContain('data-motion-element="div"')
    expect(markup).not.toContain('data-motion-element="path"')
  })
})
