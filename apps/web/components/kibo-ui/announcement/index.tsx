import type { ComponentProps, HTMLAttributes } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type AnnouncementProps = ComponentProps<typeof Badge> & {
  tone?: "default" | "themed"
}

export const Announcement = ({
  variant = "outline",
  tone = "default",
  className,
  ...props
}: AnnouncementProps) => (
  <Badge
    className={cn(
      "group h-auto max-w-full gap-2 overflow-visible rounded-full bg-background px-3 py-0.5 font-medium shadow-sm transition-all",
      "hover:shadow-md",
      tone === "themed" && "announcement-themed border-foreground/5",
      className
    )}
    variant={variant}
    {...props}
  />
)

export type AnnouncementTagProps = HTMLAttributes<HTMLDivElement>

export const AnnouncementTag = ({
  className,
  ...props
}: AnnouncementTagProps) => (
  <div
    className={cn(
      "-ml-2.5 shrink-0 truncate rounded-full bg-foreground/5 px-2.5 py-1 text-xs",
      "group-[.announcement-themed]:bg-background/60",
      className
    )}
    {...props}
  />
)

export type AnnouncementTitleProps = HTMLAttributes<HTMLDivElement>

export const AnnouncementTitle = ({
  className,
  ...props
}: AnnouncementTitleProps) => (
  <div
    className={cn("flex min-w-0 items-center gap-1 py-1", className)}
    {...props}
  />
)
