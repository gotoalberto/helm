/**
 * OHLC API Route
 * GET /api/price/ohlc?days=7 - Returns ZEUS OHLC chart data
 */

import { NextRequest, NextResponse } from "next/server"
import { getZeusOHLC } from "@/lib/services/coingecko"

export const runtime = "edge"
export const revalidate = 300 // Cache for 5 minutes

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get("days") || "7", 10)

    // Validate days parameter
    if (days < 1 || days > 365) {
      return NextResponse.json(
        { error: "Days parameter must be between 1 and 365" },
        { status: 400 }
      )
    }

    const ohlcData = await getZeusOHLC(days)
    return NextResponse.json(ohlcData)
  } catch (error) {
    console.error("OHLC API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch OHLC data" },
      { status: 500 }
    )
  }
}
