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

const BEAM_COLOR = "#2DD4A8"

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
        "z-10 flex shrink-0 items-center justify-center rounded-full border shadow-lg shadow-[#2DD4A8]/10 backdrop-blur-md transition-colors",
        "border-[#2DD4A8]/20 bg-white/88 text-[#159A78]",
        "dark:border-white/12 dark:bg-white/10 dark:text-[#74F2CF]",
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

export function GenericStandaloneBeam({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sourceRef = useRef<HTMLDivElement>(null)
  const genericRef = useRef<HTMLDivElement>(null)
  const standaloneRef = useRef<HTMLDivElement>(null)
  const tenant1Ref = useRef<HTMLDivElement>(null)
  const tenant2Ref = useRef<HTMLDivElement>(null)
  const tenant3Ref = useRef<HTMLDivElement>(null)
  const standalone1Ref = useRef<HTMLDivElement>(null)
  const standalone2Ref = useRef<HTMLDivElement>(null)

  return (
    <div
      className={cn(
        "relative flex h-full w-full items-center justify-center overflow-hidden p-6",
        "bg-[radial-gradient(circle_at_50%_50%,rgba(45,212,168,0.16),transparent_36%),linear-gradient(180deg,#f5fffb_0%,#eafbf5_52%,#ddf3eb_100%)]",
        "dark:bg-[radial-gradient(circle_at_50%_50%,rgba(45,212,168,0.26),transparent_36%),linear-gradient(135deg,rgba(45,212,168,0.16),rgba(7,9,13,0.94)_48%,rgba(45,212,168,0.08))]",
        className
      )}
      ref={containerRef}
    >
      <div className="flex size-full max-w-[22rem] flex-row items-stretch justify-between gap-5">
        <div className="flex flex-col justify-center">
          <Circle
            ref={sourceRef}
            tooltip="Shared codebase"
            tooltipSide="bottom"
          >
            <CodeXmlIcon className="size-4" aria-hidden="true" />
          </Circle>
        </div>

        <div className="flex flex-col justify-center gap-16">
          <Circle
            ref={genericRef}
            featured
            tooltip="Generic app variant"
            tooltipSide="bottom"
          >
            <BoxesIcon className="size-5" aria-hidden="true" />
          </Circle>

          <Circle
            ref={standaloneRef}
            featured
            tooltip="Standalone app variant"
            tooltipSide="bottom"
          >
            <SmartphoneIcon className="size-5" aria-hidden="true" />
          </Circle>
        </div>

        <div className="flex flex-col justify-center">
          <div className="flex flex-col gap-2.5">
            <Circle
              ref={tenant1Ref}
              tooltip="Runtime tenant"
              tooltipSide="right"
            >
              <SmartphoneIcon className="size-4" aria-hidden="true" />
            </Circle>
            <Circle
              ref={tenant2Ref}
              tooltip="Runtime tenant"
              tooltipSide="right"
            >
              <SmartphoneIcon className="size-4" aria-hidden="true" />
            </Circle>
            <Circle
              ref={tenant3Ref}
              tooltip="Runtime tenant"
              tooltipSide="right"
            >
              <SmartphoneIcon className="size-4" aria-hidden="true" />
            </Circle>
          </div>
          <div className="mt-4 flex flex-col gap-2.5">
            <Circle
              ref={standalone1Ref}
              tooltip="Individual app"
              tooltipSide="right"
            >
              <SmartphoneIcon className="size-4" aria-hidden="true" />
            </Circle>
            <Circle
              ref={standalone2Ref}
              tooltip="Individual app"
              tooltipSide="right"
            >
              <SmartphoneIcon className="size-4" aria-hidden="true" />
            </Circle>
          </div>
        </div>
      </div>

      <AnimatedBeam
        containerRef={containerRef}
        fromRef={sourceRef}
        toRef={genericRef}
        duration={3.6}
        curvature={48}
        pathColor={BEAM_COLOR}
        pathOpacity={0.26}
        gradientStartColor={BEAM_COLOR}
        gradientStopColor={BEAM_COLOR}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={sourceRef}
        toRef={standaloneRef}
        duration={3.6}
        curvature={-48}
        pathColor={BEAM_COLOR}
        pathOpacity={0.26}
        gradientStartColor={BEAM_COLOR}
        gradientStopColor={BEAM_COLOR}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={genericRef}
        toRef={tenant1Ref}
        duration={3.6}
        delay={1.2}
        curvature={44}
        pathColor={BEAM_COLOR}
        pathOpacity={0.26}
        gradientStartColor={BEAM_COLOR}
        gradientStopColor={BEAM_COLOR}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={genericRef}
        toRef={tenant2Ref}
        duration={3.6}
        delay={1.2}
        curvature={18}
        pathColor={BEAM_COLOR}
        pathOpacity={0.26}
        gradientStartColor={BEAM_COLOR}
        gradientStopColor={BEAM_COLOR}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={genericRef}
        toRef={tenant3Ref}
        duration={3.6}
        delay={1.2}
        curvature={0}
        pathColor={BEAM_COLOR}
        pathOpacity={0.26}
        gradientStartColor={BEAM_COLOR}
        gradientStopColor={BEAM_COLOR}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={standaloneRef}
        toRef={standalone1Ref}
        duration={3.6}
        delay={1.2}
        curvature={0}
        pathColor={BEAM_COLOR}
        pathOpacity={0.26}
        gradientStartColor={BEAM_COLOR}
        gradientStopColor={BEAM_COLOR}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={standaloneRef}
        toRef={standalone2Ref}
        duration={3.6}
        delay={1.2}
        curvature={-22}
        pathColor={BEAM_COLOR}
        pathOpacity={0.26}
        gradientStartColor={BEAM_COLOR}
        gradientStopColor={BEAM_COLOR}
      />
    </div>
  )
}
