"use client"

import { useSearchParams } from "next/navigation"

import { SetupTypeStoriesSection } from "@/components/setup-type-stories-section"

const prototypeVariants = new Set([
  "componentry",
  "topology",
  "load-balancer",
  "simple-flow",
])

export function SetupTypesExperiment() {
  const searchParams = useSearchParams()
  const selectedVariant = searchParams.get("variant")
  const showPrototype = prototypeVariants.has(selectedVariant ?? "")

  if (process.env.NODE_ENV === "production" || !showPrototype) {
    return <SetupTypeStoriesSection />
  }

  return <SetupTypeStoriesSection visualPrototype />
}
