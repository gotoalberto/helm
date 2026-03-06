/**
 * Price API Route
 * GET /api/price - Returns current ZEUS price and market data
 */

import { NextResponse } from "next/server"
import { getZeusPriceData } from "@/lib/services/coingecko"

export const runtime = "edge"
export const revalidate = 60 // Cache for 60 seconds

export async function GET() {
  try {
    const priceData = await getZeusPriceData()

    // Convert BigInt to string for JSON serialization
    const serializable = {
      ...priceData,
      totalSupply: priceData.totalSupply.toString(),
    }

    return NextResponse.json(serializable)
  } catch (error) {
    console.error("Price API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch price data" },
      { status: 500 }
    )
  }
}
