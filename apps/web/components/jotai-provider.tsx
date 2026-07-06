"use client"

import type { ReactNode } from "react"
import { Provider } from "jotai"

export function JotaiProvider({ children }: { children: ReactNode }) {
  return <Provider>{children}</Provider>
}
