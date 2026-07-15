import { Layers3Icon } from "lucide-react"
import { Suspense } from "react"
import { preload } from "react-dom"

import { CodeBlockCommand } from "@/components/code-block-command"
import { HeroAnnouncement } from "@/components/hero-announcement"
import { FullWidthDivider } from "@/components/full-width-divider"
import { GitHubMark } from "@/components/github-mark"
import { HeroDemoVideo } from "@/components/hero-demo-video"
import { Button } from "@/components/ui/button"
import { GITHUB_REPO_URL } from "@/constants/globals"
import { HERO_POSTER_PATH } from "@/lib/hero-media"
import { cn } from "@/lib/utils"

const heroAnnouncementFallback = (
  <div
    aria-hidden="true"
    className="h-[34px] w-[265px] rounded-full border bg-card"
  />
)

export function HeroSection() {
  preload(HERO_POSTER_PATH, { as: "image" })

  return (
    <section id="top">
      <div className="relative flex flex-col items-center justify-center gap-5 px-4 py-12 md:px-4 md:py-24 lg:py-28">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-1 size-full overflow-hidden"
        />
        <Suspense fallback={heroAnnouncementFallback}>
          <HeroAnnouncement />
        </Suspense>

        <h1
          className={cn(
            "relative max-w-2xl text-center font-heading text-3xl text-balance text-foreground md:text-5xl lg:text-6xl",
            "animate-in delay-100 duration-500 ease-out fill-mode-backwards fade-in slide-in-from-bottom-3"
          )}
        >
          One Codebase Many Branded Apps
        </h1>

        <p
          className={cn(
            "max-w-2xl text-center text-sm leading-6 text-pretty text-muted-foreground sm:text-lg sm:leading-8",
            "animate-in delay-200 duration-500 ease-out fill-mode-backwards fade-in slide-in-from-bottom-3"
          )}
        >
          Generate a project around the Setup Type you actually ship:
          white-label App Variants, Runtime Tenants, or a hybrid with selected
          standalone breakouts.
        </p>

        <div className="flex w-full max-w-sm animate-in flex-col items-stretch justify-center gap-3 pt-3 delay-300 duration-500 ease-out fill-mode-backwards fade-in slide-in-from-bottom-3 sm:w-fit sm:max-w-none sm:flex-row sm:items-center">
          <Button asChild>
            <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
              <GitHubMark data-icon="inline-start" />
              View source
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="#setup-types">
              Setup types <Layers3Icon data-icon="inline-end" />
            </a>
          </Button>
        </div>

        <div
          id="commands"
          className={cn(
            "group w-full max-w-xl scroll-mt-24 gap-3 rounded-xl border bg-card/80 p-1.5 shadow-sm backdrop-blur",
            "animate-in transition-all delay-500 duration-500 ease-out fill-mode-backwards fade-in slide-in-from-bottom-3"
          )}
        >
          <CodeBlockCommand
            pnpm="pnpm create tenkit@latest"
            npm="npm create tenkit@latest"
            bun="bun create tenkit@latest"
          />
        </div>
      </div>
      <div className="relative">
        <FullWidthDivider position="top" />
        <div
          className={cn(
            "surface-card group relative w-full overflow-hidden",
            "animate-in delay-200 duration-500 ease-out fill-mode-backwards fade-in slide-in-from-bottom-3"
          )}
          style={{ aspectRatio: "16 / 9" }}
        >
          <HeroDemoVideo />
        </div>
        <FullWidthDivider position="bottom" />
      </div>
    </section>
  )
}
