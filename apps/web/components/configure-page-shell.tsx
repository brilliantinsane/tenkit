import type { ReactNode } from "react"

import { FullWidthDivider } from "@/components/full-width-divider"
import { SiteFooter } from "@/components/site-footer"
import { cn } from "@/lib/utils"

const CONFIGURATOR_ENTRANCE_MOTION_CLASS_NAME =
  "animate-in duration-500 ease-out fill-mode-backwards fade-in slide-in-from-bottom-3 motion-reduce:animate-none"

export function ConfigurePageShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative overflow-hidden supports-[overflow:clip]:overflow-clip">
      <div className="relative mx-auto w-[calc(100%-2rem)] max-w-6xl">
        <section className="relative px-4 py-16 text-center sm:px-8 sm:py-24">
          <h1
            data-slot="configurator-hero-title"
            className={cn(
              "font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl",
              CONFIGURATOR_ENTRANCE_MOTION_CLASS_NAME,
              "delay-100"
            )}
          >
            Project configurator
          </h1>
          <p
            data-slot="configurator-hero-description"
            className={cn(
              "mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg",
              CONFIGURATOR_ENTRANCE_MOTION_CLASS_NAME,
              "delay-200"
            )}
          >
            Shape the generated project, inspect the exact command, then copy it
            into your terminal.
          </p>
          <FullWidthDivider position="bottom" />
        </section>

        {children}

        <div aria-hidden="true" className="relative h-px">
          <FullWidthDivider position="top" />
        </div>
        <SiteFooter />
      </div>
    </main>
  )
}
