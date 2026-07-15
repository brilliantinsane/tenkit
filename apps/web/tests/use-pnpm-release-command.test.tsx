// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { usePnpmReleaseCommand } from "@/hooks/use-pnpm-release-command"
import { PNPM_LATEST_SAFE_AT } from "@/lib/pnpm-release-command"

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("usePnpmReleaseCommand", () => {
  test("updates an open page to latest when the release becomes mature", () => {
    vi.useFakeTimers()
    vi.setSystemTime(PNPM_LATEST_SAFE_AT - 1_000)

    const { result } = renderHook(() =>
      usePnpmReleaseCommand("pnpm create tenkit@latest")
    )

    expect(result.current).toEqual({
      command: "pnpm create tenkit@0.2.0",
      isTemporarilyPinned: true,
    })

    act(() => {
      vi.advanceTimersByTime(1_001)
    })

    expect(result.current).toEqual({
      command: "pnpm create tenkit@latest",
      isTemporarilyPinned: false,
    })
  })
})
