import { Suspense } from "react"

import { ConfigurePageLoading } from "@/components/configure-page-loading"
import { ConfigurePageContent } from "@/components/configure-page-content"
import { ConfigurePageShell } from "@/components/configure-page-shell"
import { CONFIGURE_PAGE_SEO, createPageMetadata } from "@/lib/seo"

export const metadata = createPageMetadata(CONFIGURE_PAGE_SEO)

export default function ConfigurePage() {
  return (
    <ConfigurePageShell>
      <Suspense fallback={<ConfigurePageLoading />}>
        <ConfigurePageContent />
      </Suspense>
    </ConfigurePageShell>
  )
}
