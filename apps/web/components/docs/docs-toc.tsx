import type { TableOfContents } from "fumadocs-core/toc"
import type { ReactNode } from "react"

export function DocsTableOfContents({ toc }: { toc: TableOfContents }) {
  if (toc.length === 0) return null

  return (
    <aside className="hidden xl:block">
      <div className="sticky top-24 border-l pl-5">
        <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          On this page
        </p>
        <nav aria-label="On this page" className="grid gap-2">
          {toc.map((item) => (
            <a
              className="text-sm leading-5 text-muted-foreground transition-colors hover:text-foreground"
              href={item.url}
              key={item.url}
              style={{
                paddingInlineStart: `${Math.max(item.depth - 2, 0) * 0.75}rem`,
              }}
            >
              {item.title as ReactNode}
            </a>
          ))}
        </nav>
      </div>
    </aside>
  )
}
