"use client"

/**
 * useZeusPrice Hook
 *
 * Fetches current ZEUS price and market data from CoinGecko
 * Uses React Query for caching and automatic refetching
 */

import { useQuery } from "@tanstack/react-query"
import { PriceData } from "@/types"

export function useZeusPrice() {
  return useQuery<PriceData>({
    queryKey: ["zeus-price"],
    queryFn: async () => {
      // Call our API route to avoid CORS issues
      const response = await fetch("/api/price")
      if (!response.ok) {
        throw new Error("Failed to fetch ZEUS price")
      }
      const data = await response.json()

      // Convert totalSupply string back to BigInt
      return {
        ...data,
        totalSupply: BigInt(data.totalSupply),
      }
    },
    staleTime: 60_000, // 60 seconds
    gcTime: 5 * 60_000, // 5 minutes
    refetchInterval: 60_000, // Refetch every 60 seconds
  })
}

export function useZeusOHLC(days: number = 7) {
  return useQuery({
    queryKey: ["zeus-ohlc", days],
    queryFn: async () => {
      const response = await fetch(`/api/price/ohlc?days=${days}`)
      if (!response.ok) {
        throw new Error("Failed to fetch ZEUS OHLC data")
      }
      return response.json()
    },
    staleTime: 5 * 60_000, // 5 minutes
    gcTime: 10 * 60_000, // 10 minutes
    refetchInterval: 5 * 60_000, // Refetch every 5 minutes
  })
}

export function useEthPrice() {
  return useQuery<number>({
    queryKey: ["eth-price"],
    queryFn: async () => {
      const response = await fetch("/api/price/eth")
      if (!response.ok) {
        throw new Error("Failed to fetch ETH price")
      }
      const data = await response.json()
      return data.priceUsd
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchInterval: 60_000,
  })
}
