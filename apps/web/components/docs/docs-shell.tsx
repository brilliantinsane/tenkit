"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowUpRightIcon } from "lucide-react"
import type { ReactNode } from "react"

const docsLinks = [
  { href: "/docs", label: "Overview", shortLabel: "Overview" },
  {
    href: "/docs/setup-types",
    label: "Setup Types",
    shortLabel: "Setup Types",
  },
  {
    href: "/docs/generated-app-options",
    label: "Generated App Options",
    shortLabel: "App Options",
  },
  {
    href: "/docs/generated-project",
    label: "Generated Project",
    shortLabel: "Generated Project",
  },
  {
    href: "/docs/verification",
    label: "Verification",
    shortLabel: "Verification",
  },
] as const

function isActivePath(pathname: string, href: string) {
  return href === "/docs" ? pathname === href : pathname.startsWith(href)
}

function DocsNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname()

  return (
    <nav
      aria-label={mobile ? "Documentation mobile" : "Documentation"}
      className={mobile ? "flex gap-1" : "grid gap-1"}
    >
      {docsLinks.map((link) => {
        const active = isActivePath(pathname, link.href)

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={
              mobile
                ? "shrink-0 rounded-lg border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-muted hover:text-foreground aria-[current=page]:border-foreground/20 aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
                : "group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-[current=page]:bg-foreground aria-[current=page]:text-background"
            }
            href={link.href}
            key={link.href}
          >
            <span>{mobile ? link.shortLabel : link.label}</span>
            {!mobile ? (
              <ArrowUpRightIcon
                aria-hidden="true"
                className="size-3.5 opacity-0 transition-opacity group-hover:opacity-60 group-aria-[current=page]:opacity-60"
              />
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}

export function DocsShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-7 pb-20 sm:px-6 sm:pt-10">
      <div className="mb-5 overflow-x-auto lg:hidden">
        <DocsNavigation mobile />
      </div>

      <div className="grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl border bg-card/60 p-2 shadow-sm backdrop-blur-sm">
            <div className="px-3 py-3">
              <p className="font-heading text-base font-semibold tracking-tight">
                Tenkit Docs
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                The project generation handbook.
              </p>
            </div>
            <DocsNavigation />
            <div className="mt-5 border-t px-3 pt-4 pb-2">
              <p className="text-xs leading-5 text-muted-foreground">
                Start with the Configurator, then carry the command into your
                generated project.
              </p>
              <Link
                className="mt-3 inline-flex items-center text-xs font-semibold text-foreground underline-offset-4 hover:underline"
                href="/configure"
              >
                Open Configurator
                <ArrowUpRightIcon aria-hidden="true" className="ml-1 size-3" />
              </Link>
            </div>
          </div>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  )
}
