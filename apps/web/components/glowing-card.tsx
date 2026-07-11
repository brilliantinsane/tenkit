"use client"

import { AnimatePresence, motion, useMotionValue } from "motion/react"
import {
  type ComponentPropsWithoutRef,
  type ElementType,
  type MouseEvent,
  type MouseEventHandler,
  type ReactNode,
  useRef,
  useState,
} from "react"

import { cn } from "@/lib/utils"

type GlowingCardProps<T extends ElementType = "div"> = {
  as?: T
  children: ReactNode
  className?: string
  backgroundClassName?: string
  contentClassName?: string
  glowClassName?: string
  onMouseEnter?: MouseEventHandler<HTMLElement>
  onMouseLeave?: MouseEventHandler<HTMLElement>
  onMouseMove?: MouseEventHandler<HTMLElement>
} & Omit<
  ComponentPropsWithoutRef<T>,
  | "as"
  | "children"
  | "className"
  | "onMouseEnter"
  | "onMouseLeave"
  | "onMouseMove"
>

export function GlowingCard<T extends ElementType = "div">({
  as,
  children,
  className,
  backgroundClassName,
  contentClassName,
  glowClassName,
  onMouseEnter,
  onMouseLeave,
  onMouseMove,
  ...rest
}: GlowingCardProps<T>) {
  const Component = (as ?? "div") as ElementType
  const cardRef = useRef<HTMLElement | null>(null)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const [showGlow, setShowGlow] = useState(false)

  function handleMouseMove(event: MouseEvent<HTMLElement>) {
    onMouseMove?.(event)

    const card = cardRef.current
    if (!card) return

    const rect = card.getBoundingClientRect()

    mouseX.set(event.clientX - rect.left)
    mouseY.set(event.clientY - rect.top)
  }

  return (
    <Component
      ref={cardRef}
      className={cn("relative overflow-hidden", className)}
      onMouseEnter={(event: MouseEvent<HTMLElement>) => {
        setShowGlow(true)
        onMouseEnter?.(event)
      }}
      onMouseLeave={(event: MouseEvent<HTMLElement>) => {
        setShowGlow(false)
        onMouseLeave?.(event)
      }}
      onMouseMove={handleMouseMove}
      {...rest}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-px z-10 rounded-[calc(var(--radius-lg)-1px)] bg-card/80",
          backgroundClassName
        )}
      />

      <AnimatePresence>
        {showGlow ? (
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "pointer-events-none absolute z-0 size-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#208AEF]/35 blur-2xl",
              glowClassName
            )}
            style={{ left: mouseX, top: mouseY }}
            transition={{ duration: 0.16 }}
          />
        ) : null}
      </AnimatePresence>

      <div className={cn("relative z-20", contentClassName)}>{children}</div>
    </Component>
  )
}
