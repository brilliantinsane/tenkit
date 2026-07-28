"use client"

import { HomeIcon, RotateCcwIcon } from "lucide-react"
import Link from "next/link"

import { FullWidthDivider } from "@/components/full-width-divider"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"

export default function AppError({
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <div className="flex h-[calc(100svh-4rem)] w-full items-center justify-center overflow-hidden md:h-[calc(100svh-3.5rem)]">
      <div className="flex h-full items-center border-x">
        <div className="relative">
          <FullWidthDivider />
          <Empty>
            <EmptyHeader>
              <EmptyTitle className="font-mono text-8xl font-black">
                500
              </EmptyTitle>
              <EmptyDescription className="text-nowrap">
                Something went wrong while loading this page. <br />
                Try again or return home.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <div className="flex gap-2">
                <Button type="button" onClick={unstable_retry}>
                  <RotateCcwIcon data-icon="inline-start" />
                  Try Again
                </Button>

                <Button asChild variant="outline">
                  <Link href="/">
                    <HomeIcon data-icon="inline-start" />
                    Go Home
                  </Link>
                </Button>
              </div>
            </EmptyContent>
          </Empty>
          <FullWidthDivider />
        </div>
      </div>
    </div>
  )
}
