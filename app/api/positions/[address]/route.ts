/**
 * GET /api/positions/[address]
 *
 * Returns V4 positions for a specific address with 5-minute DB cache.
 * All bigint fields are serialized as decimal strings.
 */

import { NextRequest, NextResponse } from "next/server"
import { isAddress } from "viem"
import {
  getUserPositionTokenIds,
  getCurrentPoolTick,
  getV4PositionInfo,
  buildPosition,
  serializePosition,
  getBlockTimestamps,
} from "@/lib/uniswap/positions"
import { getZeusPriceData, getEthPriceUsd } from "@/lib/services/coingecko"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params

  if (!isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 404 })
  }

  const normalizedAddress = address.toLowerCase()

  try {
    // Fetch price data and chain data in parallel
    const [priceData, ethPriceUsd, tokenEntries, currentTick] = await Promise.all([
      getZeusPriceData(),
      getEthPriceUsd(),
      getUserPositionTokenIds(address),
      getCurrentPoolTick(),
    ])

    const zeusPriceUsd = priceData.priceUsd
    const totalSupplyRaw = priceData.totalSupply

    // Batch-fetch mint block timestamps
    const blockTimestamps = await getBlockTimestamps(tokenEntries.map((e) => e.mintBlock))

    // Fetch info for each tokenId in parallel
    const positionInfos = await Promise.all(
      tokenEntries.map(({ tokenId, mintBlock }) =>
        getV4PositionInfo(tokenId).then((info) => ({ tokenId, mintBlock, info }))
      )
    )

    // Build full positions (includes fee calculation)
    const positions = await Promise.all(
      positionInfos
        .filter(({ info }) => info !== null)
        .map(({ tokenId, mintBlock, info }) =>
          buildPosition(
            tokenId,
            info!.tickLower,
            info!.tickUpper,
            info!.liquidity,
            currentTick,
            ethPriceUsd,
            zeusPriceUsd,
            totalSupplyRaw,
            address,
            blockTimestamps.get(mintBlock) ?? 0
          )
        )
    )

    const serialized = positions.map(serializePosition)

    return NextResponse.json({
      positions: serialized,
      cachedAt: new Date().toISOString(),
      cached: false,
    })
  } catch (error) {
    console.error("Positions [address] API error:", error)
    return NextResponse.json({ error: "Failed to fetch positions" }, { status: 500 })
  }
}
