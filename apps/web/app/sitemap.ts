import type { MetadataRoute } from "next"

import {
  absoluteUrl,
  CONFIGURE_PAGE_SEO,
  INDEXABLE_DOCS_ROUTES,
} from "@/lib/seo"

const SITEMAP_LAST_MODIFIED = new Date("2026-08-26")

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: absoluteUrl("/"),
      lastModified: SITEMAP_LAST_MODIFIED,
    },
    {
      url: absoluteUrl(CONFIGURE_PAGE_SEO.path),
      lastModified: SITEMAP_LAST_MODIFIED,
    },
    ...INDEXABLE_DOCS_ROUTES.map((path) => ({
      url: absoluteUrl(path),
      lastModified: SITEMAP_LAST_MODIFIED,
    })),
  ]
}
