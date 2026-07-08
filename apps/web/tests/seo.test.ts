import { describe, expect, test } from "vitest"

import { GET as getCommandsRoute } from "@/app/commands.md/route"
import { GET as getFaqRoute } from "@/app/faq.md/route"
import { GET as getIndexRoute } from "@/app/index.md/route"
import { GET as getLlmsFullRoute } from "@/app/llms-full.txt/route"
import { GET as getLlmsRoute } from "@/app/llms.txt/route"
import { GET as getSetupTypesRoute } from "@/app/setup-types.md/route"
import { FAQ_ITEMS, SETUP_TYPES } from "@/constants/landing"
import { rootMetadata } from "@/lib/site-metadata"
import {
  absoluteUrl,
  CONTENT_SIGNAL,
  EXTERNAL_TENKIT_SURFACES,
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
        alt: SITE_CONFIG.ogImageAlt,
      },
    ])
    expect(rootMetadata.twitter?.images).toEqual([
      "https://www.tenkit.dev/og-image.png",
    ])
  })

  test("uses the product description across web and social metadata", () => {
    expect(SITE_CONFIG.description).toBe(
      "Build one mobile app with Expo and ship it as many branded apps from a shared codebase."
    )
    expect(rootMetadata.description).toBe(SITE_CONFIG.description)
    expect(rootMetadata.openGraph?.description).toBe(SITE_CONFIG.description)
    expect(rootMetadata.twitter?.description).toBe(SITE_CONFIG.description)
  })

  test("uses brand-safe keywords for product and integration intent", () => {
    expect(rootMetadata.keywords).toEqual([
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
    expect(rootMetadata.keywords).not.toContain("multi-tenant Expo")
    expect(rootMetadata.keywords).not.toContain("white label apps")
    expect(rootMetadata.keywords).not.toContain("Expo app starter")
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

  test("publishes selected crawler Content-Signal policy", () => {
    expect(CONTENT_SIGNAL).toBe("ai-train=no, search=yes, ai-input=yes")
    expect(rootMetadata.other?.["Content-Signal"]).toBe(CONTENT_SIGNAL)
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
