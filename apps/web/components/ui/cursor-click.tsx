"use client"

import type { Variants } from "motion/react"
import { motion, useReducedMotion } from "motion/react"
import type { HTMLAttributes } from "react"

import { cn } from "@/lib/utils"

interface CursorClickIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number
}

const CURSOR_VARIANTS: Variants = {
  initial: { x: 0, y: 0 },
  animate: {
    x: [0, 0, -3, 0, 0],
    y: [0, -4, 0, 0, 0],
    transition: {
      duration: 2.6,
      ease: "easeInOut",
      repeat: Infinity,
      times: [0, 0.12, 0.25, 0.38, 1],
    },
  },
}

const LINE_VARIANTS: Variants = {
  initial: { opacity: 1, x: 0, y: 0 },
  animate: (custom: { x: number; y: number }) => ({
    opacity: [1, 1, 0, 1, 1],
    x: [0, 0, custom.x, 0, 0],
    y: [0, 0, custom.y, 0, 0],
    transition: {
      duration: 2.6,
      ease: "easeInOut",
      repeat: Infinity,
      times: [0, 0.18, 0.28, 0.38, 1],
    },
  }),
}

export function CursorClickIcon({
  className,
  size = 28,
  ...props
}: CursorClickIconProps) {
  const shouldReduceMotion = useReducedMotion()
  const animation = shouldReduceMotion ? "initial" : "animate"

  return (
    <div className={cn(className)} {...props}>
      <svg
        fill="none"
        height={size}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <motion.path
          animate={animation}
          d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"
          variants={CURSOR_VARIANTS}
        />
        <motion.path
          animate={animation}
          custom={{ x: 1, y: -1 }}
          d="M14 4.1 12 6"
          variants={LINE_VARIANTS}
        />
        <motion.path
          animate={animation}
          custom={{ x: -1, y: 0 }}
          d="m5.1 8-2.9-.8"
          variants={LINE_VARIANTS}
        />
        <motion.path
          animate={animation}
          custom={{ x: -1, y: 1 }}
          d="m6 12-1.9 2"
          variants={LINE_VARIANTS}
        />
        <motion.path
          animate={animation}
          custom={{ x: 0, y: -1 }}
          d="M7.2 2.2 8 5.1"
          variants={LINE_VARIANTS}
        />
      </svg>
    </div>
  )
}
