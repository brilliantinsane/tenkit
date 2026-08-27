import type { ReactNode } from "react"
import { isValidElement } from "react"
import defaultMdxComponents from "fumadocs-ui/mdx"
import type { MDXComponents } from "mdx/types"

import { CodeBlockCommand } from "@/components/code-block-command"
import { CreateCommandAnalyticsProvider } from "@/components/create-command-analytics"

function getCodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(getCodeText).join("")
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return getCodeText(node.props.children)
  }
  return ""
}

function DocsCodeBlock({ children }: { children?: ReactNode }) {
  const command = getCodeText(children).trimEnd()

  if (!command) {
    throw new Error("Documentation code blocks must contain a command.")
  }

  return (
    <CreateCommandAnalyticsProvider value={{ surface: "docs" }}>
      <CodeBlockCommand pnpm={command} />
    </CreateCommandAnalyticsProvider>
  )
}

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    a: ({ className, ...props }) => (
      <a
        className={`font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground ${className ?? ""}`}
        {...props}
      />
    ),
    blockquote: ({ className, ...props }) => (
      <blockquote
        className={`my-6 border-l-2 border-foreground/20 pl-5 text-muted-foreground ${className ?? ""}`}
        {...props}
      />
    ),
    code: ({ className, ...props }) => (
      <code
        className={`rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground ${className ?? ""}`}
        {...props}
      />
    ),
    h2: ({ className, ...props }) => (
      <h2
        className={`mt-12 scroll-mt-24 font-heading text-2xl font-semibold tracking-tight first:mt-0 ${className ?? ""}`}
        {...props}
      />
    ),
    h3: ({ className, ...props }) => (
      <h3
        className={`mt-9 scroll-mt-24 font-heading text-xl font-semibold tracking-tight ${className ?? ""}`}
        {...props}
      />
    ),
    hr: ({ className, ...props }) => (
      <hr className={`my-10 border-border ${className ?? ""}`} {...props} />
    ),
    li: ({ className, ...props }) => (
      <li className={`leading-7 ${className ?? ""}`} {...props} />
    ),
    ol: ({ className, ...props }) => (
      <ol
        className={`my-5 list-decimal space-y-2 pl-6 marker:text-muted-foreground ${className ?? ""}`}
        {...props}
      />
    ),
    p: ({ className, ...props }) => (
      <p
        className={`my-5 leading-7 text-muted-foreground first:mt-0 last:mb-0 ${className ?? ""}`}
        {...props}
      />
    ),
    pre: DocsCodeBlock,
    strong: ({ className, ...props }) => (
      <strong
        className={`font-semibold text-foreground ${className ?? ""}`}
        {...props}
      />
    ),
    table: ({ className, ...props }) => (
      <div className="my-7 overflow-x-auto rounded-xl border">
        <table
          className={`w-full min-w-[32rem] border-collapse text-left text-sm ${className ?? ""}`}
          {...props}
        />
      </div>
    ),
    tbody: ({ className, ...props }) => (
      <tbody
        className={`divide-y divide-border ${className ?? ""}`}
        {...props}
      />
    ),
    td: ({ className, ...props }) => (
      <td className={`px-4 py-3 align-top ${className ?? ""}`} {...props} />
    ),
    th: ({ className, ...props }) => (
      <th
        className={`bg-muted/60 px-4 py-3 text-xs font-semibold tracking-wide uppercase ${className ?? ""}`}
        {...props}
      />
    ),
    thead: ({ className, ...props }) => (
      <thead className={className} {...props} />
    ),
    ul: ({ className, ...props }) => (
      <ul
        className={`my-5 list-disc space-y-2 pl-6 marker:text-muted-foreground ${className ?? ""}`}
        {...props}
      />
    ),
    ...components,
  } satisfies MDXComponents
}

export const useMDXComponents = getMDXComponents

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>
}
