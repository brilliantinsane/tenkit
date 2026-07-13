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

function ChoiceCardContent({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <span className="block p-1.5">
      <span className={cn("relative block rounded-lg bg-code", className)}>
        {children}
      </span>
    </span>
  )
}

export function ConfiguratorCodeResponsiveIconChoiceCard({
  selected,
  onSelect,
  label,
  detail,
  icon,
  className,
}: ConfiguratorChoiceCardProps & { icon: ReactNode }) {
  return (
    <GlowingCard
      as="button"
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "relative w-full cursor-pointer overflow-hidden rounded-xl border bg-card/80 text-center shadow-sm transition-[border-color,box-shadow,transform] active:translate-y-px",
        selected && "border-primary/30",
        className
      )}
      backgroundClassName={cn(
        "rounded-[calc(var(--radius-xl)-1px)]",
        selected ? "bg-primary/5" : "bg-card/80"
      )}
      glowClassName="bg-primary/25"
    >
      <ChoiceCardContent
        className={cn(
          "flex h-20 items-center p-3 lg:h-32 lg:justify-center",
          selected &&
            "bg-[color-mix(in_oklab,var(--code)_96%,var(--primary)_4%)]"
        )}
      >
        <ResponsiveIconChoiceCardContent
          selected={selected}
          label={label}
          detail={detail}
          icon={icon}
        />
      </ChoiceCardContent>
    </GlowingCard>
  )
}

export function ConfiguratorCodeResponsiveComingSoonIconChoiceCard({
  label,
  icon,
  className,
}: {
  label: string
  icon: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      disabled
      className={cn(
        "relative w-full cursor-not-allowed overflow-hidden rounded-xl border bg-card/80 text-center opacity-60 shadow-sm",
        className
      )}
    >
      <ChoiceCardContent className="flex h-20 items-center p-3 lg:h-32 lg:justify-center">
        <ResponsiveIconChoiceCardContent
          selected={false}
          label={label}
          detail="Coming soon"
          icon={icon}
        />
      </ChoiceCardContent>
    </button>
  )
}

function ResponsiveIconChoiceCardContent({
  selected,
  label,
  detail,
  icon,
}: {
  selected: boolean
  label: string
  detail?: string
  icon: ReactNode
}) {
  return (
    <span className="flex min-w-0 gap-3 text-left lg:flex-col lg:items-center lg:gap-2 lg:text-center">
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
  )
}

function ChoiceCardCopy({
  selected,
  label,
  detail,
}: {
  selected: boolean
  label: string
  detail?: string
}) {
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
