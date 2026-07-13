import { Suspense } from "react"

import { ConfigurePageContent } from "@/components/configure-page-content"

export default function ConfigurePage() {
  return (
    <Suspense fallback={null}>
      <ConfigurePageContent />
    </Suspense>
  )
}
