import { describe, expect, test } from "vitest"

import {
  PNPM_LATEST_SAFE_AT,
  resolvePnpmReleaseCommand,
} from "@/lib/pnpm-release-command"

describe("pnpm release command", () => {
  test("pins latest to the exact release before pnpm considers it mature", () => {
    expect(
      resolvePnpmReleaseCommand(
        "pnpm create tenkit@latest --name tenkit-app",
        PNPM_LATEST_SAFE_AT - 1
      )
    ).toEqual({
      command: "pnpm create tenkit@0.2.0 --name tenkit-app",
      isTemporarilyPinned: true,
    })
  })

  test("switches back to latest at the maturity timestamp", () => {
    expect(
      resolvePnpmReleaseCommand(
        "pnpm create tenkit@latest --name tenkit-app",
        PNPM_LATEST_SAFE_AT
      )
    ).toEqual({
      command: "pnpm create tenkit@latest --name tenkit-app",
      isTemporarilyPinned: false,
    })
  })

  test("does not rewrite commands that already select an exact version", () => {
    expect(
      resolvePnpmReleaseCommand(
        "pnpm create tenkit@0.2.0 --name tenkit-app",
        PNPM_LATEST_SAFE_AT - 1
      )
    ).toEqual({
      command: "pnpm create tenkit@0.2.0 --name tenkit-app",
      isTemporarilyPinned: false,
    })
  })
})
