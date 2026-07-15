"use client"

import { atomWithStorage } from "jotai/utils"
import { useAtom } from "jotai"

import {
  CommandActions,
  CommandTabsHeader,
  type PackageManager,
} from "@/components/command-block-primitives"
import { PnpmReleaseAgeNotice } from "@/components/pnpm-release-age-notice"
import { Tabs, TabsContent } from "@/components/tabs"
import { usePnpmReleaseCommand } from "@/hooks/use-pnpm-release-command"

const packageManagerAtom = atomWithStorage<PackageManager>(
  "tenkit:package-manager:v1",
  "pnpm"
)

const PACKAGE_MANAGERS = ["prompt", "pnpm", "yarn", "npm", "bun"] as const

function isPackageManager(value: string): value is PackageManager {
  return (
    value === "prompt" ||
    value === "pnpm" ||
    value === "yarn" ||
    value === "npm" ||
    value === "bun"
  )
}

export type CodeBlockCommandProps = {
  prompt?: string
  pnpm?: string
  yarn?: string
  npm?: string
  bun?: string
  onCopySuccess?: (data: {
    packageManager: PackageManager
    command: string
  }) => void
  onCopyError?: (error: Error) => void
}

export function CodeBlockCommand({
  prompt,
  pnpm,
  yarn,
  npm,
  bun,
  onCopySuccess,
  onCopyError,
}: CodeBlockCommandProps) {
  const [packageManager, setPackageManager] = useAtom(packageManagerAtom)
  const pnpmReleaseCommand = usePnpmReleaseCommand(pnpm)

  const tabs = {
    prompt,
    pnpm: pnpmReleaseCommand.command,
    yarn,
    npm,
    bun,
  } satisfies Record<PackageManager, string | undefined>
  const availablePackageManagers = PACKAGE_MANAGERS.filter((packageManager) =>
    Boolean(tabs[packageManager])
  )

  return (
    <div className="relative overflow-hidden rounded-xl bg-code">
      <Tabs
        className="gap-0"
        value={packageManager}
        onValueChange={(value) => {
          if (isPackageManager(value)) {
            setPackageManager(value)
          }
        }}
      >
        <CommandTabsHeader
          packageManager={packageManager}
          tabKeys={availablePackageManagers}
        />

        {availablePackageManagers.map((availablePackageManager) => {
          return (
            <TabsContent
              key={availablePackageManager}
              value={availablePackageManager}
            >
              <pre
                data-pm={availablePackageManager}
                className="group/tabs-content-pre overscroll-x-contain p-4 leading-6 not-data-[pm=prompt]:overflow-x-auto"
              >
                <code
                  data-slot="code-block"
                  data-language="bash"
                  className="font-mono text-sm/none text-muted-foreground group-data-[pm=prompt]/tabs-content-pre:whitespace-normal"
                >
                  <span className="select-none group-data-[pm=prompt]/tabs-content-pre:hidden">
                    ${" "}
                  </span>
                  {tabs[availablePackageManager]}
                </code>
              </pre>
            </TabsContent>
          )
        })}
      </Tabs>

      {packageManager === "pnpm" && pnpmReleaseCommand.isTemporarilyPinned ? (
        <PnpmReleaseAgeNotice />
      ) : null}

      <CommandActions
        packageManager={packageManager}
        command={tabs[packageManager] ?? ""}
        onCopySuccess={onCopySuccess}
        onCopyError={onCopyError}
      />
    </div>
  )
}
