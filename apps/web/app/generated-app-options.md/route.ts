import { getGeneratedAppOptionsMarkdown } from "@/lib/seo"

export function GET() {
  return new Response(getGeneratedAppOptionsMarkdown(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
    },
  })
}
