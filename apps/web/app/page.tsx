import {
  ArrowRightIcon,
  CheckIcon,
  ClipboardCheckIcon,
  CompassIcon,
  FileCodeIcon,
  PackageCheckIcon,
  SmartphoneIcon,
  TerminalIcon,
} from "lucide-react"
import dynamic from "next/dynamic"

import { FullWidthDivider } from "@/components/full-width-divider"
import { GitHubMark } from "@/components/github-mark"
import { HeroSection } from "@/components/hero"
import { JsonLdScript } from "@/components/json-ld-script"
import { ProofSection } from "@/components/proof-section"
import { FaqAccordion } from "@/components/faq-accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GITHUB_REPO_URL } from "@/constants/globals"
import { FAQ_ITEMS, SETUP_TYPES } from "@/constants/landing"
import { getLandingJsonLdGraph } from "@/lib/seo"
import { cn } from "@/lib/utils"

const FluidGradientText = dynamic(() =>
  import("@/components/fluid-gradient-text").then(
    (module) => module.FluidGradientText
  )
)

const GlowingCard = dynamic(() =>
  import("@/components/glowing-card").then((module) => module.GlowingCard)
)

const SetupModelFlow = dynamic(() =>
  import("@/components/setup-model-preview").then(
    (module) => module.SetupModelFlow
  )
)

const SetupModelPreview = dynamic(() =>
  import("@/components/setup-model-preview").then(
    (module) => module.SetupModelPreview
  )
)

const OrbitingCircles = dynamic(() =>
  import("@/components/ui/orbiting-circles").then(
    (module) => module.OrbitingCircles
  )
)

const setupVisuals = [
  {
    accentText: "text-[#208AEF]",
    accentBg: "bg-[#208AEF]/10",
    accentBorder: "border-[#208AEF]/25",
  },
  {
    accentText: "text-[#EF8520]",
    accentBg: "bg-[#EF8520]/10",
    accentBorder: "border-[#EF8520]/25",
  },
  {
    accentText: "text-[#2DD4A8]",
    accentBg: "bg-[#2DD4A8]/10",
    accentBorder: "border-[#2DD4A8]/25",
  },
] as const

const guidanceCards = [
  {
    title: "Starter project",
    body: "A typed Expo app scaffold with setup data, README commands, and starter values kept easy to replace.",
    eyebrow: "Project",
    icon: PackageCheckIcon,
    className:
      "min-h-80 bg-foreground text-background md:col-span-3 md:row-span-4 lg:col-span-6 lg:row-span-4",
  },
  {
    title: "Launchers",
    body: "The package manager you start with carries into install commands and generated next steps.",
    eyebrow: "Commands",
    icon: TerminalIcon,
    className:
      "min-h-44 bg-card/70 md:col-span-3 md:row-span-2 lg:col-span-3 lg:row-span-2",
  },
  {
    title: "EAS connection",
    body: "Expo owner, EAS project IDs, and build environments are named directly.",
    eyebrow: "Services",
    icon: ClipboardCheckIcon,
    className:
      "min-h-44 bg-card/70 md:col-span-3 md:row-span-2 lg:col-span-3 lg:row-span-2",
  },
  {
    title: "Editable setup files",
    body: "App Variants, Runtime Tenants, access rules, identifiers, and themes live in TypeScript.",
    eyebrow: "Reviewable",
    icon: FileCodeIcon,
    className:
      "min-h-52 bg-card/70 md:col-span-3 md:row-span-2 lg:col-span-6 lg:row-span-2",
  },
  {
    title: "Native identity",
    body: "Names, slugs, schemes, bundle IDs, package names, icons, splash assets, and colors are grouped together.",
    eyebrow: "Native app",
    icon: SmartphoneIcon,
    className:
      "min-h-52 bg-card/70 md:col-span-3 md:row-span-2 lg:col-span-5 lg:row-span-2",
  },
  {
    title: "Product context",
    body: "Runtime Tenant data gives backend, billing, admin, and control-panel work a concrete model to use.",
    eyebrow: "Runtime",
    icon: CompassIcon,
    className:
      "min-h-52 bg-card/70 md:col-span-6 md:row-span-2 lg:col-span-7 lg:row-span-2",
  },
] as const

const projectOrbitIcons = [
  TerminalIcon,
  FileCodeIcon,
  SmartphoneIcon,
  ClipboardCheckIcon,
] as const

function SectionBoundary() {
  return <FullWidthDivider position="bottom" />
}

function SectionIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[0.74fr_1fr] lg:items-end">
      <div>
        <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
          {eyebrow}
        </p>
        <h2 className="mt-3 font-heading text-3xl font-semibold tracking-normal text-balance sm:text-4xl">
          {title}
        </h2>
      </div>
      <p className="max-w-2xl text-base leading-7 text-muted-foreground lg:justify-self-end">
        {description}
      </p>
    </div>
  )
}

function SetupTypesSection() {
  return (
    <section
      id="setup-types"
      className="relative scroll-mt-24 px-4 py-16 sm:px-8 sm:py-24"
    >
      <div className="flex flex-col gap-10">
        <SectionIntro
          eyebrow="Setup types"
          title="Three distribution models, shown as native app shapes."
          description="Pick the relationship between App Variants and Runtime Tenants first. Tenkit turns that choice into generated files instead of a copied app."
        />

        <div className="grid gap-4 min-[1120px]:grid-cols-3">
          {SETUP_TYPES.map((setup, index) => {
            const visual = setupVisuals[index]

            return (
              <article
                key={setup.slug}
                className={cn(
                  "group relative flex min-h-152 flex-col overflow-hidden rounded-lg border bg-card/70 shadow-sm transition-colors duration-300",
                  "hover:bg-card"
                )}
              >
                <div className="relative h-72 overflow-hidden border-b bg-[#07090d]">
                  <SetupModelPreview index={index} />
                  <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-card" />
                </div>

                <div className="relative z-10 flex flex-1 flex-col gap-5 p-5">
                  <div className="lg:min-h-52">
                    <div className="flex items-center justify-between gap-3">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "border font-mono",
                          visual.accentBorder,
                          visual.accentBg,
                          visual.accentText
                        )}
                      >
                        {setup.eyebrow}
                      </Badge>
                      <span className="font-mono text-xs text-muted-foreground">
                        0{index + 1}
                      </span>
                    </div>
                    <h3 className="mt-5 font-heading text-2xl font-semibold tracking-normal text-balance">
                      {setup.label}
                    </h3>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {setup.headline}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {setup.description}
                    </p>
                  </div>

                  <SetupModelFlow index={index} />

                  <ul className="mt-auto grid gap-2 border-t pt-4">
                    {setup.examples.map((example) => (
                      <li
                        key={example}
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <span
                          className={cn(
                            "grid size-5 shrink-0 place-items-center rounded-full",
                            visual.accentBg,
                            visual.accentText
                          )}
                        >
                          <CheckIcon className="size-3" aria-hidden="true" />
                        </span>
                        <span>{example}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            )
          })}
        </div>
      </div>
      <SectionBoundary />
    </section>
  )
}

function ProjectOrbitGraphic() {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute top-7 right-7 hidden size-80 items-center justify-center opacity-70 transition-opacity duration-300 md:flex",
        "group-hover:opacity-100 motion-reduce:transition-none"
      )}
    >
      <div className="absolute size-[204px] rounded-full border border-background/10" />
      <div className="absolute size-[302px] rounded-full border border-background/8" />
      <div className="absolute size-36 rounded-full border border-background/10 bg-background/5" />
      <div className="absolute grid size-18 place-items-center rounded-full border border-background/15 bg-background/10 text-background/80 shadow-sm">
        <PackageCheckIcon className="size-6" />
      </div>

      <OrbitingCircles
        orbitPath="hidden"
        radius={102}
        duration={18}
        iconSize={42}
        className="border border-background/15 bg-background text-foreground shadow-sm"
      >
        {projectOrbitIcons.map((Icon) => (
          <Icon key={Icon.displayName ?? Icon.name} className="size-4" />
        ))}
      </OrbitingCircles>

      <OrbitingCircles
        direction="counterclockwise"
        orbitPath="hidden"
        radius={151}
        duration={26}
        iconSize={32}
        className="border border-background/10 bg-background text-foreground shadow-sm"
      >
        <span className="size-1.5 rounded-full bg-[#208AEF]" />
        <span className="size-1.5 rounded-full bg-[#2DD4A8]" />
        <span className="size-1.5 rounded-full bg-[#EF8520]" />
      </OrbitingCircles>
    </div>
  )
}

function BuildGuidanceBento() {
  return (
    <section
      id="generated"
      className="relative scroll-mt-24 px-4 py-16 sm:px-8 sm:py-24"
    >
      <div className="flex flex-col gap-10">
        <SectionIntro
          eyebrow="What gets generated"
          title="A starter project, plus a map for the real production values."
          description="Tenkit gets the app shape into code. The useful next step is deciding which Expo, EAS, native identity, and product-context values replace the starter data."
        />

        <div className="grid gap-4 md:auto-rows-[8rem] md:grid-cols-6 lg:grid-cols-12">
          {guidanceCards.map((item, index) => {
            const isProject = index === 0
            const Icon = item.icon

            return (
              <GlowingCard
                as="article"
                key={item.title}
                className={cn(
                  "group rounded-lg border shadow-sm",
                  item.className
                )}
                backgroundClassName={isProject ? "bg-foreground" : "bg-card/95"}
                contentClassName="flex size-full flex-col p-6 sm:p-7"
                glowClassName={
                  isProject ? "bg-[#208AEF]/20" : "bg-[#208AEF]/35"
                }
              >
                {isProject ? <ProjectOrbitGraphic /> : null}

                <div
                  className={cn(
                    "flex items-center gap-3",
                    isProject ? "text-background/65" : "text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-md border",
                      isProject
                        ? "border-background/15 bg-background/10"
                        : "bg-muted/45 text-foreground"
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <p className="font-mono text-xs tracking-[0.14em] uppercase">
                    {item.eyebrow}
                  </p>
                </div>

                <div
                  className={cn(
                    "max-w-lg",
                    isProject
                      ? "mt-auto pt-28"
                      : index >= 3
                        ? "mt-auto"
                        : "mt-12"
                  )}
                >
                  <h3
                    className={cn(
                      "font-heading font-semibold tracking-normal text-balance",
                      isProject ? "text-3xl sm:text-4xl" : "text-xl"
                    )}
                  >
                    {item.title}
                  </h3>
                  <p
                    className={cn(
                      "mt-3 text-sm leading-6",
                      isProject ? "text-background/70" : "text-muted-foreground"
                    )}
                  >
                    {item.body}
                  </p>
                </div>
              </GlowingCard>
            )
          })}
        </div>
      </div>
      <SectionBoundary />
    </section>
  )
}

function FaqSection() {
  return (
    <section
      id="faq"
      className="relative scroll-mt-24 px-4 py-16 sm:px-8 sm:py-24"
    >
      <div className="grid gap-10 lg:grid-cols-[0.78fr_1fr] lg:gap-14">
        <div>
          <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
            FAQ
          </p>
          <h2 className="mt-3 font-heading text-3xl font-semibold tracking-normal text-balance sm:text-4xl">
            Clear boundaries make the starter easier to trust.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Tenkit is focused on Expo app generation, native identity, setup
            data, and Build Preparation.
          </p>
        </div>

        <FaqAccordion items={FAQ_ITEMS} />
      </div>
      <SectionBoundary />
    </section>
  )
}

function SixFooter() {
  return (
    <footer className="relative overflow-hidden px-4 sm:px-8">
      <div className="relative z-10 grid gap-12 pt-20 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="max-w-2xl">
          <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
            Ready to inspect it
          </p>
          <h2 className="mt-3 font-heading text-3xl font-semibold tracking-normal text-balance sm:text-5xl">
            Generate a real Expo project and read the setup files.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Start with the create command, choose a Setup Type, then replace the
            starter identities with your own App Variants and Runtime Tenants.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
                <GitHubMark data-icon="inline-start" />
                Star on GitHub
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#commands">
                <TerminalIcon data-icon="inline-start" />
                Copy create command
                <ArrowRightIcon data-icon="inline-end" />
              </a>
            </Button>
          </div>
        </div>
      </div>
      <FluidGradientText text="tenkit" svgViewBoxWidth={1000} />
    </footer>
  )
}

export default function Page() {
  return (
    <>
      <JsonLdScript graph={getLandingJsonLdGraph()} id="tenkit-json-ld" />
      <main className="relative flex min-h-screen flex-col overflow-hidden supports-[overflow:clip]:overflow-clip">
        <div className="relative mx-auto w-[calc(100%-2rem)] max-w-6xl grow">
          <HeroSection />
          <ProofSection />
          <SetupTypesSection />
          <BuildGuidanceBento />
          <FaqSection />
          <SixFooter />
        </div>
      </main>
    </>
  )
}
