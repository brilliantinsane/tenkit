import type { ReactNode } from "react"

import { DocsShell } from "@/components/docs/docs-shell"

export default function DocsRootLayout({ children }: { children: ReactNode }) {
  return <DocsShell>{children}</DocsShell>
}
