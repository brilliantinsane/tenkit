import type { EventProperties } from "@databuddy/sdk"

export const DATABUDDY_CLIENT_ID = process.env.NEXT_PUBLIC_DATABUDDY_CLIENT_ID

export const IS_DATABUDDY_TRACKING_ENABLED =
  process.env.NODE_ENV !== "development" && Boolean(DATABUDDY_CLIENT_ID)

export function trackDatabuddyEvent(
  eventName: string,
  properties?: EventProperties
) {
  if (!IS_DATABUDDY_TRACKING_ENABLED) {
    return
  }

  void import("@databuddy/sdk")
    .then(({ track }) => {
      track(eventName, properties)
    })
    .catch(() => undefined)
}
