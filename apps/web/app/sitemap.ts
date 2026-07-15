import type { MetadataRoute } from "next"

import { absoluteUrl, CONFIGURE_PAGE_SEO } from "@/lib/seo"

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: absoluteUrl("/"),
      lastModified: new Date("2026-07-14"),
    },
    {
      url: absoluteUrl(CONFIGURE_PAGE_SEO.path),
      lastModified: new Date("2026-07-14"),
    },
  ]
}
