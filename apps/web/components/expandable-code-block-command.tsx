"use client"

import { ChevronDownIcon } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import {
  CommandActions,
  CommandTabsHeader,
} from "@/components/command-block-primitives"
import { Tabs, TabsContent } from "@/components/tabs"
import { Button } from "@/components/ui/button"
import {
  CONFIGURATOR_PACKAGE_MANAGER_VALUES,
  formatConfiguratorCommandMultiline,
  type ConfiguratorPackageManager,
} from "@/lib/configurator"
import { cn } from "@/lib/utils"

export function ExpandableCodeBlockCommand({
  pnpm,
  npm,
  bun,
  value,
  onValueChange,
  expanded,
  onExpandedChange,
  copyDisabled = false,
}: {
  pnpm: string
  npm: string
  bun: string
  value: ConfiguratorPackageManager
  onValueChange: (packageManager: ConfiguratorPackageManager) => void
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  copyDisabled?: boolean
}) {
  const shouldReduceMotion = useReducedMotion()
  const tabs = { pnpm, npm, bun }
  const expansionTransition = {
    duration: shouldReduceMotion ? 0 : 0.24,
    ease: [0.22, 1, 0.36, 1] as const,
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-code">
      <Tabs
        className="gap-0"
        value={value}
        onValueChange={(nextValue) => {
          if (
            nextValue === "pnpm" ||
            nextValue === "npm" ||
            nextValue === "bun"
          ) {
            onValueChange(nextValue)
          }
        }}
      >
        <CommandTabsHeader
          packageManager={value}
          tabKeys={CONFIGURATOR_PACKAGE_MANAGER_VALUES}
        />

        {CONFIGURATOR_PACKAGE_MANAGER_VALUES.map((packageManager) => {
          const command = tabs[packageManager]
          const [launcher, ...flags] =
            formatConfiguratorCommandMultiline(command).split("\n")

          return (
            <TabsContent key={packageManager} value={packageManager}>
              <div className="relative">
                <pre className="overflow-hidden p-4 pr-12 leading-6">
                  <code
                    data-slot="code-block"
                    data-language="bash"
                    className="block font-mono text-muted-foreground"
                  >
                    <span
                      className={cn(
                        "block",
                        expanded
                          ? "text-sm/6 whitespace-pre-wrap"
                          : "truncate text-sm/none"
                      )}
                    >
                      <span className="select-none">$ </span>
                      {expanded ? launcher : command}
                    </span>
                    <span
                      data-slot="command-expansion"
                      data-expanded={expanded}
                      aria-hidden={!expanded}
                      className={cn(
                        "grid text-sm/6 transition-[grid-template-rows,opacity] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                        expanded
                          ? "grid-rows-[1fr] opacity-100 duration-300"
                          : "grid-rows-[0fr] opacity-0 duration-200"
                      )}
                    >
                      <span className="min-h-0 overflow-hidden">
                        <span className="block whitespace-pre-wrap">
                          {flags.join("\n")}
                        </span>
                      </span>
                    </span>
                  </code>
                </pre>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-2 right-2 size-6 rounded-md border-none [&_svg:not([class*='size-'])]:size-3.5"
                  aria-label={
                    expanded
                      ? "Collapse create command"
                      : "Expand create command"
                  }
                  aria-expanded={expanded}
                  onClick={() => onExpandedChange(!expanded)}
                >
                  <motion.span
                    data-slot="command-expand-icon"
                    className="inline-flex"
                    initial={false}
                    animate={{ rotate: expanded ? 180 : 0 }}
                    transition={expansionTransition}
                  >
                    <ChevronDownIcon />
                  </motion.span>
                </Button>
              </div>
            </TabsContent>
          )
        })}
      </Tabs>

      <CommandActions
        packageManager={value}
        command={tabs[value]}
        copyDisabled={copyDisabled}
      />
    </div>
  )
}
