"use client"

import {
  Building2Icon,
  Code2Icon,
  MapPinIcon,
  SmartphoneIcon,
  StoreIcon,
  UsersIcon,
} from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

export type SetupTypeVisualId = "white-label" | "runtime-tenants" | "hybrid"

type SetupTypeVisualProps = {
  type: SetupTypeVisualId
  active?: boolean
}

function DiagramFrame({
  children,
  label,
  className,
}: {
  children: React.ReactNode
  label: string
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "relative h-96 overflow-hidden rounded-xl border border-background/10 bg-background/[0.055] lg:h-[25.5rem]",
        className
      )}
    >
      {children}
    </div>
  )
}

function SharedProductCodeNode() {
  return (
    <div
      data-slot="shared-product-code-node"
      className="absolute top-6 left-1/2 z-20 flex h-12 w-40 -translate-x-1/2 items-center gap-2.5 rounded-xl border border-foreground/10 bg-background px-3 text-foreground shadow-lg"
    >
      <Code2Icon
        className="size-4 shrink-0 text-[#208AEF]"
        aria-hidden="true"
      />
      <span>
        <span className="block text-[0.625rem] font-medium whitespace-nowrap">
          Shared product code
        </span>
        <span className="block text-[0.5rem] text-foreground/45">
          Updated once
        </span>
      </span>
    </div>
  )
}

function ConnectorSvg({
  active,
  accent,
  className,
  path,
  viewBoxHeight,
}: {
  active: boolean
  accent: string
  className: string
  path: string
  viewBoxHeight: number
}) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 480 ${viewBoxHeight}`}
      className={cn(
        "pointer-events-none absolute inset-0 size-full",
        className
      )}
      preserveAspectRatio="none"
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        className="text-background/15"
      />
      <motion.path
        d={path}
        fill="none"
        stroke={accent}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={shouldReduceMotion ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />
      {active && !shouldReduceMotion ? (
        <motion.path
          data-slot="connector-pulse"
          d={path}
          pathLength="1"
          fill="none"
          stroke={accent}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="0.08 0.92"
          initial={{ strokeDashoffset: 0, opacity: 0 }}
          animate={{ strokeDashoffset: -1, opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.4, ease: "linear", repeat: Infinity }}
          style={{ filter: `drop-shadow(0 0 5px ${accent})` }}
        />
      ) : null}
    </svg>
  )
}

function ResponsiveConnector({
  active,
  accent,
  mobilePath,
  path,
}: {
  active: boolean
  accent: string
  mobilePath?: string
  path: string
}) {
  return (
    <>
      <ConnectorSvg
        active={active}
        accent={accent}
        path={mobilePath ?? path}
        viewBoxHeight={384}
        className="sm:hidden"
      />
      <ConnectorSvg
        active={active}
        accent={accent}
        path={path}
        viewBoxHeight={384}
        className="hidden sm:block lg:hidden"
      />
      <ConnectorSvg
        active={active}
        accent={accent}
        path={path}
        viewBoxHeight={408}
        className="hidden lg:block"
      />
    </>
  )
}

function AppVariantCard({
  label,
  accentClassName,
  className,
}: {
  label: string
  accentClassName: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative flex h-36 min-w-0 flex-col items-center rounded-xl border border-background/10 bg-foreground px-2 py-4 text-center text-background shadow-sm transition-transform duration-300 motion-reduce:transition-none",
        className
      )}
    >
      <div className="absolute top-2 flex gap-1 self-start">
        <span className="size-1 rounded-full bg-background/15" />
        <span className="size-1 rounded-full bg-background/8" />
      </div>
      <span
        className={cn(
          "mt-2 grid size-9 place-items-center rounded-lg",
          accentClassName
        )}
      >
        <SmartphoneIcon className="size-4" aria-hidden="true" />
      </span>
      <span className="mt-3 text-[0.6875rem] leading-4 font-medium">
        {label}
      </span>
      <span className="mt-1 text-[0.5625rem] text-background/40">
        App Variant
      </span>
    </div>
  )
}

function WhiteLabelAppsVisual({ active }: { active: boolean }) {
  return (
    <DiagramFrame label="One shared product codebase branches into three separately branded App Variants.">
      <ResponsiveConnector
        active={active}
        accent="#208AEF"
        path="M240 72 V120 H82 V160 M240 120 V160 M240 120 H398 V160"
      />
      <SharedProductCodeNode />

      <div className="absolute inset-x-4 top-40 grid grid-cols-3 gap-3 sm:inset-x-7 sm:gap-4">
        <AppVariantCard
          label="Customer app 01"
          accentClassName="bg-[#208AEF]/12 text-[#208AEF]"
          className="group-hover:-translate-x-2 group-hover:-rotate-1"
        />
        <AppVariantCard
          label="Customer app 02"
          accentClassName="bg-[#8B5CF6]/12 text-[#8B5CF6]"
          className="group-hover:-translate-y-2"
        />
        <AppVariantCard
          label="Next customer"
          accentClassName="bg-[#2DD4A8]/12 text-[#159A79]"
          className="group-hover:translate-x-2 group-hover:rotate-1"
        />
      </div>

      <p className="absolute inset-x-5 bottom-5 text-center text-[0.625rem] text-background/45">
        Separate name, icon, store listing, and native identity
      </p>
    </DiagramFrame>
  )
}

const runtimeTenantNodes = [
  {
    label: "Belgrade",
    position: "top-7 left-1/2 -translate-x-1/2",
    icon: Building2Icon,
  },
  {
    label: "Berlin",
    position: "bottom-7 left-4 sm:left-8",
    icon: MapPinIcon,
  },
  {
    label: "Lisbon",
    position: "right-4 bottom-7 sm:right-8",
    icon: UsersIcon,
  },
] as const

function RuntimeTenantNode({
  label,
  position,
  icon: Icon,
}: (typeof runtimeTenantNodes)[number]) {
  return (
    <div
      className={cn(
        "absolute z-10 flex h-20 w-24 flex-col items-center justify-center rounded-full border border-background/12 bg-foreground text-center text-background shadow-sm",
        position
      )}
    >
      <Icon className="size-3.5 text-[#EF8520]" aria-hidden="true" />
      <span className="mt-1 text-[0.5625rem] font-medium">{label}</span>
      <span className="text-[0.4375rem] text-background/40">
        Runtime Tenant
      </span>
    </div>
  )
}

function RuntimeTenantsVisual({ active }: { active: boolean }) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <DiagramFrame
      label="One installed App Variant opens three Runtime Tenants at runtime."
      className="bg-[radial-gradient(circle_at_center,rgba(239,133,32,0.12),transparent_60%)]"
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <svg
          aria-hidden="true"
          viewBox="0 0 280 280"
          className="absolute size-64 -rotate-90"
        >
          <circle
            cx="140"
            cy="140"
            r="126"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="3 5"
            className="text-background/20"
          />
          {active && !shouldReduceMotion ? (
            <motion.circle
              data-slot="runtime-orbit-pulse"
              cx="140"
              cy="140"
              r="126"
              pathLength="1"
              fill="none"
              stroke="#EF8520"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="0.1 0.9"
              initial={{ strokeDashoffset: 0, opacity: 0 }}
              animate={{ strokeDashoffset: -1, opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.8, ease: "linear", repeat: Infinity }}
              style={{ filter: "drop-shadow(0 0 5px #EF8520)" }}
            />
          ) : null}
        </svg>

        <div className="relative z-20 grid size-28 place-items-center rounded-full border border-foreground/10 bg-background text-center text-foreground shadow-xl">
          <span>
            <SmartphoneIcon
              className="mx-auto size-5 text-[#EF8520]"
              aria-hidden="true"
            />
            <span className="mt-2 block text-[0.6875rem] font-medium">
              1 App Variant
            </span>
            <span className="block text-[0.5rem] text-foreground/45">
              Installed once
            </span>
          </span>
        </div>
      </div>

      {runtimeTenantNodes.map((runtimeTenant) => (
        <RuntimeTenantNode key={runtimeTenant.label} {...runtimeTenant} />
      ))}

      <p className="absolute inset-x-5 bottom-2 text-center font-mono text-[0.5rem] tracking-[0.1em] text-background/45 uppercase">
        Opens allowed Runtime Tenants after sign-in
      </p>
    </DiagramFrame>
  )
}

function SetupVariantCard({
  type,
  name,
  context,
}: {
  type: "generic" | "standalone"
  name: string
  context: string
}) {
  const isGeneric = type === "generic"

  return (
    <div className="flex h-24 min-w-0 items-center gap-3 rounded-xl border border-background/12 bg-foreground p-3 text-background shadow-sm transition-transform duration-300 group-hover:-translate-y-1 sm:h-44 sm:flex-col sm:items-stretch sm:gap-0 sm:p-4">
      <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:min-h-12 sm:flex-none">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg",
            isGeneric
              ? "bg-[#2DD4A8]/12 text-[#159A79]"
              : "bg-background text-[#2DD4A8]"
          )}
        >
          {isGeneric ? (
            <SmartphoneIcon className="size-3.5" aria-hidden="true" />
          ) : (
            <StoreIcon className="size-3.5" aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0">
          <span className="block text-[0.625rem] leading-4 font-semibold sm:text-[0.6875rem]">
            {isGeneric ? "Generic App Variant" : "Standalone App Variant"}
          </span>
          <span className="block text-[0.5rem] text-background/40">
            {isGeneric ? "Shared network app" : "Partner app"}
          </span>
        </span>
      </div>

      <div className="flex h-16 min-w-0 flex-1 flex-col justify-center rounded-lg bg-background/[0.055] px-3 sm:mt-3 sm:flex-none">
        <span className="text-[0.625rem] font-medium">{name}</span>
        <span className="mt-1 text-[0.5rem] leading-3 text-background/45">
          {context}
        </span>
      </div>
    </div>
  )
}

function HybridVisual({ active }: { active: boolean }) {
  return (
    <DiagramFrame
      label="Shared product code splits into a Generic App Variant containing multiple Runtime Tenants and a Standalone App Variant fixed to one Runtime Tenant."
      className="bg-[radial-gradient(circle_at_center,var(--background)_1px,transparent_1px)] [background-size:18px_18px]"
    >
      <ResponsiveConnector
        active={active}
        accent="#2DD4A8"
        mobilePath="M240 72 V104 H32 V124 M32 104 V232"
        path="M240 72 V116 H126 V144 M240 116 H354 V144"
      />
      <SharedProductCodeNode />

      <div className="absolute inset-x-4 top-[7.75rem] grid gap-3 sm:inset-x-6 sm:top-36 sm:grid-cols-2 sm:gap-4">
        <SetupVariantCard
          type="generic"
          name="Gym A + Gym B"
          context="2 selectable Runtime Tenants"
        />
        <SetupVariantCard
          type="standalone"
          name="Partner business"
          context="1 fixed Runtime Tenant"
        />
      </div>

      <p className="absolute inset-x-5 bottom-5 text-center text-[0.625rem] text-background/45">
        Same product code. Two App Variant relationships.
      </p>
    </DiagramFrame>
  )
}

export function SetupTypeVisual({
  type,
  active = false,
}: SetupTypeVisualProps) {
  if (type === "white-label") return <WhiteLabelAppsVisual active={active} />
  if (type === "runtime-tenants") {
    return <RuntimeTenantsVisual active={active} />
  }
  return <HybridVisual active={active} />
}
