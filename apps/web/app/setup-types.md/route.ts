import { getSetupTypesMarkdown } from "@/lib/seo"

export const dynamic = "force-static"

export function GET() {
  return new Response(getSetupTypesMarkdown(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
    },
  })
}
