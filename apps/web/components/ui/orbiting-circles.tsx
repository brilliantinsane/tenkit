import React from "react"

import { cn } from "@/lib/utils"

export interface OrbitingCirclesProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
  children?: React.ReactNode
  direction?: "clockwise" | "counterclockwise"
  duration?: number
  delay?: number
  radius?: number
  orbitPath?: "visible" | "hidden"
  iconSize?: number
  speed?: number
}

export function OrbitingCircles({
  className,
  children,
  direction = "clockwise",
  duration = 20,
  delay = 0,
  radius = 160,
  orbitPath = "visible",
  iconSize = 30,
  speed = 1,
  ...props
}: OrbitingCirclesProps) {
  const childrenArray = React.Children.toArray(children)
  const calculatedDuration = duration / speed

  return (
    <>
      {orbitPath === "visible" && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          version="1.1"
          className="pointer-events-none absolute inset-0 size-full"
        >
          <circle
            className="stroke-black/10 stroke-1 dark:stroke-white/10"
            cx="50%"
            cy="50%"
            r={radius}
            fill="none"
          />
        </svg>
      )}
      {childrenArray.map((child, index) => {
        const angle = (360 / childrenArray.length) * index

        return (
          <div
            key={React.isValidElement(child) ? child.key : index}
            style={
              {
                "--duration": calculatedDuration,
                "--delay": delay,
                "--radius": radius,
                "--angle": angle,
                "--icon-size": `${iconSize}px`,
              } as React.CSSProperties
            }
            className={cn(
              "absolute flex size-(--icon-size) transform-gpu animate-orbit items-center justify-center rounded-full [animation-delay:calc(var(--delay)*-1s)]",
              {
                "[animation-direction:reverse]":
                  direction === "counterclockwise",
              },
              className
            )}
            {...props}
          >
            {child}
          </div>
        )
      })}
    </>
  )
}
