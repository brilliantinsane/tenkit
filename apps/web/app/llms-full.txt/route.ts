import { getLlmsFullTxt } from "@/lib/seo"

export function GET() {
  return new Response(getLlmsFullTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  })
}
