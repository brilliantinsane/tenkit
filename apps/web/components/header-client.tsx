"use client"

import Image from "next/image"

import { GitHubMark } from "@/components/github-mark"
import { MobileNav } from "@/components/mobile-nav"
import { NpmMark } from "@/components/npm-mark"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { GITHUB_REPO_URL, NPM_PACKAGE_URL } from "@/constants/globals"
import { navLinks } from "@/constants/navigation"
import { useScroll } from "@/hooks/use-scroll"
import { cn } from "@/lib/utils"

export type HeaderStatsLabels = {
  stars: string
  weeklyDownloads: string
}

export function HeaderClient({ stats }: { stats: HeaderStatsLabels }) {
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
          <MobileNav stats={stats} />
          <a
            className="rounded-md p-2 hover:bg-muted dark:hover:bg-muted/50"
            href="#top"
            aria-label="Tenkit home"
          >
            <Image
              alt="logo"
              className="invert-0 dark:invert"
              height={18}
              loading="eager"
              priority
              src="/tenkit-logo-long.svg"
              width={75}
            />
            <h2 className="sr-only">tenkit</h2>
          </a>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <nav aria-label="Primary" className="flex items-center gap-1">
            {navLinks.map((link) => (
              <Button asChild key={link.label} size="sm" variant="ghost">
                <a href={link.href}>{link.label}</a>
              </Button>
            ))}
          </nav>
          <div className="flex items-center gap-1.5 border-l pl-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="w-20 gap-1.5 rounded-full font-medium"
                >
                  <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
                    <GitHubMark data-icon="inline-start" />
                    <span
                      className="tabular-nums"
                      aria-label={`${stats.stars} GitHub stars`}
                    >
                      {stats.stars}
                    </span>
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8}>
                GitHub stars
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="w-30 gap-1.5 rounded-full font-medium"
                >
                  <a href={NPM_PACKAGE_URL} target="_blank" rel="noreferrer">
                    <NpmMark data-icon="inline-start" />
                    <span
                      className="tabular-nums"
                      aria-label={`${stats.weeklyDownloads} weekly npm downloads`}
                    >
                      {stats.weeklyDownloads}/wk
                    </span>
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8}>
                Weekly npm downloads
              </TooltipContent>
            </Tooltip>
            <ThemeSwitcher buttonSize="icon-sm" />
          </div>
        </div>
        <div className="md:hidden">
          <ThemeSwitcher buttonSize="icon" />
        </div>
      </nav>
    </header>
  )
}
