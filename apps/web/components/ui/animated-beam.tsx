"use client"

import {
  useEffect,
  useId,
  useState,
  type ComponentPropsWithoutRef,
  type Ref,
  type RefObject,
} from "react"

import { cn } from "@/lib/utils"

type AnimatedBeamProps = ComponentPropsWithoutRef<"svg"> & {
  containerRef: RefObject<HTMLElement | null>
  fromRef: RefObject<HTMLElement | null>
  toRef: RefObject<HTMLElement | null>
  curvature?: number
  duration?: number
  reverse?: boolean
  beamColor?: string
  ref?: Ref<SVGSVGElement>
}

type BeamGeometry = { height: number; path: string; width: number }

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduced(query.matches)

    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  return reduced
}

function useBeamGeometry({
  containerRef,
  curvature,
  fromRef,
  toRef,
}: Pick<
  AnimatedBeamProps,
  "containerRef" | "curvature" | "fromRef" | "toRef"
>) {
  const [geometry, setGeometry] = useState<BeamGeometry>({
    height: 0,
    path: "",
    width: 0,
  })

  useEffect(() => {
    const container = containerRef.current

    const update = () => {
      const from = fromRef.current
      const to = toRef.current

      if (!container || !from || !to) return

      const containerRect = container.getBoundingClientRect()
      const fromRect = from.getBoundingClientRect()
      const toRect = to.getBoundingClientRect()
      const startX = fromRect.left - containerRect.left + fromRect.width / 2
      const startY = fromRect.top - containerRect.top + fromRect.height / 2
      const endX = toRect.left - containerRect.left + toRect.width / 2
      const endY = toRect.top - containerRect.top + toRect.height / 2
      const controlX = (startX + endX) / 2
      const controlY = (startY + endY) / 2 - (curvature ?? 0)

      setGeometry({
        height: containerRect.height,
        path: `M ${startX},${startY} Q ${controlX},${controlY} ${endX},${endY}`,
        width: containerRect.width,
      })
    }

    update()

    if (!container || typeof ResizeObserver === "undefined") return

    const observer = new ResizeObserver(update)
    observer.observe(container)
    if (fromRef.current) observer.observe(fromRef.current)
    if (toRef.current) observer.observe(toRef.current)

    return () => observer.disconnect()
  }, [containerRef, curvature, fromRef, toRef])

  return geometry
}

export function AnimatedBeam({
  beamColor = "var(--primary)",
  className,
  containerRef,
  curvature = 0,
  duration = 3,
  fromRef,
  ref,
  reverse = false,
  toRef,
  ...props
}: AnimatedBeamProps) {
  const gradientId = useId().replaceAll(":", "")
  const reduced = usePrefersReducedMotion()
  const { height, path, width } = useBeamGeometry({
    containerRef,
    curvature,
    fromRef,
    toRef,
  })

  return (
    <svg
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0", className)}
      fill="none"
      ref={ref}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      {...props}
    >
      <path d={path} stroke="currentColor" strokeWidth="1.5" opacity="0.28" />
      <path d={path} stroke={`url(#${gradientId})`} strokeWidth="3" />
      <defs>
        <linearGradient
          gradientUnits="objectBoundingBox"
          id={gradientId}
          x1="0%"
          x2="20%"
        >
          <stop offset="0%" stopColor={beamColor} stopOpacity="0" />
          <stop offset="50%" stopColor={beamColor} />
          <stop offset="100%" stopColor={beamColor} stopOpacity="0" />
          {reduced ? null : (
            <>
              <animate
                attributeName="x1"
                dur={`${duration}s`}
                repeatCount="indefinite"
                values={reverse ? "100%;-20%" : "-20%;100%"}
              />
              <animate
                attributeName="x2"
                dur={`${duration}s`}
                repeatCount="indefinite"
                values={reverse ? "120%;0%" : "0%;120%"}
              />
            </>
          )}
        </linearGradient>
      </defs>
    </svg>
  )
}
