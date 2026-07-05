"use client"

import React, { useRef } from "react"

import { cn } from "@/lib/utils"
import { AnimatedBeam } from "./animated-beam"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { CodeXmlIcon, SmartphoneIcon } from "lucide-react"

const BEAM_COLOR = "#208AEF"

type CircleProps = {
  ref?: React.Ref<HTMLDivElement>
  className?: string
  children?: React.ReactNode
  featured?: boolean
  tooltip: string
  tooltipSide: "left" | "right" | "bottom"
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
        "z-10 flex items-center justify-center rounded-full border shadow-lg shadow-[#208AEF]/10 backdrop-blur-md transition-colors",
        "border-[#208AEF]/20 bg-white/88 text-[#208AEF]",
        "dark:border-white/12 dark:bg-white/10 dark:text-[#7DBDFF]",
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

export function WhiteLabelBeam({ className }: { className?: string }) {
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
        "bg-[radial-gradient(circle_at_50%_48%,rgba(32,138,239,0.16),transparent_36%),linear-gradient(180deg,#f8fbff_0%,#eef6ff_52%,#e8f1fb_100%)]",
        "dark:bg-[radial-gradient(circle_at_50%_48%,rgba(32,138,239,0.26),transparent_36%),linear-gradient(135deg,rgba(32,138,239,0.16),rgba(7,9,13,0.94)_48%,rgba(32,138,239,0.08))]",
        className
      )}
      ref={containerRef}
    >
      <div className="flex size-full max-w-[22rem] flex-col items-stretch justify-between gap-5">
        <div className="flex flex-row items-center justify-between">
          <Circle ref={div1Ref} tooltip="Individual app" tooltipSide="left">
            <SmartphoneIcon className="size-4" aria-hidden="true" />
          </Circle>
          <Circle ref={div5Ref} tooltip="Individual app" tooltipSide="right">
            <SmartphoneIcon className="size-4" aria-hidden="true" />
          </Circle>
        </div>
        <div className="flex flex-row items-center justify-between">
          <Circle ref={div2Ref} tooltip="Individual app" tooltipSide="left">
            <SmartphoneIcon className="size-4" aria-hidden="true" />
          </Circle>
          <Circle
            ref={div4Ref}
            featured
            tooltip="Shared codebase"
            tooltipSide="bottom"
          >
            <CodeXmlIcon className="size-5" aria-hidden="true" />
          </Circle>
          <Circle ref={div6Ref} tooltip="Individual app" tooltipSide="right">
            <SmartphoneIcon className="size-4" aria-hidden="true" />
          </Circle>
        </div>
        <div className="flex flex-row items-center justify-between">
          <Circle ref={div3Ref} tooltip="Individual app" tooltipSide="left">
            <SmartphoneIcon className="size-4" aria-hidden="true" />
          </Circle>
          <Circle ref={div7Ref} tooltip="Individual app" tooltipSide="right">
            <SmartphoneIcon className="size-4" aria-hidden="true" />
          </Circle>
        </div>
      </div>

      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div1Ref}
        toRef={div4Ref}
        curvature={-75}
        endYOffset={-10}
        pathColor={BEAM_COLOR}
        pathOpacity={0.26}
        gradientStartColor={BEAM_COLOR}
        gradientStopColor={BEAM_COLOR}
        direction="reverse"
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div2Ref}
        toRef={div4Ref}
        pathColor={BEAM_COLOR}
        pathOpacity={0.26}
        gradientStartColor={BEAM_COLOR}
        gradientStopColor={BEAM_COLOR}
        direction="reverse"
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div3Ref}
        toRef={div4Ref}
        curvature={75}
        endYOffset={10}
        pathColor={BEAM_COLOR}
        pathOpacity={0.26}
        gradientStartColor={BEAM_COLOR}
        gradientStopColor={BEAM_COLOR}
        direction="reverse"
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div5Ref}
        toRef={div4Ref}
        curvature={-75}
        endYOffset={-10}
        pathColor={BEAM_COLOR}
        pathOpacity={0.26}
        gradientStartColor={BEAM_COLOR}
        gradientStopColor={BEAM_COLOR}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div6Ref}
        toRef={div4Ref}
        pathColor={BEAM_COLOR}
        pathOpacity={0.26}
        gradientStartColor={BEAM_COLOR}
        gradientStopColor={BEAM_COLOR}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={div7Ref}
        toRef={div4Ref}
        curvature={75}
        endYOffset={10}
        pathColor={BEAM_COLOR}
        pathOpacity={0.26}
        gradientStartColor={BEAM_COLOR}
        gradientStopColor={BEAM_COLOR}
      />
    </div>
  )
}
