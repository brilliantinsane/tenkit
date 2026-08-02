"use client"

import { motion, useReducedMotion } from "motion/react"
import {
  useCallback,
  useId,
  useMemo,
  type HTMLAttributes,
  type ReactNode,
} from "react"

import { cn } from "@/lib/utils"

export type CircuitNode = {
  id: string
  x: number
  y: number
  label?: string
  icon?: ReactNode
  status?: "active" | "inactive" | "processing" | "error"
  size?: "sm" | "md" | "lg"
}

export type CircuitConnection = {
  from: string
  to: string
  animated?: boolean
  bidirectional?: boolean
  color?: string
  pulseColor?: string
}

export type CircuitBoardProps = HTMLAttributes<HTMLDivElement> & {
  nodes: readonly CircuitNode[]
  connections: readonly CircuitConnection[]
  width?: number
  height?: number
  gridSize?: number
  showGrid?: boolean
  gridColor?: string
  traceColor?: string
  pulseColor?: string
  nodeColor?: string
  pulseSpeed?: number
  traceWidth?: number
}

function getNodeSize(size?: CircuitNode["size"]) {
  if (size === "sm") return 28
  if (size === "lg") return 52
  return 38
}

export function CircuitBoard({
  nodes,
  connections,
  width = 480,
  height = 300,
  gridSize = 20,
  showGrid = true,
  gridColor = "color-mix(in oklab, var(--background) 18%, transparent)",
  traceColor = "color-mix(in oklab, var(--background) 42%, transparent)",
  pulseColor = "var(--primary)",
  nodeColor = "var(--background)",
  pulseSpeed = 1.8,
  traceWidth = 2,
  className,
  ...props
}: CircuitBoardProps) {
  const shouldReduceMotion = useReducedMotion()
  const instanceId = useId().replaceAll(":", "")
  const gridId = `circuit-grid-${instanceId}`
  const glowId = `circuit-glow-${instanceId}`
  const nodeMap = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes]
  )

  const calculatePath = useCallback((from: CircuitNode, to: CircuitNode) => {
    const fromOffset = getNodeSize(from.size) / 2 + 4
    const toOffset = getNodeSize(to.size) / 2 + 4
    const deltaX = to.x - from.x
    const deltaY = to.y - from.y

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      const startX = from.x + (deltaX > 0 ? fromOffset : -fromOffset)
      const endX = to.x + (deltaX > 0 ? -toOffset : toOffset)
      const middleX = from.x + deltaX / 2
      return `M ${startX} ${from.y} H ${middleX} V ${to.y} H ${endX}`
    }

    const startY = from.y + (deltaY > 0 ? fromOffset : -fromOffset)
    const endY = to.y + (deltaY > 0 ? -toOffset : toOffset)
    const middleY = from.y + deltaY / 2
    return `M ${from.x} ${startY} V ${middleY} H ${to.x} V ${endY}`
  }, [])

  return (
    <div
      className={cn("relative w-full overflow-hidden", className)}
      style={{ aspectRatio: `${width} / ${height}` }}
      {...props}
    >
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${width} ${height}`}
        className="pointer-events-none absolute inset-0 size-full"
      >
        <defs>
          <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="1.75" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern
            id={gridId}
            width={gridSize}
            height={gridSize}
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx={gridSize / 2}
              cy={gridSize / 2}
              r="0.75"
              fill={gridColor}
            />
          </pattern>
        </defs>

        {showGrid ? (
          <rect width={width} height={height} fill={`url(#${gridId})`} />
        ) : null}

        {connections.map((connection, index) => {
          const fromNode = nodeMap.get(connection.from)
          const toNode = nodeMap.get(connection.to)

          if (!fromNode || !toNode) return null

          const path = calculatePath(fromNode, toNode)
          const activePulseColor = connection.pulseColor ?? pulseColor

          return (
            <g key={`${connection.from}-${connection.to}-${index}`}>
              <motion.path
                d={path}
                fill="none"
                stroke={connection.color ?? traceColor}
                strokeWidth={traceWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={shouldReduceMotion ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
              />

              {connection.animated !== false && !shouldReduceMotion ? (
                <motion.path
                  d={path}
                  pathLength="1"
                  fill="none"
                  stroke={activePulseColor}
                  strokeWidth={traceWidth + 0.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="0.045 0.955"
                  filter={`url(#${glowId})`}
                  initial={{ strokeDashoffset: 0 }}
                  animate={{ strokeDashoffset: -1 }}
                  transition={{
                    duration: pulseSpeed,
                    repeat: Infinity,
                    ease: "linear",
                    delay: index * 0.18,
                  }}
                />
              ) : null}

              {connection.bidirectional && !shouldReduceMotion ? (
                <motion.path
                  d={path}
                  pathLength="1"
                  fill="none"
                  stroke={activePulseColor}
                  strokeWidth={traceWidth + 0.35}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="0.035 0.965"
                  filter={`url(#${glowId})`}
                  initial={{ strokeDashoffset: -1 }}
                  animate={{ strokeDashoffset: 0 }}
                  transition={{
                    duration: pulseSpeed,
                    repeat: Infinity,
                    ease: "linear",
                    delay: index * 0.18 + pulseSpeed / 2,
                  }}
                />
              ) : null}
            </g>
          )
        })}
      </svg>

      {nodes.map((node, index) => {
        const size = getNodeSize(node.size)
        const statusColor =
          node.status === "inactive"
            ? `color-mix(in oklab, ${nodeColor} 52%, transparent)`
            : node.status === "error"
              ? "var(--destructive)"
              : pulseColor

        return (
          <motion.div
            key={node.id}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            style={{
              left: `${(node.x / width) * 100}%`,
              top: `${(node.y / height) * 100}%`,
              width: size,
              height: size,
            }}
            initial={shouldReduceMotion ? false : { scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: index * 0.08 + 0.35, type: "spring" }}
          >
            <div
              className="absolute inset-0 rounded-lg border"
              style={{
                backgroundColor: `color-mix(in oklab, ${statusColor} 10%, var(--foreground))`,
                borderColor: `color-mix(in oklab, ${statusColor} 58%, transparent)`,
                boxShadow:
                  node.status === "active"
                    ? `0 0 11px color-mix(in oklab, ${statusColor} 24%, transparent)`
                    : undefined,
              }}
            />
            {node.status === "processing" && !shouldReduceMotion ? (
              <motion.div
                className="absolute -inset-1 rounded-xl border"
                style={{ borderColor: statusColor }}
                animate={{ opacity: [0.08, 0.28, 0.08], scale: [1, 1.08, 1] }}
                transition={{ duration: 2.6, repeat: Infinity }}
              />
            ) : null}
            <span className="relative z-10" style={{ color: statusColor }}>
              {node.icon}
            </span>
            {node.label ? (
              <span className="absolute top-full left-1/2 z-20 mt-1.5 w-16 -translate-x-1/2 rounded-sm bg-foreground px-1 py-1 text-center text-[0.5625rem] leading-3 font-medium text-background shadow-[0_0_0_2px_var(--foreground)] sm:mt-2 sm:w-28 sm:px-2 sm:text-xs sm:leading-4">
                {node.label}
              </span>
            ) : null}
          </motion.div>
        )
      })}
    </div>
  )
}
