"use client"

import { useSyncExternalStore } from "react"

import {
  PNPM_LATEST_SAFE_AT,
  resolvePnpmReleaseCommand,
} from "@/lib/pnpm-release-command"

function subscribeToPnpmReleaseMaturity(onMature: () => void) {
  const remainingMs = PNPM_LATEST_SAFE_AT - Date.now()

  if (remainingMs <= 0) {
    return () => undefined
  }

  const timeout = window.setTimeout(onMature, remainingMs + 1)

  return () => window.clearTimeout(timeout)
}

function isPnpmReleaseMature() {
  return Date.now() >= PNPM_LATEST_SAFE_AT
}

function getServerPnpmReleaseMaturity() {
  return false
}

export function usePnpmReleaseCommand(command?: string) {
  const isMature = useSyncExternalStore(
    subscribeToPnpmReleaseMaturity,
    isPnpmReleaseMature,
    getServerPnpmReleaseMaturity
  )

  if (!command) {
    return {
      command,
      isTemporarilyPinned: false,
    }
  }

  return resolvePnpmReleaseCommand(
    command,
    isMature ? PNPM_LATEST_SAFE_AT : PNPM_LATEST_SAFE_AT - 1
  )
}
