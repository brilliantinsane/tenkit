import { readFile } from "node:fs/promises"
import { join } from "node:path"

const socialCardBackground = readFile(
  join(process.cwd(), "public", "og-image.png")
).then((image) => `data:image/png;base64,${image.toString("base64")}`)

export function getSocialCardBackground() {
  return socialCardBackground
}
