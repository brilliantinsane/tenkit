import path from "node:path"
import { fileURLToPath } from "node:url"

import type { NextConfig } from "next"
import { createMDX } from "fumadocs-mdx/next"

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "radix-ui"],
  },
  turbopack: {
    root: workspaceRoot,
  },
}

const withMDX = createMDX()

export default withMDX(nextConfig)
