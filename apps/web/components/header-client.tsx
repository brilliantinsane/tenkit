"use client"

import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"

import { ConfiguratorHeaderTrigger } from "@/components/configurator-header-trigger"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { Button } from "@/components/ui/button"
import { navLinks } from "@/constants/navigation"
import { useScroll } from "@/hooks/use-scroll"
import { cn } from "@/lib/utils"

export type HeaderStatsSlots = {
  github: ReactNode
  npm: ReactNode
}

export function HeaderClient({
  desktopStats,
}: {
  desktopStats: HeaderStatsSlots
}) {
  const scrolled = useScroll(72, 28)

  return (
    <header
      className={cn(
        "sticky top-0 z-50 mx-auto w-[calc(100%-2rem)] max-w-6xl md:transition-[top,max-width,border-radius,border-color,box-shadow,background-color,backdrop-filter] md:duration-300 md:ease-out",
        {
          "shadow md:top-2 md:max-w-4xl md:rounded-md md:border": scrolled,
          "bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/50":
            scrolled,
          "after:pointer-events-none after:absolute after:right-[calc(50%_-_50dvw)] after:bottom-0 after:left-[calc(50%_-_50dvw)] after:h-px after:bg-border":
            !scrolled,
          "after:pointer-events-none after:absolute after:right-[calc(50%_-_50dvw)] after:bottom-0 after:left-[calc(50%_-_50dvw)] after:h-px after:bg-border md:after:hidden":
            scrolled,
        }
      )}
    >
      {scrolled ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 inset-y-0 md:hidden"
        >
          <span className="absolute inset-y-0 left-0 w-px bg-border" />
          <span className="absolute inset-y-0 right-0 w-px bg-border" />
        </div>
      ) : null}
      <nav
        className={cn(
          "flex h-16 w-full items-center justify-between px-4 md:h-14 md:transition-all md:ease-out",
          {
            "md:px-2": scrolled,
          }
        )}
      >
        <div className="flex items-center gap-2">
          <Link
            className="rounded-md p-2 hover:bg-muted dark:hover:bg-muted/50"
            href="/#top"
            aria-label="Tenkit home"
          >
            <Image
              alt="logo"
              className="h-[30px] w-auto invert-0 dark:invert"
              height={157}
              loading="eager"
              priority
              src="/tenkit-logo-long.svg"
              width={374}
            />
            <h2 className="sr-only">tenkit</h2>
          </Link>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <nav aria-label="Primary" className="flex items-center gap-1">
            {navLinks.map((link) => (
              <Button asChild key={link.label} size="sm" variant="ghost">
                <a href={link.href}>{link.label}</a>
              </Button>
            ))}
          </nav>
          <div className="flex items-center border-l pl-2">
            <ConfiguratorHeaderTrigger />
          </div>
          <div className="flex items-center gap-1.5 border-l pl-2">
            {desktopStats.github}
            {desktopStats.npm}
            <ThemeSwitcher buttonSize="icon-sm" />
          </div>
        </div>
        <div className="flex items-center md:hidden">
          <ConfiguratorHeaderTrigger />
          <div className="ml-2 border-l pl-2">
            <ThemeSwitcher buttonSize="icon-sm" />
          </div>
        </div>
      </nav>
    </header>
  )
}
