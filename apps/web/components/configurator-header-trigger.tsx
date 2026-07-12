"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
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
    Configurator
  </Button>
)

function ConfiguratorHeaderTriggerClient() {
  const pathname = usePathname()

  if (pathname !== "/") {
    return (
      <Button asChild variant="ghost" size="sm">
        <Link href="/?cfg=true">Configurator</Link>
      </Button>
    )
  }

  return <HomeConfiguratorHeaderTrigger />
}

function HomeConfiguratorHeaderTrigger() {
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
      Configurator
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
