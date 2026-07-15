import { absoluteUrl, CONTENT_SIGNAL } from "@/lib/seo"

export function GET() {
  return new Response(
    `User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: Claude-User
Allow: /

User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: *
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
