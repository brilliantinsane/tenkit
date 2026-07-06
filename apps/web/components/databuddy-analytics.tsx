"use client"

import dynamic from "next/dynamic"

const Databuddy = dynamic(
  () => import("@databuddy/sdk/react").then((module) => module.Databuddy),
  { ssr: false }
)

export function DatabuddyAnalytics() {
  return (
    <Databuddy
      clientId={process.env.NEXT_PUBLIC_DATABUDDY_CLIENT_ID!}
      disabled={process.env.NODE_ENV === "development"}
      trackOutgoingLinks
      trackWebVitals
      trackInteractions
    />
  )
}
