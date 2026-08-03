import { ImageResponse } from "next/og"

import { SocialCard } from "@/components/social-card"
import { SITE_CONFIG } from "@/lib/seo"
import { getSocialCardBackground } from "@/lib/social-card-background"

export const alt = SITE_CONFIG.ogImageAlt
export const size = {
  width: SITE_CONFIG.ogImageWidth,
  height: SITE_CONFIG.ogImageHeight,
}
export const contentType = SITE_CONFIG.ogImageType

export default async function OpenGraphImage() {
  return new ImageResponse(
    <SocialCard backgroundImage={await getSocialCardBackground()} />,
    size
  )
}
