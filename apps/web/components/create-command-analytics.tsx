"use client"

import { createContext, use, type ReactNode } from "react"

import type { ConfiguratorState, ConfiguratorStyling } from "@/lib/configurator"

export type CreateCommandAnalyticsContext =
  | { surface: "landing" }
  | {
      surface: "configurator"
      setupType: ConfiguratorState["setupType"]
      styling: ConfiguratorStyling
      git: boolean
      install: boolean
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
