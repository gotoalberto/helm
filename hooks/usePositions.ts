"use client"

import { useQuery } from "@tanstack/react-query"
import { useAccount } from "wagmi"
import { Position } from "@/types"
import { getUserPositionTokenIds, getV4PositionInfo, buildPosition, getCurrentPoolTick } from "@/lib/uniswap/positions"
import { useZeusPrice, useEthPrice } from "./useZeusPrice"

export function usePositions() {
  const { address, isConnected } = useAccount()
  const { data: priceData } = useZeusPrice()
  const { data: ethPriceUsd } = useEthPrice()

  return useQuery<Position[]>({
    queryKey: ["positions", address],
    queryFn: async () => {
      if (!address || !priceData || !ethPriceUsd) return []

      const [tokenEntries, currentTick] = await Promise.all([
        getUserPositionTokenIds(address),
        getCurrentPoolTick(),
      ])

      if (tokenEntries.length === 0) return []

      const positionInfos = await Promise.all(
        tokenEntries.map(({ tokenId }) => getV4PositionInfo(tokenId))
      )

      const positions = await Promise.all(
        positionInfos
          .map((info, i) => ({ info, tokenId: tokenEntries[i].tokenId }))
          .filter(({ info }) => info !== null && info!.liquidity > 0n)
          .map(({ info, tokenId }) =>
            buildPosition(
              tokenId,
              info!.tickLower,
              info!.tickUpper,
              info!.liquidity,
              currentTick,
              ethPriceUsd,
              priceData.priceUsd,
              priceData.totalSupply,
              address
            )
          )
      )

      return positions
    },
    enabled: isConnected && !!address && !!priceData && !!ethPriceUsd,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  })
}

export function usePortfolioValue() {
  const { data: positions, isLoading } = usePositions()
  return {
    totalValueUsd: positions?.reduce((s, p) => s + p.totalValueUsd, 0) || 0,
    totalFeesUsd: positions?.reduce((s, p) => s + p.uncollectedFeesUsd, 0) || 0,
    positionCount: positions?.length || 0,
    isLoading,
  }
}
