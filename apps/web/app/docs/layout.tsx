import type { ReactNode } from "react"
import { DocsLayout } from "fumadocs-ui/layouts/docs"

import { GITHUB_REPO_URL } from "@/constants/globals"
import { source } from "@/lib/source"

export default function DocsRootLayout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      githubUrl={GITHUB_REPO_URL}
      nav={{
        title: "Tenkit Docs",
        url: "/docs",
      }}
      tree={source.getPageTree()}
    >
      {children}
    </DocsLayout>
  )
}
