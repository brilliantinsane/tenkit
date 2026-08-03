"use client"

import { useAtom } from "jotai"
import { atomWithStorage } from "jotai/utils"
import { useId } from "react"

import {
  CommandActions,
  CommandTabsHeader,
  type PackageManager,
} from "@/components/command-block-primitives"
import { Tabs, TabsContent } from "@/components/tabs"

const PACKAGE_MANAGER_STORAGE_KEY = "tenkit:package-manager:v1"
const packageManagerAtom = atomWithStorage<PackageManager>(
  PACKAGE_MANAGER_STORAGE_KEY,
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

function getPackageManagerInitScript(rootId: string) {
  return `(()=>{try{const root=document.getElementById(${JSON.stringify(rootId)});if(!root)return;const preferred=JSON.parse(localStorage.getItem(${JSON.stringify(PACKAGE_MANAGER_STORAGE_KEY)})??"null");if(typeof preferred!=="string")return;const elements=root.querySelectorAll("[data-package-manager-value]");let available=false;elements.forEach((element)=>{if(element.getAttribute("data-package-manager-value")===preferred)available=true});if(!available)return;elements.forEach((element)=>{const active=element.getAttribute("data-package-manager-value")===preferred;element.setAttribute("data-state",active?"active":"inactive");if(element.getAttribute("role")==="tab")element.setAttribute("aria-selected",String(active))})}catch{}})()`
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
  const rootId = useId()

  const tabs = {
    prompt,
    pnpm,
    yarn,
    npm,
    bun,
  } satisfies Record<PackageManager, string | undefined>
  const availablePackageManagers = PACKAGE_MANAGERS.filter((packageManager) =>
    Boolean(tabs[packageManager])
  )
  const selectedPackageManager = availablePackageManagers.includes(
    packageManager
  )
    ? packageManager
    : (availablePackageManagers[0] ?? "prompt")

  return (
    <>
      <div
        id={rootId}
        data-slot="code-block-command"
        className="relative overflow-hidden rounded-xl bg-accent dark:bg-background"
      >
        <Tabs
          className="gap-0"
          value={selectedPackageManager}
          onValueChange={(value) => {
            if (isPackageManager(value)) {
              setPackageManager(value)
            }
          }}
        >
          <CommandTabsHeader
            packageManager={selectedPackageManager}
            tabKeys={availablePackageManagers}
          />

          {availablePackageManagers.map((availablePackageManager) => {
            return (
              <TabsContent
                key={availablePackageManager}
                value={availablePackageManager}
                forceMount
                suppressHydrationWarning
                data-package-manager-value={availablePackageManager}
                className="data-[state=inactive]:hidden"
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

        <CommandActions
          packageManager={selectedPackageManager}
          command={tabs[selectedPackageManager] ?? ""}
          onCopySuccess={onCopySuccess}
          onCopyError={onCopyError}
        />
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: getPackageManagerInitScript(rootId),
        }}
      />
    </>
  )
}
