import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { SITE_CONFIG } from "@/lib/seo"

export const alt = SITE_CONFIG.ogImageAlt
export const size = { width: 1672, height: 941 }
export const contentType = "image/png"

export default function OpenGraphImage() {
  return readFile(join(process.cwd(), "public", SITE_CONFIG.ogImage))
}
