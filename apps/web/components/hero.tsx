import { ArrowRightIcon, CheckCircle2Icon } from "lucide-react"
import Link from "next/link"
import { preload } from "react-dom"

import { CodeBlockCommand } from "@/components/code-block-command"
import { CreateCommandAnalyticsProvider } from "@/components/create-command-analytics"
import { FullWidthDivider } from "@/components/full-width-divider"
import { GitHubMark } from "@/components/github-mark"
import { HeroDemoVideo } from "@/components/hero-demo-video"
import { Button } from "@/components/ui/button"
import { GITHUB_REPO_URL } from "@/constants/globals"
import { HERO_POSTER_PATH } from "@/lib/hero-media"
import { cn } from "@/lib/utils"

const generatedProjectOutcomes = [
  "Ready-to-run starter",
  "Shared product code",
  "Typed setup files",
  "Native identity and build workflows",
] as const

export function HeroSection() {
  preload(HERO_POSTER_PATH, { as: "image" })

  return (
    <section id="top">
      <div className="relative flex flex-col items-center justify-center gap-6 px-4 py-14 md:px-4 md:py-20 lg:py-24">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-1 size-full overflow-hidden"
        />

        <h1
          data-slot="hero-title"
          className={cn(
            "relative max-w-5xl text-center font-heading text-[clamp(1.5rem,7vw,4.5rem)] leading-[1.05] font-semibold tracking-tight text-foreground",
            "animate-in delay-100 duration-500 ease-out fill-mode-backwards fade-in slide-in-from-bottom-3"
          )}
        >
          <span className="block whitespace-nowrap">
            Multi-tenant mobile apps
          </span>
          <span className="block whitespace-nowrap">Set up in seconds.</span>
        </h1>

        <p
          className={cn(
            "max-w-3xl text-center text-lg leading-8 text-pretty text-muted-foreground sm:text-xl sm:leading-9",
            "animate-in delay-200 duration-500 ease-out fill-mode-backwards fade-in slide-in-from-bottom-3"
          )}
        >
          Generate an Expo project with white-label and tenant setup built in.
        </p>

        <div className="flex w-full max-w-sm animate-in flex-col items-stretch justify-center gap-3 pt-1 delay-300 duration-500 ease-out fill-mode-backwards fade-in slide-in-from-bottom-3 sm:w-fit sm:max-w-none sm:flex-row sm:items-center">
          <Button asChild size="lg">
            <Link href="/configure">
              Configure your project
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
              <GitHubMark data-icon="inline-start" />
              View source
            </a>
          </Button>
        </div>

        <div
          id="commands"
          data-slot="hero-command-card"
          className={cn(
            "group flex w-full max-w-2xl scroll-mt-24 flex-col gap-1.5 overflow-hidden rounded-xl border bg-card/80 p-1.5 shadow-sm backdrop-blur",
            "animate-in transition-all delay-500 duration-500 ease-out fill-mode-backwards fade-in slide-in-from-bottom-3"
          )}
        >
          <CreateCommandAnalyticsProvider value={{ surface: "landing" }}>
            <CodeBlockCommand
              pnpm="pnpm create tenkit@latest"
              npm="npm create tenkit@latest"
              bun="bun create tenkit@latest"
            />
          </CreateCommandAnalyticsProvider>
          <div
            data-slot="hero-outcomes-panel"
            className="px-3 py-3 sm:px-4 sm:py-4"
          >
            <p
              data-slot="hero-outcomes-title"
              className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase"
            >
              What you get
            </p>
            <ul
              data-slot="hero-outcomes"
              className="mt-3 grid gap-x-8 gap-y-2.5 text-sm text-foreground sm:grid-cols-2"
            >
              {generatedProjectOutcomes.map((outcome) => (
                <li key={outcome} className="flex items-center gap-2">
                  <CheckCircle2Icon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-[#208AEF]"
                  />
                  <span>{outcome}</span>
                </li>
              ))}
            </ul>
          </div>
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
