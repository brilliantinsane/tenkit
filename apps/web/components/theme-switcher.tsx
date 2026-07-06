"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { trackDatabuddyEvent } from "@/lib/databuddy"

type ThemeSwitcherProps = {
  buttonClassName?: string
  buttonSize?: React.ComponentProps<typeof Button>["size"]
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
}

export function ThemeSwitcher({
  buttonClassName,
  buttonSize = "icon-sm",
  buttonVariant = "ghost",
}: ThemeSwitcherProps) {
  const { resolvedTheme, setTheme } = useTheme()

  const nextTheme = resolvedTheme === "dark" ? "light" : "dark"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={buttonVariant}
          size={buttonSize}
          className={buttonClassName}
          aria-label="Toggle theme"
          onClick={() => {
            trackDatabuddyEvent("theme_changed", {
              theme: nextTheme,
              previousTheme: resolvedTheme ?? "unknown",
            })
            setTheme(nextTheme)
          }}
        >
          <SunIcon
            data-icon="inline-start"
            className="hidden dark:block"
            aria-hidden="true"
          />
          <MoonIcon
            data-icon="inline-start"
            className="dark:hidden"
            aria-hidden="true"
          />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        Toggle theme
      </TooltipContent>
    </Tooltip>
  )
}
