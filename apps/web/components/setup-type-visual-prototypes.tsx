"use client"

import {
  Building2Icon,
  Code2Icon,
  KeyRoundIcon,
  RouteIcon,
  SmartphoneIcon,
  StoreIcon,
} from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { useRef, type ReactNode, type RefObject } from "react"

import type { SetupTypeStoryId } from "@/components/setup-type-stories-section"
import { AnimatedBeam } from "@/components/ui/animated-beam"
import {
  CircuitBoard,
  type CircuitConnection,
  type CircuitNode,
} from "@/components/ui/circuit-board"
import { cn } from "@/lib/utils"

export type SetupTypeVisualPrototypeId = "topology" | "router" | "artifacts"

type PrototypeProps = {
  setupType: SetupTypeStoryId
}

const setupAccent = {
  "white-label": "#208AEF",
  "runtime-tenants": "#EF8520",
  hybrid: "#2DD4A8",
} satisfies Record<SetupTypeStoryId, string>

const relationshipLabels = {
  "white-label":
    "Shared product code flows into three separate customer App Variants.",
  "runtime-tenants":
    "One installed App Variant opens three Runtime Tenants after sign-in.",
  hybrid:
    "Shared product code flows into a Generic App Variant and a Standalone App Variant.",
} satisfies Record<SetupTypeStoryId, string>

function PrototypeFrame({
  children,
  label,
  className,
}: {
  children: ReactNode
  label: string
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "relative h-96 overflow-hidden rounded-xl border border-background/20 bg-background/[0.09] text-background lg:h-[25.5rem]",
        className
      )}
    >
      {children}
    </div>
  )
}

function topologyGraph(setupType: SetupTypeStoryId): {
  nodes: readonly CircuitNode[]
  connections: readonly CircuitConnection[]
} {
  const accent = setupAccent[setupType]
  const codeIcon = <Code2Icon className="size-4" style={{ color: accent }} />
  const appIcon = (
    <SmartphoneIcon className="size-4" style={{ color: accent }} />
  )
  const tenantIcon = (
    <Building2Icon className="size-4" style={{ color: accent }} />
  )

  if (setupType === "white-label") {
    return {
      nodes: [
        {
          id: "code",
          x: 240,
          y: 56,
          label: "Shared product code",
          caption: "Updated once",
          icon: codeIcon,
          className: "w-36 sm:w-40",
        },
        {
          id: "app-a",
          x: 76,
          y: 270,
          label: "Customer app A",
          caption: "App Variant",
          icon: appIcon,
        },
        {
          id: "app-b",
          x: 240,
          y: 270,
          label: "Customer app B",
          caption: "App Variant",
          icon: appIcon,
        },
        {
          id: "app-next",
          x: 404,
          y: 270,
          label: "Next customer",
          caption: "App Variant",
          icon: appIcon,
        },
      ],
      connections: ["app-a", "app-b", "app-next"].map((to) => ({
        from: "code",
        to,
        color: "currentColor",
        pulseColor: accent,
      })),
    }
  }

  if (setupType === "runtime-tenants") {
    return {
      nodes: [
        {
          id: "app",
          x: 240,
          y: 48,
          label: "One installed app",
          caption: "App Variant",
          icon: appIcon,
          className: "w-36 sm:w-40",
        },
        {
          id: "access",
          x: 240,
          y: 158,
          label: "Runtime access",
          caption: "After sign-in",
          icon: <KeyRoundIcon className="size-4" style={{ color: accent }} />,
          className: "w-32 sm:w-36",
        },
        ...["Location A", "Location B", "Location C"].map((label, index) => ({
          id: `tenant-${index}`,
          x: 76 + index * 164,
          y: 286,
          label,
          caption: "Runtime Tenant",
          icon: tenantIcon,
        })),
      ],
      connections: [
        { from: "app", to: "access", pulseColor: accent },
        ...[0, 1, 2].map((index) => ({
          from: "access",
          to: `tenant-${index}`,
          color: "currentColor",
          pulseColor: accent,
        })),
      ],
    }
  }

  return {
    nodes: [
      {
        id: "code",
        x: 240,
        y: 52,
        label: "Shared product code",
        caption: "Updated once",
        icon: codeIcon,
        className: "w-36 sm:w-40",
      },
      {
        id: "generic",
        x: 135,
        y: 246,
        label: "Generic App Variant",
        caption: "Multiple Runtime Tenants",
        icon: appIcon,
        className: "h-24 w-[8.5rem] sm:w-44",
      },
      {
        id: "standalone",
        x: 345,
        y: 246,
        label: "Standalone App Variant",
        caption: "One fixed Runtime Tenant",
        icon: <StoreIcon className="size-4" style={{ color: accent }} />,
        className: "h-24 w-[8.5rem] sm:w-44",
      },
    ],
    connections: ["generic", "standalone"].map((to) => ({
      from: "code",
      to,
      color: "currentColor",
      pulseColor: accent,
    })),
  }
}

function MobileTopologyNode({
  accent,
  caption,
  icon: Icon,
  label,
}: {
  accent: string
  caption: string
  icon: typeof SmartphoneIcon
  label: string
}) {
  return (
    <div className="relative z-10 flex h-12 items-center gap-3 rounded-lg border border-background/20 bg-foreground px-3 text-background shadow-lg">
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-background/10">
        <Icon className="size-3.5" style={{ color: accent }} />
      </span>
      <span>
        <span className="block text-xs font-medium">{label}</span>
        <span className="block text-[0.625rem] text-background/70">
          {caption}
        </span>
      </span>
    </div>
  )
}

function MobilePulseRail({
  accent,
  centered = false,
}: {
  accent: string
  centered?: boolean
}) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <div
      aria-hidden="true"
      className={cn(
        "absolute top-8 bottom-10 w-px bg-background/30",
        centered ? "left-1/2" : "left-[1.85rem]"
      )}
    >
      {!shouldReduceMotion ? (
        <motion.span
          className="absolute left-1/2 h-12 w-1 -translate-x-1/2 rounded-full"
          style={{
            background: `linear-gradient(to bottom, transparent, ${accent}, transparent)`,
            boxShadow: `0 0 8px ${accent}`,
          }}
          animate={{ top: ["0%", "84%", "0%"] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}
    </div>
  )
}

function MobileTopology({ setupType }: PrototypeProps) {
  const accent = setupAccent[setupType]
  const sourceIcon =
    setupType === "runtime-tenants" ? SmartphoneIcon : Code2Icon
  const sourceLabel =
    setupType === "runtime-tenants"
      ? "One installed app"
      : "Shared product code"
  const sourceCaption =
    setupType === "runtime-tenants" ? "App Variant" : "Updated once"

  const endpointContent: ReadonlyArray<
    readonly [string, string, typeof SmartphoneIcon]
  > =
    setupType === "white-label"
      ? [
          ["Customer app A", "App Variant", SmartphoneIcon],
          ["Customer app B", "App Variant", SmartphoneIcon],
          ["Next customer", "App Variant", SmartphoneIcon],
        ]
      : setupType === "runtime-tenants"
        ? [
            ["Location A", "Runtime Tenant", Building2Icon],
            ["Location B", "Runtime Tenant", Building2Icon],
            ["Location C", "Runtime Tenant", Building2Icon],
          ]
        : [
            ["Generic App Variant", "Multiple Runtime Tenants", SmartphoneIcon],
            ["Standalone App Variant", "One fixed Runtime Tenant", StoreIcon],
          ]

  return (
    <div className="relative size-full p-4 pb-10">
      <MobilePulseRail accent={accent} />
      <div className="relative z-10 space-y-2">
        <MobileTopologyNode
          accent={accent}
          icon={sourceIcon}
          label={sourceLabel}
          caption={sourceCaption}
        />
        {setupType === "runtime-tenants" ? (
          <MobileTopologyNode
            accent={accent}
            icon={KeyRoundIcon}
            label="Runtime access"
            caption="After sign-in"
          />
        ) : null}
        <p className="pl-10 font-mono text-[0.625rem] tracking-[0.12em] text-background/70 uppercase">
          {setupType === "runtime-tenants" ? "Opens" : "Branches to"}
        </p>
        {endpointContent.map(([label, caption, icon]) => (
          <MobileTopologyNode
            key={label}
            accent={accent}
            icon={icon}
            label={label}
            caption={caption}
          />
        ))}
      </div>
    </div>
  )
}

function TopologyPrototype({ setupType }: PrototypeProps) {
  const graph = topologyGraph(setupType)

  return (
    <PrototypeFrame
      label={relationshipLabels[setupType]}
      className="bg-[radial-gradient(circle_at_50%_30%,color-mix(in_oklab,var(--background)_14%,transparent),transparent_62%)]"
    >
      <div className="size-full sm:hidden">
        <MobileTopology setupType={setupType} />
      </div>
      <div className="hidden size-full sm:block">
        <CircuitBoard
          nodes={graph.nodes}
          connections={graph.connections}
          viewBoxHeight={336}
          pulseSpeed={1.9}
          className="h-full"
        />
      </div>
      <p className="absolute inset-x-4 bottom-4 text-center text-xs font-medium text-background/75">
        {setupType === "white-label"
          ? "One source, separately shipped apps"
          : setupType === "runtime-tenants"
            ? "Installed once, opened by access"
            : "Two app structures, one product"}
      </p>
    </PrototypeFrame>
  )
}

const routerContent = {
  "white-label": {
    source: ["Shared code", "One product"],
    router: ["App release", "3 builds"],
    endpoints: [
      ["Customer A", "App Variant", SmartphoneIcon],
      ["Customer B", "App Variant", SmartphoneIcon],
      ["Next customer", "App Variant", SmartphoneIcon],
    ],
  },
  "runtime-tenants": {
    source: ["One app", "App Variant"],
    router: ["Access", "After sign-in"],
    endpoints: [
      ["Location A", "Runtime Tenant", Building2Icon],
      ["Location B", "Runtime Tenant", Building2Icon],
      ["Location C", "Runtime Tenant", Building2Icon],
    ],
  },
  hybrid: {
    source: ["Shared code", "One product"],
    router: ["Setup model", "Two paths"],
    endpoints: [
      ["Shared network", "Generic App Variant", SmartphoneIcon],
      ["Partner app", "Standalone App Variant", StoreIcon],
    ],
  },
} as const

function RouterNode({
  nodeRef,
  icon,
  label,
  caption,
  className,
  accent,
}: {
  nodeRef: RefObject<HTMLDivElement | null>
  icon: typeof SmartphoneIcon
  label: string
  caption: string
  className?: string
  accent: string
}) {
  const Icon = icon

  return (
    <div
      ref={nodeRef}
      className={cn(
        "absolute z-10 flex h-16 w-24 items-center gap-2 rounded-lg border border-background/20 bg-foreground px-2.5 text-background shadow-lg",
        className
      )}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-background/10">
        <Icon className="size-3.5" style={{ color: accent }} />
      </span>
      <span className="min-w-0">
        <span className="block text-xs leading-4 font-medium">{label}</span>
        <span className="block text-[0.625rem] leading-3 text-background/70">
          {caption}
        </span>
      </span>
    </div>
  )
}

function MobileRouter({ setupType }: PrototypeProps) {
  const accent = setupAccent[setupType]
  const content = routerContent[setupType]

  return (
    <div className="relative size-full p-4 pb-10">
      <MobilePulseRail accent={accent} centered />
      <div className="relative z-10 space-y-2">
        <MobileTopologyNode
          accent={accent}
          icon={setupType === "runtime-tenants" ? SmartphoneIcon : Code2Icon}
          label={content.source[0]}
          caption={content.source[1]}
        />
        <div className="flex justify-center py-1">
          <div className="flex h-14 w-40 items-center justify-center gap-2 rounded-full border border-background/25 bg-foreground px-3 text-background shadow-xl">
            <RouteIcon className="size-4 shrink-0" style={{ color: accent }} />
            <span>
              <span className="block text-xs font-medium">
                {content.router[0]}
              </span>
              <span className="block text-[0.625rem] text-background/70">
                {content.router[1]}
              </span>
            </span>
          </div>
        </div>
        <p className="text-center font-mono text-[0.625rem] tracking-[0.12em] text-background/70 uppercase">
          Customer gets
        </p>
        {content.endpoints.map(([label, caption, icon]) => (
          <MobileTopologyNode
            key={label}
            accent={accent}
            icon={icon}
            label={label}
            caption={caption}
          />
        ))}
      </div>
    </div>
  )
}

function RouterPrototype({ setupType }: PrototypeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sourceRef = useRef<HTMLDivElement>(null)
  const routerRef = useRef<HTMLDivElement>(null)
  const outputOneRef = useRef<HTMLDivElement>(null)
  const outputTwoRef = useRef<HTMLDivElement>(null)
  const outputThreeRef = useRef<HTMLDivElement>(null)
  const outputRefs = [outputOneRef, outputTwoRef, outputThreeRef] as const
  const content = routerContent[setupType]
  const accent = setupAccent[setupType]

  return (
    <PrototypeFrame label={relationshipLabels[setupType]}>
      <div className="size-full sm:hidden">
        <MobileRouter setupType={setupType} />
      </div>
      <div
        ref={containerRef}
        className="relative hidden size-full bg-[linear-gradient(to_right,color-mix(in_oklab,var(--background)_9%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--background)_9%,transparent)_1px,transparent_1px)] bg-[size:24px_24px] sm:block"
      >
        <div className="absolute inset-x-0 top-3 z-20 grid grid-cols-3 px-5 font-mono text-[0.625rem] tracking-[0.12em] text-background/70 uppercase">
          <span>Starts with</span>
          <span className="text-center">Tenkit routes</span>
          <span className="text-right">Customer gets</span>
        </div>
        <RouterNode
          nodeRef={sourceRef}
          icon={setupType === "runtime-tenants" ? SmartphoneIcon : Code2Icon}
          label={content.source[0]}
          caption={content.source[1]}
          accent={accent}
          className="top-1/2 left-3 -translate-y-1/2 sm:left-5"
        />

        <div
          ref={routerRef}
          className="absolute top-1/2 left-1/2 z-10 grid size-20 -translate-1/2 place-items-center rounded-full border border-background/25 bg-foreground text-center text-background shadow-xl"
        >
          <span>
            <RouteIcon className="mx-auto size-4" style={{ color: accent }} />
            <span className="mt-1 block text-xs font-medium">
              {content.router[0]}
            </span>
            <span className="block text-[0.625rem] text-background/70">
              {content.router[1]}
            </span>
          </span>
        </div>

        {content.endpoints.map((endpoint, index) => {
          const [label, caption, icon] = endpoint
          const position =
            content.endpoints.length === 2
              ? index === 0
                ? "top-[27%]"
                : "bottom-[27%]"
              : index === 0
                ? "top-10"
                : index === 1
                  ? "top-1/2 -translate-y-1/2"
                  : "bottom-8"

          return (
            <RouterNode
              key={label}
              nodeRef={outputRefs[index]}
              icon={icon}
              label={label}
              caption={caption}
              accent={accent}
              className={cn("right-3 sm:right-5", position)}
            />
          )
        })}

        <AnimatedBeam
          containerRef={containerRef}
          fromRef={sourceRef}
          toRef={routerRef}
          beamColor={accent}
          duration={2.4}
          className="text-background"
        />
        {content.endpoints.map((endpoint, index) => (
          <AnimatedBeam
            key={endpoint[0]}
            containerRef={containerRef}
            fromRef={routerRef}
            toRef={outputRefs[index]}
            curvature={(index - (content.endpoints.length - 1) / 2) * -24}
            beamColor={accent}
            duration={2.1 + index * 0.25}
            className="text-background"
          />
        ))}

        <p className="absolute inset-x-4 bottom-3 text-center text-xs font-medium text-background/75">
          {setupType === "runtime-tenants"
            ? "Access decides what opens inside the app"
            : "The setup model routes one product into the right app structure"}
        </p>
      </div>
    </PrototypeFrame>
  )
}

function ReleaseStrip({ accent }: { accent: string }) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <div className="relative flex h-16 items-center gap-3 overflow-hidden rounded-lg border border-background/20 bg-foreground px-4 text-background shadow-lg">
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-background/10">
        <Code2Icon className="size-4" style={{ color: accent }} />
      </span>
      <span>
        <span className="block text-sm font-medium">One product update</span>
        <span className="block text-xs text-background/70">
          Shared product code
        </span>
      </span>
      {!shouldReduceMotion ? (
        <motion.span
          aria-hidden="true"
          className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-background/18 to-transparent"
          initial={{ left: "-20%" }}
          animate={{ left: "110%" }}
          transition={{ duration: 3.8, repeat: Infinity, ease: "linear" }}
        />
      ) : null}
    </div>
  )
}

function ArtifactCard({
  icon,
  title,
  caption,
  facts,
  accent,
  className,
}: {
  icon: typeof SmartphoneIcon
  title: string
  caption: string
  facts: readonly string[]
  accent: string
  className?: string
}) {
  const Icon = icon

  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-2 rounded-lg border border-foreground/15 bg-background p-2 text-foreground shadow-lg sm:flex sm:flex-col sm:items-stretch sm:p-3",
        className
      )}
    >
      <span className="grid size-8 place-items-center rounded-md bg-foreground/8">
        <Icon className="size-4" style={{ color: accent }} />
      </span>
      <div className="min-w-0 sm:mt-3">
        <p className="text-xs leading-4 font-medium">{title}</p>
        <p className="mt-0.5 text-[0.625rem] leading-4 text-foreground/70">
          {caption}
        </p>
      </div>
      <div className="col-span-2 mt-2 grid grid-cols-2 gap-1.5 border-t border-foreground/10 pt-2 sm:mt-3 sm:block sm:space-y-1.5 sm:pt-3">
        {facts.map((fact) => (
          <div
            key={fact}
            className="rounded-md bg-foreground/[0.055] px-2 py-1.5 text-[0.625rem] leading-4 text-foreground/75"
          >
            {fact}
          </div>
        ))}
      </div>
    </div>
  )
}

function WhiteLabelArtifacts({ accent }: { accent: string }) {
  return (
    <div className="grid size-full grid-rows-[4rem_1fr] gap-3 p-3 sm:gap-5 sm:p-5">
      <ReleaseStrip accent={accent} />
      <div className="grid grid-rows-3 gap-2 sm:grid-cols-3 sm:grid-rows-none sm:gap-3">
        {[
          {
            title: "Customer A app",
            caption: "App Variant",
            facts: ["Own name + icon", "Own store listing"],
          },
          {
            title: "Customer B app",
            caption: "App Variant",
            facts: ["Own name + icon", "Own store listing"],
          },
          {
            title: "Next customer",
            caption: "New App Variant",
            facts: ["Define identity", "Ship separately"],
          },
        ].map(({ title, caption, facts }) => (
          <ArtifactCard
            key={title}
            icon={SmartphoneIcon}
            title={title}
            caption={caption}
            facts={facts}
            accent={accent}
          />
        ))}
      </div>
    </div>
  )
}

function RuntimeArtifacts({ accent }: { accent: string }) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <div className="size-full p-5">
      <div className="mx-auto flex h-full max-w-sm flex-col rounded-lg border border-foreground/15 bg-background p-4 text-foreground shadow-xl">
        <div className="flex items-center gap-3 border-b border-foreground/10 pb-4">
          <span className="grid size-10 place-items-center rounded-md bg-foreground text-background">
            <SmartphoneIcon className="size-4" style={{ color: accent }} />
          </span>
          <span>
            <span className="block text-sm font-medium">Coworking app</span>
            <span className="block text-xs text-foreground/70">
              One App Variant · installed once
            </span>
          </span>
        </div>

        <p className="mt-5 text-xs font-medium text-foreground/75">
          Available after sign-in
        </p>
        <div className="relative mt-2 overflow-hidden rounded-md border border-foreground/10">
          {!shouldReduceMotion ? (
            <motion.span
              aria-hidden="true"
              className="absolute left-0 z-10 h-1/3 w-1"
              style={{ backgroundColor: accent }}
              animate={{ top: ["0%", "33.333%", "66.666%", "0%"] }}
              transition={{
                duration: 5.4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ) : null}
          {["Location A", "Location B", "Location C"].map((location) => (
            <div
              key={location}
              className="flex h-14 items-center justify-between border-b border-foreground/10 px-4 last:border-b-0"
            >
              <span className="text-sm font-medium">{location}</span>
              <span className="text-xs text-foreground/70">Runtime Tenant</span>
            </div>
          ))}
        </div>
        <p className="mt-auto text-xs leading-5 text-foreground/75">
          Members open only the locations they can access.
        </p>
      </div>
    </div>
  )
}

function HybridArtifacts({ accent }: { accent: string }) {
  return (
    <div className="grid size-full grid-rows-[4rem_1fr] gap-3 p-3 sm:gap-5 sm:p-5">
      <ReleaseStrip accent={accent} />
      <div className="grid grid-rows-2 gap-2 sm:grid-cols-2 sm:grid-rows-none sm:gap-3">
        <ArtifactCard
          icon={SmartphoneIcon}
          title="Shared network app"
          caption="Generic App Variant"
          facts={["Location A + B", "Add more at runtime"]}
          accent={accent}
        />
        <ArtifactCard
          icon={StoreIcon}
          title="Flagship partner app"
          caption="Standalone App Variant"
          facts={["One fixed partner", "Own native identity"]}
          accent={accent}
        />
      </div>
    </div>
  )
}

function ArtifactsPrototype({ setupType }: PrototypeProps) {
  const accent = setupAccent[setupType]

  return (
    <PrototypeFrame label={relationshipLabels[setupType]}>
      {setupType === "white-label" ? (
        <WhiteLabelArtifacts accent={accent} />
      ) : setupType === "runtime-tenants" ? (
        <RuntimeArtifacts accent={accent} />
      ) : (
        <HybridArtifacts accent={accent} />
      )}
    </PrototypeFrame>
  )
}

export function SetupTypeVisualPrototype({
  setupType,
  variant,
}: {
  setupType: SetupTypeStoryId
  variant: SetupTypeVisualPrototypeId
}) {
  if (variant === "topology") {
    return <TopologyPrototype setupType={setupType} />
  }

  if (variant === "router") {
    return <RouterPrototype setupType={setupType} />
  }

  return <ArtifactsPrototype setupType={setupType} />
}
