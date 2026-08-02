"use client"

import {
  BoxesIcon,
  CheckIcon,
  CopyXIcon,
  GitForkIcon,
  Layers3Icon,
} from "lucide-react"
import { useState } from "react"

import { ConfiguratorCodeResponsiveIconChoiceCard } from "@/components/configurator-choice-card"
import { FullWidthDivider } from "@/components/full-width-divider"
import { GlowingCard } from "@/components/glowing-card"
import { SetupTypeGeneratedTree } from "@/components/setup-type-generated-tree"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const setupTypeStories = [
  {
    id: "white-label",
    setupType: "White Label Apps",
    choiceLabel: "White Label Apps",
    choiceDetail: "A branded app per customer",
    exampleLabel: "Example: booking software for gyms",
    headline: "Give every customer their own app without copying your product.",
    situation:
      "Each gym gets its own name, icon, colors, store listing, and native identity. Your team still maintains one product.",
    pain: "Clone the project for each customer, then repeat every feature and dependency update.",
    tenkitChange:
      "Keep one codebase. Define every customer app as its own App Variant.",
    outcome: "Add the next branded app without creating another codebase.",
    visualTitle: ["One codebase", "Separate customer apps"],
    visualSummary:
      "Generate each customer's native app identity without duplicating the product.",
    accent: "blue",
  },
  {
    id: "runtime-tenants",
    setupType: "Single App Runtime Tenants",
    choiceLabel: "Single App Runtime Tenants",
    choiceDetail: "One app, many businesses",
    exampleLabel: "Example: coworking app",
    headline: "One app for every location.",
    situation:
      "Members install one app, sign in, and open only the coworking locations they can access.",
    pain: "Mix app identity with location data, and one-off checks spread through the product.",
    tenkitChange:
      "Keep one App Variant. Model every location as a Runtime Tenant with explicit access rules.",
    outcome: "Add a location without publishing another app.",
    visualTitle: ["One app", "Multiple locations"],
    visualSummary:
      "Let users open the locations they can access without publishing another app.",
    accent: "orange",
  },
  {
    id: "hybrid",
    setupType: "Generic With Standalone App Variants",
    choiceLabel: "Generic + Standalone Apps",
    choiceDetail: "Shared app plus partner apps",
    exampleLabel: "Example: fitness network",
    headline:
      "Keep most partners in one app. Give selected partners their own.",
    situation:
      "Most gyms open inside the shared network app. A flagship partner can still get its own store listing and native identity.",
    pain: "Force every partner into the shared app, or fork the product when one needs its own.",
    tenkitChange:
      "Keep most Runtime Tenants in the Generic App Variant. Tie selected partners to Standalone App Variants.",
    outcome: "Support both without splitting the product.",
    visualTitle: ["One shared app", "Standalone partner apps"],
    visualSummary:
      "Keep most partners in the shared app and give selected partners their own native app.",
    accent: "mint",
  },
] as const

type SetupTypeStory = (typeof setupTypeStories)[number]

export type SetupTypeStoryId = SetupTypeStory["id"]

const setupTypeStoryIcons = {
  "white-label": Layers3Icon,
  "runtime-tenants": BoxesIcon,
  hybrid: GitForkIcon,
} satisfies Record<SetupTypeStory["id"], typeof Layers3Icon>

const setupTypeStoryAccentStyles = {
  blue: {
    text: "text-[#208AEF]",
    bg: "bg-[#208AEF]/10",
    border: "border-[#208AEF]/25",
    glow: "bg-[#208AEF]/35",
  },
  orange: {
    text: "text-[#EF8520]",
    bg: "bg-[#EF8520]/10",
    border: "border-[#EF8520]/25",
    glow: "bg-[#EF8520]/35",
  },
  mint: {
    text: "text-[#2DD4A8]",
    bg: "bg-[#2DD4A8]/10",
    border: "border-[#2DD4A8]/25",
    glow: "bg-[#2DD4A8]/35",
  },
} as const

function SetupTypeStoryPanel({ story }: { story: SetupTypeStory }) {
  const accentStyles = setupTypeStoryAccentStyles[story.accent]

  return (
    <article className="flex h-full flex-col rounded-xl border bg-card p-5 shadow-sm sm:p-7">
      <div className="lg:h-[17rem]">
        <p className="font-mono text-[0.6875rem] tracking-[0.14em] text-muted-foreground uppercase">
          {story.setupType}
        </p>
        <Badge
          variant="secondary"
          className={cn(
            "mt-3",
            accentStyles.border,
            accentStyles.bg,
            accentStyles.text
          )}
        >
          {story.exampleLabel}
        </Badge>
        <h3 className="mt-5 max-w-2xl font-heading text-3xl leading-tight font-semibold tracking-normal text-balance sm:text-[2.15rem]">
          {story.headline}
        </h3>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
          {story.situation}
        </p>
      </div>

      <div className="mt-7 grid items-stretch gap-3 sm:grid-cols-2 lg:h-36">
        <div className="h-full rounded-lg border border-destructive/15 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-destructive-foreground">
            <CopyXIcon className="size-4" aria-hidden="true" />
            Without Tenkit
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {story.pain}
          </p>
        </div>
        <div
          className={cn(
            "h-full rounded-lg border p-4",
            accentStyles.border,
            accentStyles.bg
          )}
        >
          <div
            className={cn(
              "flex items-center gap-2 text-xs font-medium",
              accentStyles.text
            )}
          >
            <CheckIcon className="size-4" aria-hidden="true" />
            With Tenkit
          </div>
          <p className="mt-3 text-sm leading-6">{story.tenkitChange}</p>
        </div>
      </div>

      <div className="mt-6 border-t pt-5 lg:mt-auto">
        <p className="font-mono text-[0.625rem] tracking-[0.14em] text-muted-foreground uppercase">
          Result
        </p>
        <p className="max-w-lg text-base leading-7 font-medium">
          {story.outcome}
        </p>
      </div>
    </article>
  )
}

function SetupTypeDistributionCard({ story }: { story: SetupTypeStory }) {
  const accentStyles = setupTypeStoryAccentStyles[story.accent]
  const SetupTypeIcon = setupTypeStoryIcons[story.id]

  return (
    <GlowingCard
      as="article"
      data-slot="setup-type-distribution-card"
      className="group h-full animate-in rounded-xl border border-background/10 bg-foreground text-background shadow-sm duration-300 fade-in zoom-in-98"
      backgroundClassName="rounded-[calc(var(--radius-xl)-1px)] bg-foreground"
      contentClassName="flex h-full flex-col p-5 sm:p-7"
      glowClassName={accentStyles.glow}
    >
      <div className="relative">
        <div className="pr-14 sm:pr-16">
          <p className="font-mono text-[0.6875rem] tracking-[0.14em] text-background/70 uppercase">
            Generated setup
          </p>
          <h3
            aria-label={story.visualTitle.join(" ")}
            className="mt-2 max-w-sm font-heading text-lg leading-tight font-semibold tracking-normal sm:text-2xl"
          >
            {story.visualTitle.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h3>
          <p className="mt-3 max-w-sm text-sm leading-6 text-background/75">
            {story.visualSummary}
          </p>
        </div>
        <span
          className={cn(
            "absolute top-0 right-0 grid size-11 place-items-center rounded-full",
            accentStyles.bg,
            accentStyles.text
          )}
        >
          <SetupTypeIcon className="size-4" aria-hidden="true" />
        </span>
      </div>

      <div className="mt-6">
        <SetupTypeGeneratedTree setupType={story.id} />
      </div>
    </GlowingCard>
  )
}

export function SetupTypeStoriesSection() {
  const [selectedStoryId, setSelectedStoryId] = useState<SetupTypeStory["id"]>(
    setupTypeStories[0].id
  )
  const selectedStory =
    setupTypeStories.find((story) => story.id === selectedStoryId) ??
    setupTypeStories[0]

  return (
    <section
      id="setup-types"
      className="relative scroll-mt-24 px-4 py-16 sm:px-8 sm:py-24"
    >
      <div className="flex flex-col gap-10">
        <div className="max-w-3xl">
          <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
            Setup Types
          </p>
          <h2
            aria-label="Different customer experiences One product to maintain"
            className="mt-3 font-heading text-3xl font-semibold tracking-normal sm:text-5xl"
          >
            <span className="block">Different customer experiences</span>
            <span className="block">One product to maintain</span>
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            See how Tenkit supports branded customer apps, multiple businesses
            inside one app, or both without forking the codebase.
          </p>
        </div>

        <div className="grid items-stretch gap-3 lg:grid-cols-3">
          {setupTypeStories.map((story) => {
            const SetupTypeIcon = setupTypeStoryIcons[story.id]

            return (
              <ConfiguratorCodeResponsiveIconChoiceCard
                key={story.id}
                selected={selectedStory.id === story.id}
                onSelect={() => setSelectedStoryId(story.id)}
                label={story.choiceLabel}
                detail={story.choiceDetail}
                icon={<SetupTypeIcon className="size-4" aria-hidden="true" />}
              />
            )
          })}
        </div>

        <div
          data-slot="setup-type-story-shell"
          className="grid items-stretch gap-4 lg:h-[37rem] lg:grid-cols-2"
        >
          <SetupTypeStoryPanel story={selectedStory} />
          <SetupTypeDistributionCard
            key={selectedStory.id}
            story={selectedStory}
          />
        </div>
      </div>
      <FullWidthDivider position="bottom" />
    </section>
  )
}
