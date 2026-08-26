"use client"

import { CheckIcon } from "lucide-react"
import { type ReactNode, useId } from "react"

import { GlowingCard } from "@/components/glowing-card"
import { cn } from "@/lib/utils"

type ConfiguratorChoiceCardProps = {
  selected: boolean
  onSelect: () => void
  label: string
  detail?: string
  className?: string
}

const selectedChoiceIndicator = (
  <span
    aria-hidden="true"
    data-selected-indicator=""
    className="absolute top-3 right-3 z-30 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm"
  >
    <CheckIcon className="size-3" />
  </span>
)

function ChoiceCardContent({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <span className="block p-1.5">
      <span
        data-slot="configurator-choice-card-content"
        className={cn(
          "relative block rounded-lg bg-accent dark:bg-background",
          className
        )}
      >
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
  disabled = false,
  className,
}: ConfiguratorChoiceCardProps & { icon: ReactNode; disabled?: boolean }) {
  const detailId = useId()

  return (
    <GlowingCard
      as="button"
      type="button"
      aria-pressed={selected}
      aria-describedby={detail ? detailId : undefined}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "relative w-full cursor-pointer overflow-hidden rounded-xl border bg-card/80 text-center shadow-sm transition-[border-color,box-shadow,transform] active:translate-y-px disabled:cursor-default disabled:opacity-70",
        selected && "border-foreground",
        className
      )}
      backgroundClassName="rounded-[calc(var(--radius-xl)-1px)] bg-card/80"
    >
      {selected ? selectedChoiceIndicator : null}
      <ChoiceCardContent className="flex h-20 items-center p-3 lg:h-32 lg:justify-center">
        <ResponsiveIconChoiceCardContent
          selected={selected}
          label={label}
          detail={detail}
          icon={icon}
          detailId={detailId}
        />
      </ChoiceCardContent>
    </GlowingCard>
  )
}

function ResponsiveIconChoiceCardContent({
  selected,
  label,
  detail,
  icon,
  detailId,
}: {
  selected: boolean
  label: string
  detail?: string
  icon: ReactNode
  detailId: string
}) {
  return (
    <span className="flex min-w-0 gap-3 text-left lg:h-full lg:w-full lg:flex-col lg:items-center lg:justify-start lg:gap-1 lg:text-center">
      <span
        className={cn(
          "mb-2 grid size-9 shrink-0 place-items-center rounded-full transition-colors",
          selected
            ? "bg-primary/10 text-primary"
            : "bg-muted/45 text-foreground"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 lg:contents">
        <ChoiceCardCopy label={label} detail={detail} detailId={detailId} />
      </span>
    </span>
  )
}

function ChoiceCardCopy({
  label,
  detail,
  detailId,
}: {
  label: string
  detail?: string
  detailId: string
}) {
  return (
    <>
      <span className="block text-sm font-medium text-foreground">{label}</span>
      {detail ? (
        <span
          id={detailId}
          className="mt-1 block text-xs leading-4 text-muted-foreground lg:mt-0 lg:flex lg:min-h-8 lg:max-w-32 lg:items-start lg:justify-center"
        >
          {detail}
        </span>
      ) : null}
    </>
  )
}
