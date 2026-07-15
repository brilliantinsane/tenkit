"use client"

import Link from "next/link"
import { useState } from "react"

import {
  Announcement,
  AnnouncementTag,
  AnnouncementTitle,
} from "@/components/kibo-ui/announcement"
import { CursorClickIcon } from "@/components/ui/cursor-click"
import { cn } from "@/lib/utils"

export function HeroAnnouncement() {
  const [cursorAnimation, setCursorAnimation] = useState<"idle" | "click">(
    "idle"
  )

  return (
    <Announcement
      asChild
      className={cn(
        "mx-auto rounded-full bg-card p-1 pr-2 transition-[translate,background-color,border-color,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "hover:-translate-y-px hover:border-foreground/10 hover:bg-muted/60",
        "focus-visible:-translate-y-px focus-visible:border-foreground/10 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-[#208AEF]/25 focus-visible:outline-none",
        "animate-in fill-mode-backwards [animation-delay:500ms] [animation-duration:500ms] fade-in slide-in-from-bottom-3"
      )}
      tone="themed"
    >
      <Link
        href="/configure"
        className="group"
        onMouseEnter={() => {
          setCursorAnimation("click")
        }}
        onMouseLeave={() => setCursorAnimation("idle")}
        onFocus={() => {
          setCursorAnimation("click")
        }}
        onBlur={() => setCursorAnimation("idle")}
      >
        <AnnouncementTag className="ml-0 flex h-6 items-center rounded-full border border-[#208AEF]/35 bg-[#208AEF]/10 px-2 py-0 font-mono leading-none text-[#208AEF]">
          New
        </AnnouncementTag>
        <AnnouncementTitle className="h-6 items-center py-0 text-xs leading-none">
          Configure your create command
          <CursorClickIcon
            aria-hidden="true"
            animation={cursorAnimation}
            className="inline-flex text-[#208AEF]/70 transition-colors duration-200 group-hover:text-[#208AEF] group-focus-visible:text-[#208AEF]"
            size={14}
          />
        </AnnouncementTitle>
      </Link>
    </Announcement>
  )
}
