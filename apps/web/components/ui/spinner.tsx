"use client"

import { Loader2Icon } from "lucide-react"
import { cn } from "@/lib/utils"

export const Spinner = (props: React.ComponentProps<"svg">) => {
  const { "aria-label": ariaLabel, className, ...rest } = props

  return (
    <span
      aria-label={ariaLabel ?? "Loading"}
      className="inline-flex animate-spin"
      data-slot="spinner"
      role="status"
    >
      <Loader2Icon
        aria-hidden="true"
        className={cn("size-4", className)}
        {...rest}
      />
    </span>
  )
}
