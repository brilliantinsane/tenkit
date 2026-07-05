"use client"

import {
  BoxesIcon,
  GitBranchIcon,
  PackageCheckIcon,
  SmartphoneIcon,
  StoreIcon,
} from "lucide-react"
import { useRef } from "react"

import { AnimatedBeam } from "@/components/ui/animated-beam"
import { GenericStandaloneBeam } from "@/components/ui/generic-standalone-beam"
import { WhiteLabelBeam } from "@/components/ui/white-label-beam"
import { RuntimeTenantsBeam } from "@/components/ui/runtime-tenants-beam"

export function SetupModelPreview({ index }: { index: number }) {
  if (index === 0) {
    return <WhiteLabelBeam />
  }

  if (index === 1) {
    return <RuntimeTenantsBeam />
  }

  if (index === 2) {
    return <GenericStandaloneBeam />
  }

  return <></>
}

const flowConfigs = [
  {
    color: "#208AEF",
    nodes: [
      { label: "Brand", icon: StoreIcon },
      { label: "Variant", icon: SmartphoneIcon },
      { label: "EAS", icon: PackageCheckIcon },
    ],
  },
  {
    color: "#EF8520",
    nodes: [
      { label: "App", icon: SmartphoneIcon },
      { label: "Runtime", icon: BoxesIcon },
      { label: "Switch", icon: StoreIcon },
    ],
  },
  {
    color: "#2DD4A8",
    nodes: [
      { label: "Generic", icon: BoxesIcon },
      { label: "Breakout", icon: GitBranchIcon },
      { label: "Store", icon: StoreIcon },
    ],
  },
] as const

export function SetupModelFlow({ index }: { index: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const firstRef = useRef<HTMLSpanElement>(null)
  const secondRef = useRef<HTMLSpanElement>(null)
  const thirdRef = useRef<HTMLSpanElement>(null)
  const config = flowConfigs[index] ?? flowConfigs[0]

  return (
    <div
      ref={containerRef}
      className="relative mx-auto grid w-full max-w-xl grid-cols-3 items-start gap-3 overflow-hidden py-2"
    >
      {config.nodes.map((item, itemIndex) => {
        const Icon = item.icon
        const ref =
          itemIndex === 0 ? firstRef : itemIndex === 1 ? secondRef : thirdRef

        return (
          <div
            key={item.label}
            className="relative z-10 flex flex-col items-center gap-2 text-center"
          >
            <span
              ref={ref}
              className="grid size-10 place-items-center rounded-full border bg-card shadow-sm"
              style={{
                borderColor: `${config.color}40`,
              }}
            >
              <Icon
                className="size-4"
                style={{ color: config.color }}
                aria-hidden="true"
              />
            </span>
            <span className="text-[0.68rem] leading-4 font-medium text-muted-foreground">
              {item.label}
            </span>
          </div>
        )
      })}
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={firstRef}
        toRef={secondRef}
        duration={4.4}
        pathWidth={1.5}
        startXOffset={20}
        endXOffset={-20}
        pathColor={config.color}
        pathOpacity={0.22}
        gradientStartColor={config.color}
        gradientStopColor={config.color}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={secondRef}
        toRef={thirdRef}
        duration={4.4}
        delay={1.6}
        pathWidth={1.5}
        startXOffset={20}
        endXOffset={-20}
        pathColor={config.color}
        pathOpacity={0.22}
        gradientStartColor={config.color}
        gradientStopColor={config.color}
      />
    </div>
  )
}
