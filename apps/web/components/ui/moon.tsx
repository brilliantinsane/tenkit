"use client"

import type { Transition, Variants } from "motion/react"
import { motion, useAnimation, useReducedMotion } from "motion/react"
import type { HTMLAttributes, MouseEvent } from "react"

import { cn } from "@/lib/utils"

interface MoonIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number
}

const SVG_VARIANTS: Variants = {
  normal: {
    rotate: 0,
  },
  animate: {
    rotate: [0, -10, 10, -5, 5, 0],
  },
}

const SVG_TRANSITION: Transition = {
  duration: 1.2,
  ease: "easeInOut",
}

function MoonIcon({
  onMouseEnter,
  onMouseLeave,
  className,
  size = 28,
  ...props
}: MoonIconProps) {
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
      <motion.div
        animate={controls}
        transition={SVG_TRANSITION}
        variants={SVG_VARIANTS}
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
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      </motion.div>
    </div>
  )
}

export { MoonIcon }
