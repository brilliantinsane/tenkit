import Link from "next/link"
import { CompassIcon, HomeIcon } from "lucide-react"

import { FullWidthDivider } from "@/components/full-width-divider"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"

export function NotFoundPage() {
  return (
    <div className="flex h-[calc(100svh-4rem)] w-full items-center justify-center overflow-hidden md:h-[calc(100svh-3.5rem)]">
      <div className="flex h-full items-center border-x">
        <div className="relative">
          <FullWidthDivider />
          <Empty>
            <EmptyHeader>
              <EmptyTitle className="font-mono text-8xl font-black">
                404
              </EmptyTitle>
              <EmptyDescription className="text-nowrap">
                The page you&apos;re looking for might have been <br />
                moved or doesn&apos;t exist.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <div className="flex gap-2">
                <Button asChild>
                  <Link href="/">
                    <HomeIcon data-icon="inline-start" />
                    Go Home
                  </Link>
                </Button>

                <Button asChild variant="outline">
                  <Link href="/#setup-types">
                    <CompassIcon data-icon="inline-start" />
                    Explore
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
