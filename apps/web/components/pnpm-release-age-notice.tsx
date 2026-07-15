"use client"

import { InfoIcon } from "lucide-react"

import { PNPM_TEMPORARY_RELEASE_VERSION } from "@/lib/pnpm-release-command"

export function PnpmReleaseAgeNotice() {
  return (
    <p
      role="note"
      className="flex items-start gap-2 border-t border-warning/20 bg-warning/10 px-4 py-2.5 text-xs/5 text-warning-foreground"
    >
      <InfoIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <span>
        pnpm 11 may resolve the previous latest release during a new
        version&apos;s first 24 hours. This command temporarily pins Tenkit{" "}
        {`v${PNPM_TEMPORARY_RELEASE_VERSION}`}.
      </span>
    </p>
  )
}
