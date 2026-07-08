import { getFaqMarkdown } from "@/lib/seo"

export function GET() {
  return new Response(getFaqMarkdown(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
    },
  })
}
