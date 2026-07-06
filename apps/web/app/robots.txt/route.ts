import { absoluteUrl, CONTENT_SIGNAL } from "@/lib/seo"

export function GET() {
  return new Response(
    `User-agent: *
Allow: /

Sitemap: ${absoluteUrl("/sitemap.xml")}
Content-Signal: ${CONTENT_SIGNAL}
`,
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    }
  )
}
