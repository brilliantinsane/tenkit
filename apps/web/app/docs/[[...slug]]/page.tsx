import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { DocsTableOfContents } from "@/components/docs/docs-toc"
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
    <article className="animate-in duration-500 ease-out fill-mode-backwards fade-in slide-in-from-bottom-3 motion-reduce:animate-none">
      <header className="mb-10 max-w-3xl border-b pb-8">
        <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Tenkit documentation
        </p>
        <h1 className="font-heading text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
          {page.data.title}
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-pretty text-muted-foreground">
          {page.data.description}
        </p>
      </header>

      <div className="grid gap-12 xl:grid-cols-[minmax(0,1fr)_12rem] xl:gap-14">
        <div className="docs-prose max-w-3xl min-w-0">
          <MDXContent components={getMDXComponents()} />
        </div>
        <DocsTableOfContents toc={page.data.toc} />
      </div>
    </article>
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
