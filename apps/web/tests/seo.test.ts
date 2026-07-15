import { describe, expect, test } from "vitest"

import { GET as getCommandsRoute } from "@/app/commands.md/route"
import { GET as getFaqRoute } from "@/app/faq.md/route"
import { GET as getIndexRoute } from "@/app/index.md/route"
import { GET as getLlmsFullRoute } from "@/app/llms-full.txt/route"
import { GET as getLlmsRoute } from "@/app/llms.txt/route"
import { GET as getSetupTypesRoute } from "@/app/setup-types.md/route"
import { GET as getRobotsRoute } from "@/app/robots.txt/route"
import sitemap from "@/app/sitemap"
import { FAQ_ITEMS, SETUP_TYPES } from "@/constants/landing"
import { rootMetadata } from "@/lib/site-metadata"
import {
  absoluteUrl,
  CONFIGURE_PAGE_SEO,
  CONTENT_SIGNAL,
  createPageMetadata,
  EXTERNAL_TENKIT_SURFACES,
  getCommandsMarkdown,
  getIndexMarkdown,
  getLandingJsonLdGraph,
  getLlmsFullTxt,
  getLlmsTxt,
  MARKDOWN_MIRRORS,
  ogImageUrl,
  SITE_CONFIG,
} from "@/lib/seo"

type JsonLdNode = {
  "@type": string
  "@id": string
}

describe("Tenkit Public Web App SEO", () => {
  test("uses www.tenkit.dev as the canonical URL", () => {
    expect(SITE_CONFIG.url).toBe("https://www.tenkit.dev")
    expect(absoluteUrl("/")).toBe("https://www.tenkit.dev/")
    expect(rootMetadata.metadataBase.toString()).toBe("https://www.tenkit.dev/")
    expect(rootMetadata.alternates?.canonical).toBe("/")
  })

  test("points Open Graph and Twitter metadata at the static OG image", () => {
    expect(SITE_CONFIG.ogImage).toBe("/og-image.png")
    expect(ogImageUrl()).toBe("https://www.tenkit.dev/og-image.png")
    expect(rootMetadata.openGraph?.images).toEqual([
      {
        url: "https://www.tenkit.dev/og-image.png",
        width: 1672,
        height: 941,
        alt: SITE_CONFIG.ogImageAlt,
      },
    ])
    expect(rootMetadata.twitter?.images).toEqual([
      "https://www.tenkit.dev/og-image.png",
    ])
  })

  test("uses the product description across web and social metadata", () => {
    expect(SITE_CONFIG.description).toBe(
      "Build multi-tenant mobile apps with Expo and React Native. Generate white-label App Variants, Runtime Tenants, and hybrid architectures from one codebase."
    )
    expect(rootMetadata.description).toBe(SITE_CONFIG.description)
    expect(rootMetadata.openGraph?.description).toBe(SITE_CONFIG.description)
    expect(rootMetadata.twitter?.description).toBe(SITE_CONFIG.description)
  })

  test("uses brand-safe keywords for product and integration intent", () => {
    expect(rootMetadata.keywords).toEqual([
      "multi-tenant apps built with Expo",
      "multi-tenant mobile apps using Expo",
      "multi tenant mobile app",
      "multi tenant app",
      "mobile app multi tenancy",
      "branded mobile apps",
      "multi-brand apps",
      "white-label mobile apps",
      "multi-tenant mobile apps",
      "shared mobile codebase",
      "React Native starter kit",
      "apps built with Expo",
      "React Native",
      "Expo",
      "Expo Router",
      "EAS Build",
      "EAS Project",
      "App Variant",
      "Runtime Tenant",
      "Setup Type",
      "create-tenkit",
      "Build Preparation",
    ])
  })

  test("gives Configure unique canonical and social metadata", () => {
    const metadata = createPageMetadata(CONFIGURE_PAGE_SEO)

    expect(metadata.title).toBe("Configure a Multi-Tenant App Built with Expo")
    expect(metadata.alternates.canonical).toBe("/configure")
    expect(metadata.openGraph.url).toBe("https://www.tenkit.dev/configure")
    expect(metadata.openGraph.description).toBe(CONFIGURE_PAGE_SEO.description)
    expect(metadata.twitter.description).toBe(CONFIGURE_PAGE_SEO.description)
  })

  test("keeps Expo descriptive and separate from the Tenkit product name", () => {
    expect(SITE_CONFIG.title).toBe(
      "Tenkit - Multi-Tenant Mobile Apps Built with Expo"
    )
    expect(SITE_CONFIG.title).not.toContain("Tenkit Expo")
    expect(CONFIGURE_PAGE_SEO.title).toContain("Built with Expo")
  })

  test("links every markdown mirror and external Tenkit surface from llms.txt", () => {
    const llmsTxt = getLlmsTxt()

    for (const mirror of MARKDOWN_MIRRORS) {
      expect(llmsTxt).toContain(absoluteUrl(mirror.path))
    }

    for (const surface of EXTERNAL_TENKIT_SURFACES) {
      expect(llmsTxt).toContain(surface.url)
    }
  })

  test("includes every Setup Type and FAQ item in llms-full.txt", () => {
    const llmsFullTxt = getLlmsFullTxt()

    for (const setup of SETUP_TYPES) {
      expect(llmsFullTxt).toContain(setup.label)
      expect(llmsFullTxt).toContain(setup.description)
    }

    for (const item of FAQ_ITEMS) {
      expect(llmsFullTxt).toContain(item.question)
      expect(llmsFullTxt).toContain(item.answer)
    }
  })

  test("documents every Styling Choice and Unistyles creation for humans and AI", () => {
    const indexMarkdown = getIndexMarkdown()
    const commandsMarkdown = getCommandsMarkdown()
    const llmsFullTxt = getLlmsFullTxt()

    for (const styling of ["Bare", "Uniwind", "Unistyles"]) {
      expect(indexMarkdown).toContain(styling)
      expect(llmsFullTxt).toContain(styling)
    }

    expect(commandsMarkdown).toContain(
      "pnpm create tenkit@latest --name unistyles-app --setup white-label --styling unistyles --yes"
    )
    expect(llmsFullTxt).toContain("--styling unistyles")
  })

  test("builds a JSON-LD graph with expected node types and stable IDs", () => {
    const graph = getLandingJsonLdGraph()
    const nodes = graph["@graph"] as readonly JsonLdNode[]

    expect(nodes.map((node) => node["@type"])).toEqual([
      "Organization",
      "WebSite",
      "SoftwareApplication",
      "FAQPage",
      "ItemList",
      "HowTo",
    ])

    expect(nodes.map((node) => node["@id"])).toEqual([
      "https://www.tenkit.dev/#organization",
      "https://www.tenkit.dev/#website",
      "https://www.tenkit.dev/#software",
      "https://www.tenkit.dev/#faq",
      "https://www.tenkit.dev/#setup-types",
      "https://www.tenkit.dev/#create-tenkit",
    ])
  })

  test("lists every indexable HTML route in the sitemap", () => {
    const entries = sitemap()

    expect(entries.map((entry) => entry.url)).toEqual([
      "https://www.tenkit.dev/",
      "https://www.tenkit.dev/configure",
    ])
    expect(
      entries.map((entry) => new Date(entry.lastModified ?? "").toISOString())
    ).toEqual(["2026-07-14T00:00:00.000Z", "2026-07-14T00:00:00.000Z"])
    expect(entries.every((entry) => entry.changeFrequency === undefined)).toBe(
      true
    )
    expect(entries.every((entry) => entry.priority === undefined)).toBe(true)
  })

  test("publishes selected crawler Content-Signal policy", () => {
    expect(CONTENT_SIGNAL).toBe("ai-train=no, search=yes, ai-input=yes")
    expect(rootMetadata.other?.["Content-Signal"]).toBe(CONTENT_SIGNAL)
  })

  test("allows AI search crawlers while keeping model training disabled", async () => {
    const robots = await getRobotsRoute().text()

    expect(robots).toContain("User-agent: OAI-SearchBot\nAllow: /")
    expect(robots).toContain("User-agent: ChatGPT-User\nAllow: /")
    expect(robots).toContain("User-agent: PerplexityBot\nAllow: /")
    expect(robots).toContain("User-agent: Claude-SearchBot\nAllow: /")
    expect(robots).toContain("User-agent: Claude-User\nAllow: /")
    expect(robots).toContain("User-agent: GPTBot\nDisallow: /")
    expect(robots).toContain("User-agent: ClaudeBot\nDisallow: /")
  })

  test("serves AI-readable route handlers with stable content types", async () => {
    const routes = [
      {
        response: getCommandsRoute(),
        contentType: "text/markdown; charset=utf-8",
      },
      { response: getFaqRoute(), contentType: "text/markdown; charset=utf-8" },
      {
        response: getIndexRoute(),
        contentType: "text/markdown; charset=utf-8",
      },
      { response: getLlmsRoute(), contentType: "text/plain; charset=utf-8" },
      {
        response: getLlmsFullRoute(),
        contentType: "text/plain; charset=utf-8",
      },
      {
        response: getSetupTypesRoute(),
        contentType: "text/markdown; charset=utf-8",
      },
    ]

    for (const route of routes) {
      expect(route.response.headers.get("Content-Type")).toBe(route.contentType)
      await expect(route.response.text()).resolves.toContain("Tenkit")
    }
  })
})
