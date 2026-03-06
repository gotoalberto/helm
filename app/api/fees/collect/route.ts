/**
 * Fee collection tracking API
 * POST /api/fees/collect — record a fee collection event
 * GET  /api/fees/collect?address=0x... — fetch history for an address
 */

import { NextRequest, NextResponse } from "next/server"
import { isAddress } from "viem"
import { getDb, ensureSchema } from "@/lib/db"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { address, tokenId, amount0Eth, amount1Zeus, ethPriceUsd, zeusPriceUsd, totalUsd, txHash } = body

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 })
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ ok: true }) // no-op if no DB
    }

    await ensureSchema()
    const db = getDb()
    await db.query(
      `INSERT INTO zeus_fee_collections
        (address, token_id, amount0_eth, amount1_zeus, eth_price_usd, zeus_price_usd, total_usd, tx_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        address.toLowerCase(),
        tokenId?.toString() ?? "",
        amount0Eth ?? 0,
        amount1Zeus ?? 0,
        ethPriceUsd ?? 0,
        zeusPriceUsd ?? 0,
        totalUsd ?? 0,
        txHash ?? null,
      ]
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Fee collect POST error:", error)
    return NextResponse.json({ error: "Failed to record fee collection" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const address = searchParams.get("address")

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 })
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ collections: [] })
    }

    await ensureSchema()
    const db = getDb()
    const result = await db.query(
      `SELECT id, address, token_id, amount0_eth, amount1_zeus, eth_price_usd, zeus_price_usd, total_usd, tx_hash, collected_at
       FROM zeus_fee_collections
       WHERE address = $1
       ORDER BY collected_at DESC`,
      [address.toLowerCase()]
    )

    const collections = result.rows.map((r) => ({
      id: r.id,
      address: r.address,
      tokenId: r.token_id,
      amount0Eth: Number(r.amount0_eth),
      amount1Zeus: Number(r.amount1_zeus),
      ethPriceUsd: Number(r.eth_price_usd),
      zeusPriceUsd: Number(r.zeus_price_usd),
      totalUsd: Number(r.total_usd),
      txHash: r.tx_hash,
      collectedAt: r.collected_at,
    }))

    return NextResponse.json({ collections })
  } catch (error) {
    console.error("Fee collect GET error:", error)
    return NextResponse.json({ error: "Failed to fetch fee history" }, { status: 500 })
  }
}
