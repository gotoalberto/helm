"use client"

import { useState, useEffect } from "react"

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

  useEffect(() => {
    async function fetchWall() {
      try {
        const res = await fetch("/api/citadel/wall")
        const data = await res.json()
        setWall(data.wall ?? null)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to fetch wall")
      } finally {
        setLoading(false)
      }
    }
    fetchWall()
    const interval = setInterval(fetchWall, pollMs)
    return () => clearInterval(interval)
  }, [pollMs])

  return { wall, loading, error }
}
