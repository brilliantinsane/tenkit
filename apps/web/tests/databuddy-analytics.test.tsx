import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, test, vi } from "vitest"

const { renderDatabuddy } = vi.hoisted(() => ({
  renderDatabuddy: vi.fn(() => <div data-slot="databuddy" />),
}))

vi.mock("next/dynamic", () => ({
  default: () => renderDatabuddy,
}))

vi.mock("@/lib/databuddy", () => ({
  DATABUDDY_CLIENT_ID: undefined,
  IS_DATABUDDY_TRACKING_ENABLED: false,
}))

import { DatabuddyAnalytics } from "@/components/databuddy-analytics"

describe("DatabuddyAnalytics", () => {
  test("does not mount the analytics module when tracking is disabled", () => {
    expect(renderToStaticMarkup(<DatabuddyAnalytics />)).toBe("")
    expect(renderDatabuddy).not.toHaveBeenCalled()
  })
})
