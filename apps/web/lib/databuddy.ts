import type { EventProperties } from "@databuddy/sdk"

export function trackDatabuddyEvent(
  eventName: string,
  properties?: EventProperties
) {
  void import("@databuddy/sdk")
    .then(({ track }) => {
      track(eventName, properties)
    })
    .catch(() => undefined)
}
