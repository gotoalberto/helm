/**
 * ETH Price API Route
 * GET /api/price/eth - Returns current ETH price in USD
 */

import { NextResponse } from "next/server"
import { getEthPriceUsd } from "@/lib/services/coingecko"

export const runtime = "edge"
export const revalidate = 60 // Cache for 60 seconds

export async function GET() {
  try {
    const priceUsd = await getEthPriceUsd()
    return NextResponse.json({ priceUsd })
  } catch (error) {
    console.error("ETH price API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch ETH price" },
      { status: 500 }
    )
  }
}
