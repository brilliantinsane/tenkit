"use client"

import type { ComponentProps } from "react"
import { motion } from "motion/react"
import { CheckIcon, CircleXIcon } from "lucide-react"

import { IconSwap, IconSwapItem } from "@/components/icon-swap"
import { Button } from "@/components/ui/button"
import { CopyIcon } from "@/components/ui/copy"
import type { CopyState } from "@/hooks/use-copy-to-clipboard"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { cn } from "@/lib/utils"

export type CopyStateIconProps = {
  state: CopyState
  idleIcon?: React.ReactNode
  doneIcon?: React.ReactNode
  errorIcon?: React.ReactNode
}

export function CopyStateIcon({
  state,
  idleIcon,
  doneIcon,
  errorIcon,
}: CopyStateIconProps) {
  return (
    <IconSwap>
      <IconSwapItem key={state} as={motion.span}>
        {state === "idle" &&
          (idleIcon ?? <CopyIcon data-slot="idle-icon" size={14} />)}
        {state === "done" && (doneIcon ?? <CheckIcon data-slot="done-icon" />)}
        {state === "error" &&
          (errorIcon ?? <CircleXIcon data-slot="error-icon" />)}
      </IconSwapItem>
    </IconSwap>
  )
}

export type CopyButtonProps = ComponentProps<typeof Button> & {
  text: string | (() => string)
  onCopySuccess?: (text: string) => void
  onCopyError?: (error: Error) => void
} & Omit<CopyStateIconProps, "state">

export function CopyButton({
  className,
  size = "icon",
  children,
  text,
  idleIcon,
  doneIcon,
  errorIcon,
  onClick,
  onCopySuccess,
  onCopyError,
  ...props
}: CopyButtonProps) {
  const { state, copy } = useCopyToClipboard({
    onCopySuccess,
    onCopyError,
  })

  return (
    <Button
      className={cn("will-change-transform", className)}
      size={size}
      onClick={(event) => {
        copy(text)
        onClick?.(event)
      }}
      aria-label="Copy"
      {...props}
    >
      <CopyStateIcon
        state={state}
        idleIcon={idleIcon}
        doneIcon={doneIcon}
        errorIcon={errorIcon}
      />
      {children}
    </Button>
  )
}
