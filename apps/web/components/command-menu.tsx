"use client"

import { BookOpenIcon, HomeIcon, SearchIcon, Settings2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

const destinations = [
  {
    href: "/",
    icon: HomeIcon,
    label: "Home",
    keywords: "landing overview",
  },
  {
    href: "/configure",
    icon: Settings2Icon,
    label: "Configurator",
    keywords: "create setup project",
  },
  {
    href: "/docs",
    icon: BookOpenIcon,
    label: "Docs",
    keywords: "documentation choices backend auth database orm",
  },
] as const

export function CommandMenu() {
  const router = useRouter()
  const [commandOpen, setCommandOpen] = React.useState(false)

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setCommandOpen((currentOpen) => !currentOpen)
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  function navigate(href: string) {
    setCommandOpen(false)
    router.push(href)
  }

  return (
    <>
      <Button
        aria-label="Open command palette"
        onClick={() => setCommandOpen(true)}
        size="icon-sm"
        variant="ghost"
        className="hidden"
      >
        <SearchIcon />
      </Button>
      <CommandDialog
        description="Search pages and sections to navigate Tenkit."
        onOpenChange={setCommandOpen}
        open={commandOpen}
        title="Command Palette"
      >
        <Command>
          <CommandInput placeholder="Search pages and sections..." />
          <CommandList>
            <CommandEmpty>No matching destination.</CommandEmpty>
            <CommandGroup heading="Navigate">
              {destinations.map((destination) => {
                const Icon = destination.icon

                return (
                  <CommandItem
                    key={destination.href}
                    keywords={[destination.keywords]}
                    onSelect={() => navigate(destination.href)}
                    value={destination.label}
                  >
                    <Icon data-icon="inline-start" />
                    {destination.label}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
