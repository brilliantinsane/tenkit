"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect } from "react"

import { SetupTypeStoriesSection } from "@/components/setup-type-stories-section"
import type { SetupTypeVisualPrototypeId } from "@/components/setup-type-visual-prototypes"
import { cn } from "@/lib/utils"

const prototypeVariants = ["topology", "router", "artifacts"] as const

const prototypeLabels = {
  topology: "A · Topology",
  router: "B · Router",
  artifacts: "C · Artifacts",
} satisfies Record<SetupTypeVisualPrototypeId, string>

function isPrototypeVariant(
  value: string | null
): value is SetupTypeVisualPrototypeId {
  return prototypeVariants.some((variant) => variant === value)
}

export function SetupTypesExperiment() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedVariant = searchParams.get("variant")
  const visualVariant = isPrototypeVariant(selectedVariant)
    ? selectedVariant
    : undefined

  const selectVariant = useCallback(
    (variant: SetupTypeVisualPrototypeId) => {
      const nextParams = new URLSearchParams(searchParams.toString())
      nextParams.set("variant", variant)
      router.replace(`${pathname}?${nextParams.toString()}#setup-types`, {
        scroll: false,
      })
    },
    [pathname, router, searchParams]
  )

  useEffect(() => {
    if (!visualVariant) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return

      const currentIndex = prototypeVariants.indexOf(visualVariant)
      const direction = event.key === "ArrowRight" ? 1 : -1
      const nextIndex =
        (currentIndex + direction + prototypeVariants.length) %
        prototypeVariants.length

      selectVariant(prototypeVariants[nextIndex])
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectVariant, visualVariant])

  if (process.env.NODE_ENV === "production" || !visualVariant) {
    return <SetupTypeStoriesSection />
  }

  return (
    <>
      <SetupTypeStoriesSection visualVariant={visualVariant} />
      <div className="fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
        <div
          role="toolbar"
          aria-label="Setup visual prototypes"
          className="flex items-center gap-1 rounded-full border bg-background/95 p-1.5 text-foreground shadow-xl backdrop-blur"
        >
          {prototypeVariants.map((variant) => (
            <button
              key={variant}
              type="button"
              aria-pressed={variant === visualVariant}
              onClick={() => selectVariant(variant)}
              className={cn(
                "h-8 rounded-full px-3 text-xs font-medium transition-colors",
                variant === visualVariant
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {prototypeLabels[variant]}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
