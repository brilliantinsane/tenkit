import { ImageResponse } from "next/og"

import { SocialCard } from "@/components/social-card"
import { CONFIGURE_PAGE_SEO, SITE_CONFIG } from "@/lib/seo"
import { getSocialCardBackground } from "@/lib/social-card-background"

export const alt = CONFIGURE_PAGE_SEO.ogImageAlt
export const size = {
  width: SITE_CONFIG.ogImageWidth,
  height: SITE_CONFIG.ogImageHeight,
}
export const contentType = SITE_CONFIG.ogImageType

export default async function OpenGraphImage() {
  return new ImageResponse(
    <SocialCard
      backgroundImage={await getSocialCardBackground()}
      label="CONFIGURE"
    />,
    size
  )
}
