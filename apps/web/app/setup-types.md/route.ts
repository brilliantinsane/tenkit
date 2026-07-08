import { getSetupTypesMarkdown } from "@/lib/seo"

export function GET() {
  return new Response(getSetupTypesMarkdown(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
    },
  })
}
