"use client"

import { Pause, Play } from "lucide-react"
import { useCallback, useRef, useState } from "react"

import { HERO_POSTER_PATH, HERO_VIDEO_PATH } from "@/lib/hero-media"

export function HeroDemoVideo() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(true)

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      void video.play()
      setPlaying(true)
      return
    }

    video.pause()
    setPlaying(false)
  }, [])

  return (
    <>
      <video
        ref={videoRef}
        aria-label="Tenkit product demo"
        src={HERO_VIDEO_PATH}
        autoPlay
        muted
        loop
        playsInline
        poster={HERO_POSTER_PATH}
        preload="metadata"
        className="block h-full w-full object-cover"
      />
      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? "Pause preview" : "Play preview"}
        className="absolute inset-0 flex items-center justify-center bg-transparent focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        <span
          aria-hidden
          data-show={!playing}
          className="pointer-events-none flex size-14 items-center justify-center rounded-full bg-background/70 text-foreground opacity-0 backdrop-blur-md transition-opacity duration-200 group-hover:opacity-100 data-[show=true]:opacity-100 motion-reduce:transition-none"
        >
          {playing ? (
            <Pause className="size-5" />
          ) : (
            <Play className="size-5 translate-x-0.5" />
          )}
        </span>
      </button>
    </>
  )
}
