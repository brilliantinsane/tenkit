"use client"

import { AnimatePresence, motion } from "motion/react"
import { ChevronsDownIcon, ChevronsUpIcon } from "lucide-react"

import { CopyButton } from "@/components/copy-button"
import { Button } from "@/components/ui/button"
import { formatConfiguratorCommandMultiline } from "@/lib/configurator"
import { cn } from "@/lib/utils"

type ConfiguratorCommandFooterProps = {
  command: string
  commandIsCopyable: boolean
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
}

const heroCopyButtonClassName =
  "size-6 rounded-md border-none [&_svg:not([class*='size-'])]:size-3.5"

export function ConfiguratorCommandFooter({
  command,
  commandIsCopyable,
  expanded,
  onExpandedChange,
}: ConfiguratorCommandFooterProps) {
  const formattedCommand = formatConfiguratorCommandMultiline(command)

  return (
    <div className="relative z-20 mt-auto shrink-0 border-t bg-muted/48">
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="expanded-command-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden bg-code"
          >
            <pre className="overflow-x-auto p-4 font-mono text-sm leading-6 text-code-foreground">
              <code className="whitespace-pre-wrap">{formattedCommand}</code>
            </pre>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex items-center gap-2 px-(--space) py-3">
        {!expanded ? (
          <code className="min-w-0 flex-1 truncate font-mono text-sm text-muted-foreground">
            {command}
          </code>
        ) : (
          <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
            Full create command
          </span>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={heroCopyButtonClassName}
          aria-label={
            expanded ? "Collapse create command" : "Expand create command"
          }
          disabled={!commandIsCopyable}
          onClick={() => onExpandedChange(!expanded)}
        >
          {expanded ? <ChevronsDownIcon /> : <ChevronsUpIcon />}
        </Button>

        <CopyButton
          className={cn(heroCopyButtonClassName)}
          variant="ghost"
          size="icon-sm"
          text={command}
          disabled={!commandIsCopyable}
        />
      </div>
    </div>
  )
}
