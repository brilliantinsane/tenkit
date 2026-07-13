import { ArrowRightIcon, TerminalIcon } from "lucide-react"
import dynamic from "next/dynamic"

import { GitHubMark } from "@/components/github-mark"
import { Button } from "@/components/ui/button"
import { GITHUB_REPO_URL } from "@/constants/globals"

const FluidGradientText = dynamic(() =>
  import("@/components/fluid-gradient-text").then(
    (module) => module.FluidGradientText
  )
)

export function SiteFooter({ commandHref }: { commandHref: string }) {
  return (
    <footer className="relative overflow-hidden px-4 sm:px-8">
      <div className="relative z-10 grid gap-12 pt-20 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="max-w-2xl">
          <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
            Ready to inspect it
          </p>
          <h2 className="mt-3 font-heading text-3xl font-semibold tracking-normal text-balance sm:text-5xl">
            Generate a real project built with Expo and read the setup files.
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
              <a href={commandHref}>
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
