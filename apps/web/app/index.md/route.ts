import { getIndexMarkdown } from "@/lib/seo"

export const dynamic = "force-static"

export function GET() {
  return new Response(getIndexMarkdown(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
    },
  })
}
