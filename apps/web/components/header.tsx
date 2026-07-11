import { Suspense } from "react"

import { GitHubMark } from "@/components/github-mark"
import { NpmMark } from "@/components/npm-mark"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { GITHUB_REPO_URL, NPM_PACKAGE_URL } from "@/constants/globals"
import {
  getGitHubStarsLabel,
  getWeeklyNpmDownloadsLabel,
} from "@/lib/header-stats"
import { cn } from "@/lib/utils"
import { HeaderClient, type HeaderStatsSlots } from "./header-client"

function HeaderStatButtonSkeleton({
  label,
  className,
}: {
  label: string
  className: string
}) {
  return (
    <span
      aria-label={label}
      role="status"
      className={cn(
        "inline-flex animate-pulse rounded-full border border-border bg-muted",
        className
      )}
    />
  )
}

async function DesktopGitHubStarsButton() {
  const stars = await getGitHubStarsLabel()

  return (
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
            <span className="tabular-nums" aria-label={`${stars} GitHub stars`}>
              {stars}
            </span>
          </a>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        GitHub stars
      </TooltipContent>
    </Tooltip>
  )
}

async function DesktopWeeklyNpmDownloadsButton() {
  const weeklyDownloads = await getWeeklyNpmDownloadsLabel()

  return (
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
              aria-label={`${weeklyDownloads} weekly npm downloads`}
            >
              {weeklyDownloads}/wk
            </span>
          </a>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        Weekly npm downloads
      </TooltipContent>
    </Tooltip>
  )
}

function createDesktopStatsSlots(): HeaderStatsSlots {
  return {
    github: (
      <Suspense
        fallback={
          <HeaderStatButtonSkeleton
            label="Loading GitHub stars"
            className="h-8 w-20"
          />
        }
      >
        <DesktopGitHubStarsButton />
      </Suspense>
    ),
    npm: (
      <Suspense
        fallback={
          <HeaderStatButtonSkeleton
            label="Loading weekly npm downloads"
            className="h-8 w-30"
          />
        }
      >
        <DesktopWeeklyNpmDownloadsButton />
      </Suspense>
    ),
  }
}

export function Header() {
  const desktopStats = createDesktopStatsSlots()

  return <HeaderClient desktopStats={desktopStats} />
}
