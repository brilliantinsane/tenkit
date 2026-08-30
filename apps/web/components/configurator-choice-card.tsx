"use client"

import { AlertTriangleIcon, CheckIcon } from "lucide-react"
import { type ReactNode, useId } from "react"

import { GlowingCard } from "@/components/glowing-card"
import { cn } from "@/lib/utils"

type ConfiguratorChoiceCardProps = {
  selected: boolean
  onSelect: () => void
  label: string
  detail?: string
  notice?: string
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
  notice,
  icon,
  disabled = false,
  className,
}: ConfiguratorChoiceCardProps & { icon: ReactNode; disabled?: boolean }) {
  const detailId = useId()
  const noticeId = useId()
  const describedBy = [
    detail ? detailId : undefined,
    notice ? noticeId : undefined,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <GlowingCard
      as="button"
      type="button"
      aria-pressed={selected}
      aria-describedby={describedBy || undefined}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "relative h-full w-full cursor-pointer overflow-hidden rounded-xl border bg-card/80 text-center shadow-sm transition-[border-color,box-shadow,transform] active:translate-y-px disabled:cursor-default disabled:opacity-70",
        selected && "border-foreground",
        notice && "border-amber-500/30 hover:border-amber-500/50",
        className
      )}
      backgroundClassName={cn(
        "rounded-[calc(var(--radius-xl)-1px)] bg-card/80",
        notice && "bg-amber-500/5 dark:bg-amber-500/5"
      )}
      glowClassName={notice ? "bg-amber-500/25" : undefined}
    >
      {selected ? selectedChoiceIndicator : null}
      <ChoiceCardContent
        className={cn(
          "flex h-full min-h-20 items-center p-3 lg:min-h-32 lg:justify-center",
          notice && "min-h-28 lg:min-h-40"
        )}
      >
        <ResponsiveIconChoiceCardContent
          selected={selected}
          label={label}
          detail={detail}
          notice={notice}
          icon={icon}
          detailId={detailId}
          noticeId={noticeId}
        />
      </ChoiceCardContent>
    </GlowingCard>
  )
}

function ResponsiveIconChoiceCardContent({
  selected,
  label,
  detail,
  notice,
  icon,
  detailId,
  noticeId,
}: {
  selected: boolean
  label: string
  detail?: string
  notice?: string
  icon: ReactNode
  detailId: string
  noticeId: string
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
        <ChoiceCardCopy
          label={label}
          detail={detail}
          notice={notice}
          detailId={detailId}
          noticeId={noticeId}
        />
      </span>
    </span>
  )
}

function ChoiceCardCopy({
  label,
  detail,
  notice,
  detailId,
  noticeId,
}: {
  label: string
  detail?: string
  notice?: string
  detailId: string
  noticeId: string
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
      {notice ? (
        <span className="mt-2 flex items-start gap-1.5 text-xs leading-4 text-amber-700 lg:max-w-40 lg:justify-center dark:text-amber-400">
          <AlertTriangleIcon
            aria-hidden="true"
            className="mt-0.5 size-3 shrink-0"
          />
          <span id={noticeId}>{notice}</span>
        </span>
      ) : null}
    </>
  )
}
