"use client"

import { motion, useAnimation, useReducedMotion } from "motion/react"
import type { HTMLAttributes, MouseEvent } from "react"

import { cn } from "@/lib/utils"

interface SettingsIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number
}

export function SettingsIcon({
  onMouseEnter,
  onMouseLeave,
  className,
  size = 28,
  ...props
}: SettingsIconProps) {
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
        transition={{ duration: 0.45, ease: "easeOut" }}
        variants={{
          normal: { rotate: 0 },
          animate: { rotate: 180 },
        }}
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
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </motion.div>
    </div>
  )
}
