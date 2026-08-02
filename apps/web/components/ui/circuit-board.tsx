"use client"

import { motion, useReducedMotion } from "motion/react"
import { useId, useMemo, type HTMLAttributes, type ReactNode } from "react"

import { cn } from "@/lib/utils"

export type CircuitNode = {
  id: string
  x: number
  y: number
  label: string
  caption?: string
  icon?: ReactNode
  className?: string
  labelClassName?: string
}

export type CircuitConnection = {
  from: string
  to: string
  color?: string
  pulseColor?: string
  bidirectional?: boolean
}

type CircuitBoardProps = HTMLAttributes<HTMLDivElement> & {
  nodes: readonly CircuitNode[]
  connections: readonly CircuitConnection[]
  viewBoxWidth?: number
  viewBoxHeight?: number
  showGrid?: boolean
  pulseSpeed?: number
}

function getCircuitPath(from: CircuitNode, to: CircuitNode) {
  const deltaX = to.x - from.x
  const deltaY = to.y - from.y

  if (Math.abs(deltaY) >= Math.abs(deltaX)) {
    const middleY = from.y + deltaY / 2
    return `M ${from.x} ${from.y} V ${middleY} H ${to.x} V ${to.y}`
  }

  const middleX = from.x + deltaX / 2
  return `M ${from.x} ${from.y} H ${middleX} V ${to.y} H ${to.x}`
}

export function CircuitBoard({
  nodes,
  connections,
  viewBoxWidth = 480,
  viewBoxHeight = 336,
  showGrid = true,
  pulseSpeed = 2.4,
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

  return (
    <div
      className={cn("relative size-full overflow-hidden", className)}
      {...props}
    >
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 size-full"
      >
        <defs>
          <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern
            id={gridId}
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="10" cy="10" r="1" fill="currentColor" />
          </pattern>
        </defs>

        {showGrid ? (
          <rect
            width={viewBoxWidth}
            height={viewBoxHeight}
            fill={`url(#${gridId})`}
            opacity="0.09"
          />
        ) : null}

        {connections.map((connection, index) => {
          const from = nodeMap.get(connection.from)
          const to = nodeMap.get(connection.to)

          if (!from || !to) return null

          const path = getCircuitPath(from, to)
          const pulseColor =
            connection.pulseColor ?? connection.color ?? "currentColor"

          return (
            <g key={`${connection.from}-${connection.to}-${index}`}>
              <motion.path
                d={path}
                fill="none"
                stroke={connection.color ?? "currentColor"}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.32"
                initial={shouldReduceMotion ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.7, delay: index * 0.08 }}
              />
              {!shouldReduceMotion ? (
                <>
                  <motion.path
                    d={path}
                    pathLength="1"
                    fill="none"
                    stroke={pulseColor}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="0.08 0.92"
                    filter={`url(#${glowId})`}
                    initial={{ strokeDashoffset: 0 }}
                    animate={{ strokeDashoffset: -1 }}
                    transition={{
                      duration: pulseSpeed,
                      repeat: Infinity,
                      ease: "linear",
                      delay: index * 0.2,
                    }}
                  />
                  {connection.bidirectional ? (
                    <motion.path
                      d={path}
                      pathLength="1"
                      fill="none"
                      stroke={pulseColor}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="0.06 0.94"
                      filter={`url(#${glowId})`}
                      initial={{ strokeDashoffset: -1 }}
                      animate={{ strokeDashoffset: 0 }}
                      transition={{
                        duration: pulseSpeed,
                        repeat: Infinity,
                        ease: "linear",
                        delay: index * 0.2 + pulseSpeed / 2,
                      }}
                    />
                  ) : null}
                </>
              ) : null}
            </g>
          )
        })}
      </svg>

      {nodes.map((node, index) => (
        <motion.div
          key={node.id}
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${(node.x / viewBoxWidth) * 100}%`,
            top: `${(node.y / viewBoxHeight) * 100}%`,
          }}
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, delay: 0.12 + index * 0.06 }}
        >
          <div
            className={cn(
              "flex h-[4.25rem] w-24 items-center gap-2.5 rounded-lg border border-background/20 bg-foreground px-3 text-background shadow-lg sm:w-28",
              node.className
            )}
          >
            {node.icon ? (
              <span className="grid size-7 shrink-0 place-items-center rounded-md bg-background/10">
                {node.icon}
              </span>
            ) : null}
            <span className="min-w-0">
              <span
                className={cn(
                  "block text-xs leading-4 font-medium",
                  node.labelClassName
                )}
              >
                {node.label}
              </span>
              {node.caption ? (
                <span className="mt-0.5 block text-[0.625rem] leading-3 text-background/70">
                  {node.caption}
                </span>
              ) : null}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
