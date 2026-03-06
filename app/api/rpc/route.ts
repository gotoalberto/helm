/**
 * Alchemy RPC Proxy
 * POST /api/rpc — proxies JSON-RPC calls to Alchemy server-side
 *
 * The Alchemy API key is kept server-side (ALCHEMY_API_KEY, no NEXT_PUBLIC_ prefix)
 * and never exposed to the client bundle.
 */

import { NextRequest, NextResponse } from "next/server"

const ALCHEMY_URL = `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`

export async function POST(req: NextRequest) {
  if (!process.env.ALCHEMY_API_KEY) {
    return NextResponse.json({ error: "RPC not configured" }, { status: 503 })
  }

  try {
    const body = await req.json()

    const response = await fetch(ALCHEMY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error("RPC proxy error:", error)
    return NextResponse.json({ error: "RPC proxy error" }, { status: 500 })
  }
}
