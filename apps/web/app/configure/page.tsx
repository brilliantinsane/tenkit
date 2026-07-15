import { Suspense } from "react"

import { ConfigurePageContent } from "@/components/configure-page-content"
import { CONFIGURE_PAGE_SEO, createPageMetadata } from "@/lib/seo"

export const metadata = createPageMetadata(CONFIGURE_PAGE_SEO)

export default function ConfigurePage() {
  return (
    <Suspense fallback={null}>
      <ConfigurePageContent />
    </Suspense>
  )
}
