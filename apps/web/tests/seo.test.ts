import { describe, expect, test } from "vitest"

import { dynamic as commandsDynamic } from "@/app/commands.md/route"
import { dynamic as faqDynamic } from "@/app/faq.md/route"
import { dynamic as indexDynamic } from "@/app/index.md/route"
import { dynamic as llmsFullDynamic } from "@/app/llms-full.txt/route"
import { dynamic as llmsDynamic } from "@/app/llms.txt/route"
import { dynamic as setupTypesDynamic } from "@/app/setup-types.md/route"
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
  test("uses tenkit.dev as the canonical URL", () => {
    expect(SITE_CONFIG.url).toBe("https://tenkit.dev")
    expect(absoluteUrl("/")).toBe("https://tenkit.dev/")
    expect(rootMetadata.metadataBase.toString()).toBe("https://tenkit.dev/")
    expect(rootMetadata.alternates?.canonical).toBe("/")
  })

  test("points Open Graph and Twitter metadata at the static OG image", () => {
    expect(SITE_CONFIG.ogImage).toBe("/og-image.png")
    expect(ogImageUrl()).toBe("https://tenkit.dev/og-image.png")
    expect(rootMetadata.openGraph?.images).toEqual([
      {
        url: "https://tenkit.dev/og-image.png",
        alt: SITE_CONFIG.ogImageAlt,
      },
    ])
    expect(rootMetadata.twitter?.images).toEqual([
      "https://tenkit.dev/og-image.png",
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
      "https://tenkit.dev/#organization",
      "https://tenkit.dev/#website",
      "https://tenkit.dev/#software",
      "https://tenkit.dev/#faq",
      "https://tenkit.dev/#setup-types",
      "https://tenkit.dev/#create-tenkit",
    ])
  })

  test("publishes selected crawler Content-Signal policy", () => {
    expect(CONTENT_SIGNAL).toBe("ai-train=no, search=yes, ai-input=yes")
    expect(rootMetadata.other?.["Content-Signal"]).toBe(CONTENT_SIGNAL)
  })

  test("renders static AI-readable routes as static Next routes", () => {
    expect([
      commandsDynamic,
      faqDynamic,
      indexDynamic,
      llmsDynamic,
      llmsFullDynamic,
      setupTypesDynamic,
    ]).toEqual([
      "force-static",
      "force-static",
      "force-static",
      "force-static",
      "force-static",
      "force-static",
    ])
  })
})
