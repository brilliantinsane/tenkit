"use client"

import { HouseIcon, SlidersHorizontalIcon } from "lucide-react"
import { useDocsSearch } from "fumadocs-core/search/client"
import { fetchClient } from "fumadocs-core/search/client/fetch"
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogList,
  SearchDialogListItem,
  SearchDialogOverlay,
  type SearchItemType,
  useSearch,
} from "fumadocs-ui/components/dialog/search"
import type { SearchLink, SharedProps } from "fumadocs-ui/contexts/search"
import type { ReactNode } from "react"
import { useMemo } from "react"

const DEFAULT_SEARCH_LINKS: SearchLink[] = [
  ["Home", "/#top"],
  ["Configurator", "/configure"],
]

type TenkitSearchDialogProps = SharedProps & {
  api?: string
  delayMs?: number
  links?: SearchLink[]
  locale?: string
  tag?: string | string[]
}

function SearchInput() {
  const { search, onSearchChange } = useSearch()

  return (
    <input
      aria-label="Search"
      autoFocus
      className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus-visible:outline-none"
      onChange={(event) => onSearchChange(event.target.value)}
      placeholder="Search pages and sections..."
      value={search}
    />
  )
}

function renderSearchItem({
  item,
  onClick,
}: {
  item: SearchItemType
  onClick: () => void
}): ReactNode {
  if (item.type === "page" && item.id.startsWith("navigation:")) {
    const Icon = item.url === "/configure" ? SlidersHorizontalIcon : HouseIcon

    return (
      <SearchDialogListItem
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground data-[active=true]:bg-muted data-[active=true]:text-foreground"
        item={item}
        onClick={onClick}
      >
        <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
        <span>{item.content}</span>
      </SearchDialogListItem>
    )
  }

  return (
    <SearchDialogListItem
      className="rounded-xl px-3 py-2.5 text-sm data-[active=true]:bg-muted"
      item={item}
      onClick={onClick}
    />
  )
}

export function TenkitSearchDialog({
  api,
  delayMs,
  links = DEFAULT_SEARCH_LINKS,
  locale,
  onOpenChange,
  open,
  tag,
}: TenkitSearchDialogProps) {
  const { search, setSearch, query } = useDocsSearch({
    client: fetchClient({ api, locale, tag }),
    delayMs,
  })
  const defaultItems = useMemo(
    () =>
      links.map(([name, url]) => ({
        content: name,
        id: `navigation:${url}`,
        type: "page" as const,
        url,
      })),
    [links]
  )
  const showingDefaultLinks = query.data === "empty"

  return (
    <SearchDialog
      isLoading={query.isLoading}
      onOpenChange={onOpenChange}
      onSearchChange={setSearch}
      open={open}
      search={search}
    >
      <SearchDialogOverlay className="bg-foreground/20 supports-backdrop-filter:backdrop-blur-sm" />
      <SearchDialogContent className="top-1/2 max-w-[calc(100%-2rem)] -translate-y-1/2 rounded-2xl bg-popover p-2 text-popover-foreground shadow-xl ring-1 ring-foreground/5 sm:max-w-md md:top-1/2 dark:ring-foreground/10">
        <SearchDialogHeader className="gap-2 rounded-full bg-muted px-3 py-2">
          <SearchDialogIcon className="size-4" />
          <SearchInput />
          <SearchDialogClose className="sr-only" />
        </SearchDialogHeader>
        {showingDefaultLinks ? (
          <p className="px-3 pt-4 pb-1 text-xs font-medium text-muted-foreground">
            Navigate
          </p>
        ) : null}
        <SearchDialogList
          Item={renderSearchItem}
          items={query.data === "empty" ? defaultItems : query.data}
        />
      </SearchDialogContent>
    </SearchDialog>
  )
}
