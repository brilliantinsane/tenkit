import { GITHUB_REPO_API, NPM_WEEKLY_DOWNLOADS_API } from "@/constants/globals"
import { HeaderClient, type HeaderStatsLabels } from "./header-client"

const FALLBACK_STATS = {
  stars: 14,
  weeklyDownloads: 249,
}

const STATS_REVALIDATE_SECONDS = 3600

function formatCompactCount(value: number) {
  if (value < 1000) {
    return value.toString()
  }

  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: value < 10000 ? 1 : 0,
  }).format(value)
}

async function fetchNumberField(url: string, field: string, fallback: number) {
  try {
    const response = await fetch(url, {
      next: { revalidate: STATS_REVALIDATE_SECONDS },
    })

    if (!response.ok) {
      return fallback
    }

    const json: unknown = await response.json()
    const value =
      typeof json === "object" && json !== null && field in json
        ? json[field as keyof typeof json]
        : null

    return typeof value === "number" && Number.isFinite(value)
      ? value
      : fallback
  } catch {
    return fallback
  }
}

async function getHeaderStats(): Promise<HeaderStatsLabels> {
  const [stars, weeklyDownloads] = await Promise.all([
    fetchNumberField(GITHUB_REPO_API, "stargazers_count", FALLBACK_STATS.stars),
    fetchNumberField(
      NPM_WEEKLY_DOWNLOADS_API,
      "downloads",
      FALLBACK_STATS.weeklyDownloads
    ),
  ])

  return {
    stars: formatCompactCount(stars),
    weeklyDownloads: formatCompactCount(weeklyDownloads),
  }
}

export async function Header() {
  const stats = await getHeaderStats()

  return <HeaderClient stats={stats} />
}
