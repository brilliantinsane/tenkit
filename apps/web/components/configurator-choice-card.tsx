"use client"

import type { ReactNode } from "react"

import { GlowingCard } from "@/components/glowing-card"
import { cn } from "@/lib/utils"

type ConfiguratorChoiceCardProps = {
  selected: boolean
  onSelect: () => void
  label: string
  detail?: string
  icon?: ReactNode
  className?: string
}

export function ConfiguratorChoiceCard({
  selected,
  onSelect,
  label,
  detail,
  icon,
  className,
}: ConfiguratorChoiceCardProps) {
  const content = (
    <span
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-2 text-center",
        icon ? "pt-1" : "px-2"
      )}
    >
      {icon ? (
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full border transition-colors",
            selected
              ? "border-primary/25 bg-primary/10 text-primary"
              : "bg-muted/45 text-foreground"
          )}
        >
          {icon}
        </span>
      ) : null}
      <span className="flex w-full flex-col items-center justify-center">
        <span className="block text-sm font-medium text-foreground">
          {label}
        </span>
        {detail ? (
          <span
            className={cn(
              "mt-1 block max-w-[14rem] text-xs leading-5",
              selected ? "text-foreground/70" : "text-muted-foreground"
            )}
          >
            {detail}
          </span>
        ) : null}
      </span>
    </span>
  )

  const choiceClassName = cn(
    "relative h-36 w-full cursor-pointer overflow-hidden rounded-lg border text-center shadow-sm transition-[border-color,background-color,box-shadow,transform] active:translate-y-px",
    className
  )

  if (selected) {
    return (
      <button
        type="button"
        aria-pressed="true"
        onClick={onSelect}
        className={cn(
          choiceClassName,
          "border-primary/25 bg-primary/5 ring-1 ring-primary/15 hover:border-primary/35 hover:bg-primary/10"
        )}
      >
        <span className="pointer-events-none absolute inset-px rounded-[calc(var(--radius-lg)-1px)] bg-primary/5" />
        <span className="relative grid h-full place-items-center p-4">
          {content}
        </span>
      </button>
    )
  }

  return (
    <GlowingCard
      as="button"
      type="button"
      aria-pressed="false"
      onClick={onSelect}
      className={cn(
        choiceClassName,
        "border-border bg-card/65 hover:bg-card/80"
      )}
      backgroundClassName="bg-card/80"
      contentClassName="grid h-full place-items-center p-4"
      glowClassName="bg-primary/25"
    >
      {content}
    </GlowingCard>
  )
}
