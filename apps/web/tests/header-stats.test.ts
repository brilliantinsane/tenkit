import { afterEach, describe, expect, test, vi } from "vitest"

import {
  fetchNumberField,
  formatCompactCount,
  fetchGitHubStarsLabel,
  fetchWeeklyNpmDownloadsLabel,
  HEADER_STATS_CACHE_PROFILE,
  HEADER_STATS_FETCH_INIT,
} from "@/lib/header-stats"

describe("header stats", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  test("formats counts for compact header labels", () => {
    expect(formatCompactCount(17)).toBe("17")
    expect(formatCompactCount(1234)).toBe("1.2K")
    expect(formatCompactCount(12345)).toBe("12K")
  })

  test("uses the explicit one-hour Cache Components profile", () => {
    expect(HEADER_STATS_CACHE_PROFILE).toBe("hours")
  })

  test("fetches external stats with stable JSON request headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 17 }),
    })

    vi.stubGlobal("fetch", fetchMock)

    await expect(
      fetchNumberField(
        "https://api.github.com/repos/example/repo",
        "stargazers_count",
        14
      )
    ).resolves.toBe(17)

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/example/repo",
      HEADER_STATS_FETCH_INIT
    )
    expect(HEADER_STATS_FETCH_INIT.headers).toEqual({
      Accept: "application/json",
    })
  })

  test("fetches GitHub and npm labels independently", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stargazers_count: 17 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ downloads: 1234 }),
      })

    vi.stubGlobal("fetch", fetchMock)

    await expect(fetchGitHubStarsLabel()).resolves.toBe("17")
    await expect(fetchWeeklyNpmDownloadsLabel()).resolves.toBe("1.2K")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test("uses the fallback for malformed external stats", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ stargazers_count: "17" }),
      })
    )

    await expect(
      fetchNumberField(
        "https://api.github.com/repos/example/repo",
        "stargazers_count",
        14
      )
    ).resolves.toBe(14)
  })
})
