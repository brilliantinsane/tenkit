"use client"

import { Suspense } from "react"

import { Button } from "@/components/ui/button"
import { useConfiguratorOpen } from "@/hooks/use-configurator-open"

const configuratorHeaderTriggerFallback = (
  <Button
    type="button"
    variant="ghost"
    size="sm"
    aria-hidden="true"
    className="pointer-events-none"
    tabIndex={-1}
  >
    Configure
  </Button>
)

function ConfiguratorHeaderTriggerClient() {
  const [, setConfiguratorOpen] = useConfiguratorOpen()

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={(event) => {
        event.currentTarget.blur()
        void setConfiguratorOpen(true)
      }}
    >
      Configure
    </Button>
  )
}

export function ConfiguratorHeaderTrigger() {
  return (
    <Suspense fallback={configuratorHeaderTriggerFallback}>
      <ConfiguratorHeaderTriggerClient />
    </Suspense>
  )
}
