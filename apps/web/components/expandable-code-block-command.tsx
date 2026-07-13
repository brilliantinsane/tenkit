"use client"

import { ChevronsDownIcon, ChevronsUpIcon } from "lucide-react"
import { motion } from "motion/react"
import { useState } from "react"

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
  copyDisabled = false,
}: {
  pnpm: string
  npm: string
  bun: string
  value: ConfiguratorPackageManager
  onValueChange: (packageManager: ConfiguratorPackageManager) => void
  copyDisabled?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const tabs = { pnpm, npm, bun }

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

        {CONFIGURATOR_PACKAGE_MANAGER_VALUES.map((packageManager) => (
          <TabsContent key={packageManager} value={packageManager}>
            <motion.div
              layout
              className="relative"
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <pre className="overflow-hidden p-4 pr-12 leading-6">
                <code
                  data-slot="code-block"
                  data-language="bash"
                  className={cn(
                    "block font-mono text-muted-foreground",
                    expanded
                      ? "text-sm/6 whitespace-pre-wrap"
                      : "truncate text-sm/none"
                  )}
                >
                  <span className="select-none">$ </span>
                  {expanded
                    ? formatConfiguratorCommandMultiline(tabs[packageManager])
                    : tabs[packageManager]}
                </code>
              </pre>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-2 bottom-2 size-6 rounded-md border-none [&_svg:not([class*='size-'])]:size-3.5"
                aria-label={
                  expanded ? "Collapse create command" : "Expand create command"
                }
                onClick={() => setExpanded((current) => !current)}
              >
                {expanded ? <ChevronsDownIcon /> : <ChevronsUpIcon />}
              </Button>
            </motion.div>
          </TabsContent>
        ))}
      </Tabs>

      <CommandActions
        packageManager={value}
        command={tabs[value]}
        copyDisabled={copyDisabled}
      />
    </div>
  )
}
