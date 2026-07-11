"use client"

import { useSetAtom } from "jotai"

import {
  Announcement,
  AnnouncementTag,
  AnnouncementTitle,
} from "@/components/kibo-ui/announcement"
import { CursorClickIcon } from "@/components/ui/cursor-click"
import {
  bumpConfiguratorNudge,
  configuratorNudgeAtom,
} from "@/lib/configurator-nudge"
import { cn } from "@/lib/utils"

export function HeroAnnouncement() {
  const setNudge = useSetAtom(configuratorNudgeAtom)

  return (
    <Announcement
      asChild
      className={cn(
        "mx-auto rounded-full bg-card p-1 pr-2",
        "animate-in transition-all delay-500 duration-500 ease-out fill-mode-backwards fade-in slide-in-from-bottom-3"
      )}
      tone="themed"
    >
      <button
        type="button"
        className="group"
        onClick={() => bumpConfiguratorNudge(setNudge)}
      >
        <AnnouncementTag className="ml-0 flex h-6 items-center rounded-full border border-[#208AEF]/35 bg-[#208AEF]/10 px-2 py-0 font-mono leading-none text-[#208AEF]">
          New
        </AnnouncementTag>
        <AnnouncementTitle className="h-6 items-center py-0 text-xs leading-none">
          Configure your create command
          <CursorClickIcon
            aria-hidden="true"
            className="inline-flex text-[#208AEF]/70"
            size={12}
          />
        </AnnouncementTitle>
      </button>
    </Announcement>
  )
}
