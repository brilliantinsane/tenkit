"use client"

import type { ReactNode } from "react"

import { GlowingCard } from "@/components/glowing-card"
import { cn } from "@/lib/utils"

type ConfiguratorChoiceCardProps = {
  selected: boolean
  onSelect: () => void
  label: string
  detail?: string
  className?: string
}

type ConfiguratorChoiceCardSurfaceProps = Pick<
  ConfiguratorChoiceCardProps,
  "selected" | "onSelect" | "className"
> & {
  children: ReactNode
  contentClassName: string
}

function ConfiguratorChoiceCardSurface({
  selected,
  onSelect,
  className,
  children,
  contentClassName,
}: ConfiguratorChoiceCardSurfaceProps) {
  const choiceClassName = cn(
    "relative h-20 w-full cursor-pointer overflow-hidden rounded-lg border text-center shadow-sm transition-[border-color,background-color,box-shadow,transform] active:translate-y-px",
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
        <span className={cn("relative h-full", contentClassName)}>
          {children}
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
      contentClassName={contentClassName}
      glowClassName="bg-primary/25"
    >
      {children}
    </GlowingCard>
  )
}

export function ConfiguratorChoiceCard({
  selected,
  onSelect,
  label,
  detail,
  className,
}: ConfiguratorChoiceCardProps) {
  return (
    <ConfiguratorChoiceCardSurface
      selected={selected}
      onSelect={onSelect}
      className={className}
      contentClassName="grid h-full place-items-center p-3"
    >
      <span className="flex w-full flex-col items-center justify-center px-2 text-center">
        <ChoiceCardCopy selected={selected} label={label} detail={detail} />
      </span>
    </ConfiguratorChoiceCardSurface>
  )
}

export function ConfiguratorIconChoiceCard({
  selected,
  onSelect,
  label,
  detail,
  icon,
  className,
}: ConfiguratorChoiceCardProps & { icon: ReactNode }) {
  return (
    <ConfiguratorChoiceCardSurface
      selected={selected}
      onSelect={onSelect}
      className={className}
      contentClassName="flex h-full items-center p-3"
    >
      <span className="flex min-w-0 gap-3 text-left">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full transition-colors",
            selected
              ? "bg-primary/10 text-primary"
              : "bg-muted/45 text-foreground"
          )}
        >
          {icon}
        </span>
        <span className="min-w-0">
          <ChoiceCardCopy selected={selected} label={label} detail={detail} />
        </span>
      </span>
    </ConfiguratorChoiceCardSurface>
  )
}

function ChoiceCardCopy({
  selected,
  label,
  detail,
}: Pick<ConfiguratorChoiceCardProps, "selected" | "label" | "detail">) {
  return (
    <>
      <span className="block text-sm font-medium text-foreground">{label}</span>
      {detail ? (
        <span
          className={cn(
            "mt-1 block text-xs leading-4",
            selected ? "text-foreground/70" : "text-muted-foreground"
          )}
        >
          {detail}
        </span>
      ) : null}
    </>
  )
}
