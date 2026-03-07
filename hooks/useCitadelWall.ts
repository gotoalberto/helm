"use client"

import { useState, useEffect, useRef } from "react"
import { triggerCitadelEvent } from "@/components/citadel/EventAnimations"
import { musicEngine } from "@/lib/audio/musicEngine"
import { SFX } from "@/lib/audio/sfx"
import type { WallState } from "@/lib/citadel/wallIntegrity"

export interface CitadelWall {
  id: number
  tick_lower: number
  tick_upper: number
  mcap_usd: number
  status: string
  integrity: number
  wallState: string
  wallImage: string
  currentTick: number
  deployed_at: string
  peak_liquidity: string
}

export function useCitadelWall(pollMs = 30_000) {
  const [wall, setWall] = useState<CitadelWall | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const prevWallRef = useRef<CitadelWall | null>(null)
  const isFirstFetch = useRef(true)

  useEffect(() => {
    async function fetchWall() {
      try {
        const res = await fetch("/api/citadel/wall")
        const data = await res.json()
        const newWall: CitadelWall | null = data.wall ?? null

        // Detect breach transition (active → breached)
        if (!isFirstFetch.current && prevWallRef.current?.status === "active" && newWall?.status === "breached") {
          triggerCitadelEvent({ type: "breach" })
          SFX.wallBreach()
          musicEngine.playBreachMusic()
        }

        // Detect wall state transitions for audio
        if (!isFirstFetch.current && newWall) {
          const prevState = prevWallRef.current?.wallState as WallState | undefined
          const newState = newWall.wallState as WallState
          if (prevState !== newState) {
            if (newState === "SIEGE" && prevState === "INTACT") SFX.siegeStart()
            if (newState === "CRITICAL") SFX.wallCritical()
            if (prevState === "SIEGE" && newState === "INTACT") SFX.siegeEnd()
          }
          musicEngine.updateState(newState, newWall.integrity)
        }

        prevWallRef.current = newWall
        setWall(newWall)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to fetch wall")
      } finally {
        isFirstFetch.current = false
        setLoading(false)
      }
    }
    fetchWall()
    const interval = setInterval(fetchWall, pollMs)
    return () => clearInterval(interval)
  }, [pollMs])

  return { wall, loading, error }
}
