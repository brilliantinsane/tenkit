import { getLlmsTxt } from "@/lib/seo"

export const dynamic = "force-static"

export function GET() {
  return new Response(getLlmsTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  })
}
