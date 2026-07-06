"use client"

import dynamic from "next/dynamic"

import {
  DATABUDDY_CLIENT_ID,
  IS_DATABUDDY_TRACKING_ENABLED,
} from "@/lib/databuddy"

const Databuddy = dynamic(
  () => import("@databuddy/sdk/react").then((module) => module.Databuddy),
  { ssr: false }
)

export function DatabuddyAnalytics() {
  return (
    <Databuddy
      clientId={DATABUDDY_CLIENT_ID}
      disabled={!IS_DATABUDDY_TRACKING_ENABLED}
      trackOutgoingLinks
      trackWebVitals
      trackInteractions
    />
  )
}
