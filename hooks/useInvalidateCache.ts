import { useQueryClient } from "@tanstack/react-query"
import { useAccount } from "wagmi"
import { useCallback } from "react"

/**
 * Returns a function that invalidates all relevant React Query caches
 * and purges the server-side leaderboard DB cache.
 * Call it after any on-chain tx is confirmed (mint, add, remove, collect, close).
 */
export function useInvalidateCache() {
  const queryClient = useQueryClient()
  const { address } = useAccount()

  return useCallback(async () => {
    // Invalidate client-side caches immediately
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["all-positions"] }),
      queryClient.invalidateQueries({ queryKey: ["fee-leaderboard"] }),
      address
        ? queryClient.invalidateQueries({ queryKey: ["profile-positions", address] })
        : Promise.resolve(),
    ])
    // Purge server-side leaderboard DB cache (fire and forget)
    fetch("/api/cache/invalidate", { method: "POST" }).catch(() => {})
  }, [queryClient, address])
}
