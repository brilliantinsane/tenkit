"use client"

import { createContext, use, type ReactNode } from "react"

import type { ConfiguratorState, ConfiguratorStyling } from "@/lib/configurator"
import type { GeneratedAppOptions } from "@tenkit/types/generated-app-option-definitions"

export type CreateCommandAnalyticsContext =
  | { surface: "landing" }
  | {
      surface: "configurator"
      setupType: ConfiguratorState["setupType"]
      styling: ConfiguratorStyling
      generatedAppOptions: GeneratedAppOptions
      git: boolean
      install: boolean
      projectNameCustomized: boolean
    }

const CreateCommandAnalyticsContext =
  createContext<CreateCommandAnalyticsContext | null>(null)

export function CreateCommandAnalyticsProvider({
  value,
  children,
}: {
  value: CreateCommandAnalyticsContext
  children: ReactNode
}) {
  return (
    <CreateCommandAnalyticsContext value={value}>
      {children}
    </CreateCommandAnalyticsContext>
  )
}

export function useCreateCommandAnalytics(): CreateCommandAnalyticsContext {
  const analytics = use(CreateCommandAnalyticsContext)

  if (!analytics) {
    throw new Error(
      "useCreateCommandAnalytics must be used inside CreateCommandAnalyticsProvider."
    )
  }

  return analytics
}
