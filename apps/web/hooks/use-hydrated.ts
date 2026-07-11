"use client"

import { useSyncExternalStore } from "react"

// React compares these stable snapshots after hydration; no external store emits updates.
const subscribeToHydration = () => () => {}
const getHydratedSnapshot = () => true
const getServerSnapshot = () => false

export function useHydrated() {
  return useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerSnapshot
  )
}
