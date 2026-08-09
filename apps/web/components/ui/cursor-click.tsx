"use client"

import type { Variants } from "motion/react"
import { motion, useReducedMotion } from "motion/react"
import type { HTMLAttributes, ReactNode } from "react"

import { cn } from "@/lib/utils"

interface CursorClickIconProps extends HTMLAttributes<HTMLDivElement> {
  animation?: "idle" | "click"
  size?: number
}

const CURSOR_RAYS = [
  { d: "M14 4.1 12 6", x: 1, y: -1 },
  { d: "m5.1 8-2.9-.8", x: -1, y: 0 },
  { d: "m6 12-1.9 2", x: -1, y: 1 },
  { d: "M7.2 2.2 8 5.1", x: 0, y: -1 },
] as const

const CURSOR_VARIANTS: Variants = {
  initial: { x: 0, y: 0 },
  animate: {
    x: [0, 0, -3, 0],
    y: [0, -4, 0, 0],
    transition: {
      duration: 0.65,
      ease: "easeOut",
      times: [0, 0.2, 0.55, 1],
    },
  },
}

const LINE_VARIANTS: Variants = {
  initial: { opacity: 1, x: 0, y: 0 },
  animate: (custom: { x: number; y: number }) => ({
    opacity: [1, 0, 1],
    x: [0, custom.x, 0],
    y: [0, custom.y, 0],
    transition: {
      delay: 0.16,
      duration: 0.42,
      ease: "easeOut",
      times: [0, 0.45, 1],
    },
  }),
}

export function CursorClickIcon({
  animation = "idle",
  className,
  size = 28,
  style,
  ...props
}: CursorClickIconProps) {
  const shouldReduceMotion = useReducedMotion()
  const motionState =
    shouldReduceMotion || animation === "idle" ? "initial" : "animate"

  return (
    <div
      className={cn("relative inline-block shrink-0", className)}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <motion.div
        className="absolute inset-0"
        animate={motionState}
        variants={CURSOR_VARIANTS}
      >
        <CursorSvg>
          <path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z" />
        </CursorSvg>
      </motion.div>

      {CURSOR_RAYS.map((ray) => (
        <motion.div
          key={ray.d}
          className="absolute inset-0"
          animate={motionState}
          custom={{ x: ray.x, y: ray.y }}
          initial="initial"
          variants={LINE_VARIANTS}
        >
          <CursorSvg>
            <path d={ray.d} />
          </CursorSvg>
        </motion.div>
      ))}
    </div>
  )
}

function CursorSvg({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className="size-full"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  )
}
