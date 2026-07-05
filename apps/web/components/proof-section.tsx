import {
  BlocksIcon,
  BoxesIcon,
  Code2Icon,
  GitForkIcon,
  Layers3Icon,
  PackageCheckIcon,
} from "lucide-react"

import { FullWidthDivider } from "@/components/full-width-divider"
import { GlowingCard } from "@/components/glowing-card"

const proofItems = [
  {
    label: "Open source",
    detail: "MIT repo",
    icon: GitForkIcon,
  },
  {
    label: "Expo SDK 56",
    detail: "native-ready",
    icon: BlocksIcon,
  },
  {
    label: "TypeScript",
    detail: "typed setup data",
    icon: Code2Icon,
  },
  {
    label: "pnpm, npm, Bun",
    detail: "launcher-aware",
    icon: PackageCheckIcon,
  },
  {
    label: "App Variants",
    detail: "build identity",
    icon: Layers3Icon,
  },
  {
    label: "Runtime Tenants",
    detail: "runtime context",
    icon: BoxesIcon,
  },
]

export function ProofSection() {
  return (
    <section
      id="proof"
      className="relative scroll-mt-24 px-4 py-12 sm:px-8 sm:py-16"
    >
      <div className="flex flex-col gap-8">
        <div className="grid gap-3 text-center sm:text-left lg:grid-cols-[0.74fr_1fr] lg:items-end">
          <div>
            <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
              Proof points
            </p>
            <h2 className="mt-3 font-heading text-2xl font-semibold tracking-normal text-balance sm:text-3xl">
              The create flow is backed by real Expo setup primitives.
            </h2>
          </div>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7 lg:justify-self-end">
            Tenkit keeps the difference between native identity and runtime
            business context explicit, so teams can review the generated app
            shape before shipping it.
          </p>
        </div>

        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {proofItems.map((item) => (
            <GlowingCard
              as="li"
              key={item.label}
              className="min-h-32 rounded-lg border bg-card/65 text-center shadow-sm"
              contentClassName="grid h-full place-items-center p-5"
            >
              <span className="flex min-h-20 flex-col items-center justify-center gap-3">
                <span className="grid size-10 place-items-center rounded-full border bg-muted/45 text-foreground transition-colors">
                  <item.icon className="size-4" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-medium">
                    {item.label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {item.detail}
                  </span>
                </span>
              </span>
            </GlowingCard>
          ))}
        </ul>
      </div>

      <FullWidthDivider position="bottom" />
    </section>
  )
}
