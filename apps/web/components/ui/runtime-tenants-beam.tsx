"use client"

import React, { useRef } from "react"

import { cn } from "@/lib/utils"
import { AnimatedBeam } from "./animated-beam"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { BoxesIcon, CodeXmlIcon, SmartphoneIcon } from "lucide-react"

const BEAM_COLOR = "#EF8520"

type CircleProps = {
  ref?: React.Ref<HTMLDivElement>
  className?: string
  children?: React.ReactNode
  featured?: boolean
  tooltip: string
  tooltipSide: "right" | "bottom"
}

function Circle({
  ref,
  className,
  children,
  featured = false,
  tooltip,
  tooltipSide,
}: CircleProps) {
  const circle = (
    <div
      ref={ref}
      className={cn(
        "z-10 flex shrink-0 items-center justify-center rounded-full border shadow-lg shadow-[#EF8520]/10 backdrop-blur-md transition-colors",
        "border-[#EF8520]/20 bg-white/88 text-[#EF8520]",
        "dark:border-white/12 dark:bg-white/10 dark:text-[#FFB15F]",
        featured ? "size-14 p-3" : "size-10 p-2",
        className
      )}
    >
      {children}
    </div>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>{circle}</TooltipTrigger>
      <TooltipContent side={tooltipSide} sideOffset={8}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

export function RuntimeTenantsBeam({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const div1Ref = useRef<HTMLDivElement>(null)
  const div2Ref = useRef<HTMLDivElement>(null)
  const div3Ref = useRef<HTMLDivElement>(null)
  const div4Ref = useRef<HTMLDivElement>(null)
  const div5Ref = useRef<HTMLDivElement>(null)
  const div6Ref = useRef<HTMLDivElement>(null)
  const div7Ref = useRef<HTMLDivElement>(null)

  return (
    <div
      className={cn(
        "relative flex h-full w-full items-center justify-center overflow-hidden p-6",
        "bg-[radial-gradient(circle_at_48%_50%,rgba(239,133,32,0.16),transparent_36%),linear-gradient(180deg,#fffaf5_0%,#fff1e3_52%,#f7e6d3_100%)]",
        "dark:bg-[radial-gradient(circle_at_48%_50%,rgba(239,133,32,0.26),transparent_36%),linear-gradient(135deg,rgba(239,133,32,0.16),rgba(7,9,13,0.94)_48%,rgba(239,133,32,0.08))]",
        className
      )}
      ref={containerRef}
    >
      <div className="flex size-full max-w-[22rem] flex-row items-stretch justify-between gap-5">
        <div className="flex flex-col justify-center">
          <Circle ref={div7Ref} tooltip="Shared codebase" tooltipSide="bottom">
            <CodeXmlIcon className="size-4" aria-hidden="true" />
          </Circle>
        </div>
        <div className="flex flex-col justify-center">
          <Circle
            ref={div6Ref}
            featured
            tooltip="Runtime tenant model"
            tooltipSide="bottom"
          >
            <BoxesIcon className="size-5" aria-hidden="true" />
          </Circle>
        </div>
        <div className="flex flex-col justify-center gap-2.5">
          <Circle ref={div1Ref} tooltip="Selectable tenant" tooltipSide="right">
            <SmartphoneIcon className="size-4" aria-hidden="true" />
          </Circle>
          <Circle ref={div2Ref} tooltip="Selectable tenant" tooltipSide="right">
            <SmartphoneIcon className="size-4" aria-hidden="true" />
          </Circle>
          <Circle ref={div3Ref} tooltip="Selectable tenant" tooltipSide="right">
            <SmartphoneIcon className="size-4" aria-hidden="true" />
          </Circle>
          <Circle ref={div4Ref} tooltip="Selectable tenant" tooltipSide="right">
            <SmartphoneIcon className="size-4" aria-hidden="true" />
          </Circle>
          <Circle ref={div5Ref} tooltip="Selectable tenant" tooltipSide="right">
            <SmartphoneIcon className="size-4" aria-hidden="true" />
          </Circle>
        </div>
      </div>

      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div1Ref}
        toRef={div6Ref}
        duration={3}
        pathColor={BEAM_COLOR}
        pathOpacity={0.26}
        gradientStartColor={BEAM_COLOR}
        gradientStopColor={BEAM_COLOR}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div2Ref}
        toRef={div6Ref}
        duration={3}
        pathColor={BEAM_COLOR}
        pathOpacity={0.26}
        gradientStartColor={BEAM_COLOR}
        gradientStopColor={BEAM_COLOR}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div3Ref}
        toRef={div6Ref}
        duration={3}
        pathColor={BEAM_COLOR}
        pathOpacity={0.26}
        gradientStartColor={BEAM_COLOR}
        gradientStopColor={BEAM_COLOR}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div4Ref}
        toRef={div6Ref}
        duration={3}
        pathColor={BEAM_COLOR}
        pathOpacity={0.26}
        gradientStartColor={BEAM_COLOR}
        gradientStopColor={BEAM_COLOR}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div5Ref}
        toRef={div6Ref}
        duration={3}
        pathColor={BEAM_COLOR}
        pathOpacity={0.26}
        gradientStartColor={BEAM_COLOR}
        gradientStopColor={BEAM_COLOR}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div6Ref}
        toRef={div7Ref}
        duration={3}
        pathColor={BEAM_COLOR}
        pathOpacity={0.26}
        gradientStartColor={BEAM_COLOR}
        gradientStopColor={BEAM_COLOR}
      />
    </div>
  )
}
