"use client"

import React from "react"
import { MenuIcon, XIcon } from "lucide-react"

import { GitHubMark } from "@/components/github-mark"
import { NpmMark } from "@/components/npm-mark"
import { Portal, PortalBackdrop } from "@/components/portal"
import { Button } from "@/components/ui/button"
import { GITHUB_REPO_URL, NPM_PACKAGE_URL } from "@/constants/globals"
import { navLinks } from "@/constants/navigation"
import { cn } from "@/lib/utils"

type MobileNavStats = {
  stars: string
  weeklyDownloads: string
}

export function MobileNav({ stats }: { stats: MobileNavStats }) {
  const [open, setOpen] = React.useState(false)
  const closeMenu = React.useCallback(() => setOpen(false), [])
  const toggleMenu = React.useCallback(() => {
    setOpen((isOpen) => !isOpen)
  }, [])

  return (
    <div className="md:hidden">
      <Button
        aria-controls="mobile-menu"
        aria-expanded={open}
        aria-label="Toggle menu"
        className="md:hidden"
        onClick={toggleMenu}
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
                  <a href={link.href} onClick={closeMenu}>
                    {link.label}
                  </a>
                </Button>
              ))}
            </div>
            <div className="relative mt-10 pt-4 before:pointer-events-none before:absolute before:top-0 before:right-[calc(50%_-_50dvw)] before:left-[calc(50%_-_50dvw)] before:h-px before:bg-border">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  asChild
                  className="justify-center gap-1.5 rounded-full font-medium"
                  variant="outline"
                >
                  <a
                    href={GITHUB_REPO_URL}
                    target="_blank"
                    rel="noreferrer"
                    onClick={closeMenu}
                  >
                    <GitHubMark data-icon="inline-start" />
                    <span
                      className="tabular-nums"
                      aria-label={`${stats.stars} GitHub stars`}
                    >
                      {stats.stars}
                    </span>
                  </a>
                </Button>
                <Button
                  asChild
                  className="justify-center gap-1.5 rounded-full font-medium"
                  variant="outline"
                >
                  <a
                    href={NPM_PACKAGE_URL}
                    target="_blank"
                    rel="noreferrer"
                    onClick={closeMenu}
                  >
                    <NpmMark data-icon="inline-start" />
                    <span
                      className="tabular-nums"
                      aria-label={`${stats.weeklyDownloads} weekly npm downloads`}
                    >
                      {stats.weeklyDownloads}/wk
                    </span>
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}
