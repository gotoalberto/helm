"use client"

import { useQuery } from "@tanstack/react-query"

interface AprData {
  apr: number
  volume_24h_usd: number
  tvl_usd: number
  computed_at: string
  cached?: boolean
}

export function useApr() {
  const { data, isLoading, error } = useQuery<AprData>({
    queryKey: ["apr"],
    queryFn: async () => {
      const res = await fetch("/api/apr")
      if (!res.ok) throw new Error("Failed to fetch APR")
      return res.json()
    },
    staleTime: 60 * 60 * 1000, // 60 minutes
    gcTime: 2 * 60 * 60 * 1000,
  })

  return {
    apr: data?.apr ?? null,
    volume24hUsd: data?.volume_24h_usd ?? null,
    tvlUsd: data?.tvl_usd ?? null,
    isLoading,
    error,
  }
}
