"use client"

import type { Transition } from "motion/react"
import { motion, useAnimation, useReducedMotion } from "motion/react"
import type { HTMLAttributes, MouseEvent } from "react"

import { cn } from "@/lib/utils"

interface CopyIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number
}

const DEFAULT_TRANSITION: Transition = {
  type: "spring",
  stiffness: 160,
  damping: 17,
  mass: 1,
}

export function CopyIcon({
  onMouseEnter,
  onMouseLeave,
  className,
  size = 28,
  ...props
}: CopyIconProps) {
  const controls = useAnimation()
  const shouldReduceMotion = useReducedMotion()

  function handleMouseEnter(event: MouseEvent<HTMLDivElement>) {
    if (!shouldReduceMotion) {
      void controls.start("animate")
    }
    onMouseEnter?.(event)
  }

  function handleMouseLeave(event: MouseEvent<HTMLDivElement>) {
    void controls.start("normal")
    onMouseLeave?.(event)
  }

  return (
    <div
      className={cn(className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
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
        <motion.rect
          animate={controls}
          height="14"
          rx="2"
          ry="2"
          transition={DEFAULT_TRANSITION}
          variants={{
            normal: { translateY: 0, translateX: 0 },
            animate: { translateY: -3, translateX: -3 },
          }}
          width="14"
          x="8"
          y="8"
        />
        <motion.path
          animate={controls}
          d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"
          transition={DEFAULT_TRANSITION}
          variants={{
            normal: { x: 0, y: 0 },
            animate: { x: 3, y: 3 },
          }}
        />
      </svg>
    </div>
  )
}
