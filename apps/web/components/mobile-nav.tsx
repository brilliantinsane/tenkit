"use client"

import React from "react"
import type { ReactNode } from "react"
import { MenuIcon, XIcon } from "lucide-react"
import Link from "next/link"

import { Portal, PortalBackdrop } from "@/components/portal"
import { Button } from "@/components/ui/button"
import { navLinks } from "@/constants/navigation"
import { trackDatabuddyEvent } from "@/lib/databuddy"
import { cn } from "@/lib/utils"

type MobileNavStats = {
  github: ReactNode
  npm: ReactNode
}

export function MobileNav({ stats }: { stats: MobileNavStats }) {
  const [open, setOpen] = React.useState(false)
  const closeMenu = React.useCallback(() => setOpen(false), [])
  const openMenu = React.useCallback(() => {
    trackDatabuddyEvent("mobile_nav_opened")
    setOpen(true)
  }, [])
  const closeMenuFromStatsLink = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target instanceof Element && event.target.closest("a[href]")) {
        closeMenu()
      }
    },
    [closeMenu]
  )

  return (
    <div className="md:hidden">
      <Button
        aria-controls="mobile-menu"
        aria-expanded={open}
        aria-label="Toggle menu"
        className="md:hidden"
        onClick={open ? closeMenu : openMenu}
        size="icon"
        variant="outline"
      >
        {open ? (
          <XIcon className="size-4.5" />
        ) : (
          <MenuIcon className="size-4.5" />
        )}
      </Button>
      {open && (
        <Portal className="top-16" id="mobile-menu">
          <PortalBackdrop />
          <div
            className={cn(
              "ease-out data-[slot=open]:animate-in data-[slot=open]:zoom-in-97",
              "mx-auto h-full w-[calc(100%-2rem)] max-w-6xl px-4 py-4"
            )}
            data-slot={open ? "open" : "closed"}
          >
            <div className="grid gap-y-2">
              {navLinks.map((link) => (
                <Button
                  asChild
                  className="w-full justify-start px-0"
                  key={link.label}
                  variant="ghost"
                >
                  <Link href={link.href} onClick={closeMenu}>
                    {link.label}
                  </Link>
                </Button>
              ))}
            </div>
            <div className="relative mt-10 pt-4 before:pointer-events-none before:absolute before:top-0 before:right-[calc(50%_-_50dvw)] before:left-[calc(50%_-_50dvw)] before:h-px before:bg-border">
              <div
                className="grid grid-cols-2 gap-2"
                onClickCapture={closeMenuFromStatsLink}
              >
                {stats.github}
                {stats.npm}
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}
