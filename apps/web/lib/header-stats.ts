import { cacheLife } from "next/cache"

import { GITHUB_REPO_API, NPM_WEEKLY_DOWNLOADS_API } from "@/constants/globals"

const HEADER_STATS_FALLBACKS = {
  stars: 14,
  weeklyDownloads: 249,
}

export const HEADER_STATS_CACHE_PROFILE = "hours"

export const HEADER_STATS_FETCH_INIT = {
  headers: {
    Accept: "application/json",
  },
} satisfies RequestInit

export function formatCompactCount(value: number) {
  if (value < 1000) {
    return value.toLocaleString("en")
  }

  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: value < 10000 ? 1 : 0,
  }).format(value)
}

function readNumberField(json: unknown, field: string) {
  if (typeof json !== "object" || json === null || !(field in json)) {
    return null
  }

  const record = json as Record<string, unknown>
  const value = record[field]

  return typeof value === "number" && Number.isFinite(value) ? value : null
}

export async function fetchNumberField(
  url: string,
  field: string,
  fallback: number
) {
  try {
    const response = await fetch(url, HEADER_STATS_FETCH_INIT)

    if (!response.ok) {
      return fallback
    }

    const json: unknown = await response.json()
    return readNumberField(json, field) ?? fallback
  } catch {
    return fallback
  }
}

export async function fetchGitHubStarsLabel() {
  const stars = await fetchNumberField(
    GITHUB_REPO_API,
    "stargazers_count",
    HEADER_STATS_FALLBACKS.stars
  )

  return formatCompactCount(stars)
}

export async function fetchWeeklyNpmDownloadsLabel() {
  const weeklyDownloads = await fetchNumberField(
    NPM_WEEKLY_DOWNLOADS_API,
    "downloads",
    HEADER_STATS_FALLBACKS.weeklyDownloads
  )

  return formatCompactCount(weeklyDownloads)
}

export async function getGitHubStarsLabel() {
  "use cache"

  cacheLife(HEADER_STATS_CACHE_PROFILE)

  return fetchGitHubStarsLabel()
}

export async function getWeeklyNpmDownloadsLabel() {
  "use cache"

  cacheLife(HEADER_STATS_CACHE_PROFILE)

  return fetchWeeklyNpmDownloadsLabel()
}
