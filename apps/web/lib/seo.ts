import type { Graph } from "schema-dts"

import { GITHUB_REPO_URL, NPM_PACKAGE_URL } from "@/constants/globals"
import { FAQ_ITEMS, SETUP_TYPES } from "@/constants/landing"

export const SITE_CONFIG = {
  name: "Tenkit",
  url: "https://tenkit.dev",
  title: "Tenkit - Multi-tenant mobile app starter kit",
  titleTemplate: "%s | Tenkit",
  description:
    "Build one mobile app with Expo and ship it as many branded apps from a shared codebase.",
  applicationName: "Tenkit",
  author: {
    name: "Tenkit",
    url: GITHUB_REPO_URL,
  },
  publisher: "Tenkit",
  creator: "Tenkit",
  ogImage: "/og-image.png",
  ogImageAlt:
    "Tenkit preview image for multi-tenant Expo setup types and generated app workflows.",
  keywords: [
    "Expo",
    "React Native",
    "Expo Router",
    "multi-tenant Expo",
    "white label apps",
    "App Variant",
    "Runtime Tenant",
    "Setup Type",
    "create-tenkit",
    "EAS Project",
    "Build Preparation",
  ],
} as const

export const MARKDOWN_MIRRORS = [
  {
    path: "/index.md",
    title: "Tenkit overview",
    description: "Landing-page summary for Tenkit and its project boundary.",
  },
  {
    path: "/setup-types.md",
    title: "Tenkit Setup Types",
    description: "The supported App Variant and Runtime Tenant models.",
  },
  {
    path: "/commands.md",
    title: "Tenkit commands",
    description: "Create and verification commands for the Public CLI.",
  },
  {
    path: "/faq.md",
    title: "Tenkit FAQ",
    description: "Frequently asked questions from the landing page.",
  },
] as const

export const EXTERNAL_TENKIT_SURFACES = [
  {
    label: "GitHub repository",
    url: GITHUB_REPO_URL,
  },
  {
    label: "create-tenkit on npm",
    url: NPM_PACKAGE_URL,
  },
] as const

export const CREATE_COMMAND = "pnpm create tenkit@latest"

export const TENKIT_COMMANDS = [
  {
    command: CREATE_COMMAND,
    description: "Start the Public CLI create flow for a generated Tenkit app.",
  },
  {
    command: "pnpm verify -- --setup-type white-label",
    description:
      "Verify generated app dependency installation, TypeScript, and Expo config evaluation for the White Label Apps Template.",
  },
  {
    command: "pnpm test:proof",
    description:
      "Run generated app shape assertions for Tenkit Template proof tests.",
  },
] as const

export const CONTENT_SIGNAL = "ai-train=no, search=yes, ai-input=yes"

export function absoluteUrl(path = "/") {
  return new URL(path, SITE_CONFIG.url).toString()
}

export function ogImageUrl() {
  return absoluteUrl(SITE_CONFIG.ogImage)
}

function markdownList(items: readonly string[]) {
  return items.map((item) => `- ${item}`).join("\n")
}

function markdownLink(label: string, url: string) {
  return `[${label}](${url})`
}

export function getIndexMarkdown() {
  return `# Tenkit

${SITE_CONFIG.description}

Tenkit is focused on Expo project generation, native identity, setup data, and local Build Preparation. The Public Web App presents Setup Types and command examples, while the Public CLI owns project creation policy.

## Canonical URL

${SITE_CONFIG.url}/

## Primary Surfaces

${EXTERNAL_TENKIT_SURFACES.map(
  (surface) => `- ${markdownLink(surface.label, surface.url)}`
).join("\n")}

## Setup Types

${SETUP_TYPES.map(
  (setup) => `- ${setup.label}: ${setup.headline} ${setup.description}`
).join("\n")}
`
}

export function getSetupTypesMarkdown() {
  return `# Tenkit Setup Types

Setup Types describe the relationship between App Variants and Runtime Tenants.

${SETUP_TYPES.map(
  (setup) => `## ${setup.label}

Slug: \`${setup.slug}\`

${setup.headline}

${setup.description}

Examples:

${markdownList(setup.examples)}
`
).join("\n")}
`
}

export function getCommandsMarkdown() {
  return `# Tenkit Commands

Tenkit uses pnpm for package scripts and dependency management.

${TENKIT_COMMANDS.map(
  (item) => `## \`${item.command}\`

${item.description}
`
).join("\n")}
`
}

export function getFaqMarkdown() {
  return `# Tenkit FAQ

${FAQ_ITEMS.map(
  (item) => `## ${item.question}

${item.answer}
`
).join("\n")}
`
}

export function getLlmsTxt() {
  return `# Tenkit

> ${SITE_CONFIG.description}

Tenkit is an Expo-first toolkit for generated apps with explicit Setup Types, App Variants, Runtime Tenants, EAS Projects, and Build Preparation.

## Markdown Mirrors

${MARKDOWN_MIRRORS.map(
  (mirror) =>
    `- ${markdownLink(mirror.title, absoluteUrl(mirror.path))}: ${mirror.description}`
).join("\n")}

## External Surfaces

${EXTERNAL_TENKIT_SURFACES.map(
  (surface) => `- ${markdownLink(surface.label, surface.url)}`
).join("\n")}
`
}

export function getLlmsFullTxt() {
  return `# Tenkit Full Context

${getIndexMarkdown()}

${getSetupTypesMarkdown()}

${getCommandsMarkdown()}

${getFaqMarkdown()}
`
}

export function getLandingJsonLdGraph(): Graph {
  const homeUrl = absoluteUrl("/")
  const organizationId = `${SITE_CONFIG.url}/#organization`
  const websiteId = `${SITE_CONFIG.url}/#website`
  const softwareId = `${SITE_CONFIG.url}/#software`
  const faqId = `${SITE_CONFIG.url}/#faq`
  const setupTypesId = `${SITE_CONFIG.url}/#setup-types`
  const howToId = `${SITE_CONFIG.url}/#create-tenkit`

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: SITE_CONFIG.name,
        url: homeUrl,
        sameAs: [GITHUB_REPO_URL, NPM_PACKAGE_URL],
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: SITE_CONFIG.name,
        url: homeUrl,
        description: SITE_CONFIG.description,
        publisher: {
          "@id": organizationId,
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": softwareId,
        name: SITE_CONFIG.name,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "iOS, Android, Web",
        description: SITE_CONFIG.description,
        url: homeUrl,
        image: ogImageUrl(),
        installUrl: NPM_PACKAGE_URL,
        publisher: {
          "@id": organizationId,
        },
      },
      {
        "@type": "FAQPage",
        "@id": faqId,
        mainEntity: FAQ_ITEMS.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
      {
        "@type": "ItemList",
        "@id": setupTypesId,
        name: "Tenkit Setup Types",
        itemListElement: SETUP_TYPES.map((setup, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${homeUrl}#setup-types`,
          name: setup.label,
          description: setup.description,
        })),
      },
      {
        "@type": "HowTo",
        "@id": howToId,
        name: "Create a Tenkit project",
        description:
          "Generate a Tenkit Expo starter project with the Public CLI.",
        totalTime: "PT5M",
        tool: [
          {
            "@type": "HowToTool",
            name: "pnpm",
          },
        ],
        step: [
          {
            "@type": "HowToStep",
            name: "Run the create command",
            text: CREATE_COMMAND,
          },
          {
            "@type": "HowToStep",
            name: "Choose a Setup Type",
            text: "Select the App Variant and Runtime Tenant relationship model that matches your distribution plan.",
          },
          {
            "@type": "HowToStep",
            name: "Replace starter data",
            text: "Update generated App Variants, Runtime Tenants, native identity, EAS Project values, and Build Preparation inputs.",
          },
        ],
      },
    ],
  }
}
