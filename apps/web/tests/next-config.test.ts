import path from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import nextConfig from "../next.config"

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
)

describe("Next.js configuration", () => {
  it("keeps Turbopack inside the pnpm workspace", () => {
    expect(nextConfig.turbopack?.root).toBe(workspaceRoot)
  })
})
