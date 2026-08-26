import type { Metadata } from "next"
import { notFound } from "next/navigation"
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page"

import { getMDXComponents } from "@/components/docs/mdx"
import { SITE_CONFIG, createPageMetadata } from "@/lib/seo"
import { source } from "@/lib/source"

type DocsPageProps = {
  params: Promise<{ slug?: string[] }>
}

function getDocsPage(slug: string[] | undefined) {
  const page = source.getPage(slug)

  if (!page) {
    notFound()
  }

  return page
}

export default async function DocsPageRoute({ params }: DocsPageProps) {
  const page = getDocsPage((await params).slug)
  const MDXContent = page.data.body

  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDXContent components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  )
}

export function generateStaticParams() {
  return source.generateParams()
}

export async function generateMetadata({
  params,
}: DocsPageProps): Promise<Metadata> {
  const page = getDocsPage((await params).slug)

  if (!page.data.description) {
    throw new Error(`Documentation page ${page.url} is missing a description.`)
  }

  return createPageMetadata({
    path: page.url,
    title: page.data.title,
    description: page.data.description,
    ogImage: SITE_CONFIG.ogImage,
    ogImageAlt: `Tenkit documentation: ${page.data.title}.`,
  })
}
