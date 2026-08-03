// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import { HeroDemoVideo } from "@/components/hero-demo-video"

describe("HeroDemoVideo", () => {
  test("prefers the high-quality AV1 source and keeps an H.264 fallback", () => {
    render(<HeroDemoVideo />)

    const video = screen.getByLabelText("Tenkit product demo")
    const sources = Array.from(video.querySelectorAll("source"))

    expect(video.getAttribute("poster")).toBe("/hero-poster.jpg")
    expect(
      sources.map((source) => ({
        src: source.getAttribute("src"),
        type: source.getAttribute("type"),
      }))
    ).toEqual([
      { src: "/hero-video.webm", type: 'video/webm; codecs="av01"' },
      { src: "/hero-video.mp4", type: "video/mp4" },
    ])
  })
})
