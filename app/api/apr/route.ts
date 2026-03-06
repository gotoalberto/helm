/**
 * APR Endpoint — GET /api/apr
 *
 * Computes estimated APR for the ZEUS/ETH Uniswap V2 pool using:
 *   APR = (volume_24h_usd * 0.003 * 365) / tvl_usd * 100
 *
 * Results are cached in PostgreSQL with a 1-day TTL.
 */

import { NextResponse } from "next/server"
import { getDb, ensureSchema } from "@/lib/db"
import { ZEUS_V2_PAIR } from "@/lib/constants"

export const runtime = "nodejs"

const ALCHEMY_URL = `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`

async function rpcCall<T = any>(method: string, params: any[] = []): Promise<T> {
  const res = await fetch(ALCHEMY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data.result
}

async function getEthPriceUsd(): Promise<number> {
  // Use the internal ETH price endpoint (relative URL won't work in server context)
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd`,
    { headers: { Accept: "application/json" } }
  )
  const data = await res.json()
  return data?.ethereum?.usd ?? 0
}

async function computeApr(): Promise<{ apr: number; volume_24h_usd: number; tvl_usd: number }> {
  const ethPriceUsd = await getEthPriceUsd()

  // Get current block number
  const blockNumberHex = await rpcCall<string>("eth_blockNumber")
  const currentBlock = parseInt(blockNumberHex, 16)
  const fromBlock = currentBlock - 7200 // ~24h of blocks

  // getReserves() selector: 0x0902f1ac → returns (reserve0, reserve1, blockTimestampLast)
  // token0=ZEUS, token1=WETH
  const reservesHex = await rpcCall<string>("eth_call", [
    { to: ZEUS_V2_PAIR, data: "0x0902f1ac" },
    "latest",
  ])

  // reserves are two uint112 values packed in 3 slots of 32 bytes each
  const reservesData = reservesHex.slice(2)
  const reserve0 = BigInt("0x" + reservesData.slice(0, 64)) // ZEUS (9 decimals)
  const reserve1 = BigInt("0x" + reservesData.slice(64, 128)) // WETH (18 decimals)

  const reserve1Human = Number(reserve1) / 1e18
  const tvlUsd = reserve1Human * 2 * ethPriceUsd

  // V2 Swap event topic
  const SWAP_TOPIC = "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822"

  const logs = await rpcCall<any[]>("eth_getLogs", [
    {
      address: ZEUS_V2_PAIR,
      fromBlock: `0x${fromBlock.toString(16)}`,
      toBlock: "latest",
      topics: [SWAP_TOPIC],
    },
  ])

  // Each swap log data: sender(32) amount0In(32) amount1In(32) amount0Out(32) amount1Out(32)
  // token1 = WETH — sum amount1In + amount1Out for total ETH volume
  let totalEth = 0
  for (const log of logs) {
    const d = log.data.slice(2)
    const amount1In = Number(BigInt("0x" + d.slice(64, 128))) / 1e18
    const amount1Out = Number(BigInt("0x" + d.slice(128, 192))) / 1e18
    totalEth += amount1In + amount1Out
  }

  const volume24hUsd = totalEth * ethPriceUsd
  const apr = tvlUsd > 0 ? (volume24hUsd * 0.003 * 365 * 100) / tvlUsd : 0

  return { apr, volume_24h_usd: volume24hUsd, tvl_usd: tvlUsd }
}

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      // No DB configured — compute fresh each time
      const result = await computeApr()
      return NextResponse.json({ ...result, computed_at: new Date().toISOString() })
    }

    await ensureSchema()
    const db = getDb()

    // Check cache
    const cached = await db.query(
      `SELECT * FROM zeus_apr_cache ORDER BY computed_at DESC LIMIT 1`
    )

    if (
      cached.rows.length > 0 &&
      new Date(cached.rows[0].computed_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ) {
      const row = cached.rows[0]
      return NextResponse.json({
        apr: Number(row.apr),
        volume_24h_usd: Number(row.volume_24h_usd),
        tvl_usd: Number(row.tvl_usd),
        computed_at: row.computed_at,
        cached: true,
      })
    }

    // Compute fresh
    const { apr, volume_24h_usd, tvl_usd } = await computeApr()

    await db.query(
      `INSERT INTO zeus_apr_cache (apr, volume_24h_usd, tvl_usd) VALUES ($1, $2, $3)`,
      [apr, volume_24h_usd, tvl_usd]
    )

    const inserted = await db.query(
      `SELECT computed_at FROM zeus_apr_cache ORDER BY computed_at DESC LIMIT 1`
    )

    return NextResponse.json({
      apr,
      volume_24h_usd,
      tvl_usd,
      computed_at: inserted.rows[0]?.computed_at ?? new Date().toISOString(),
      cached: false,
    })
  } catch (error) {
    console.error("APR API error:", error)
    return NextResponse.json({ error: "Failed to compute APR" }, { status: 500 })
  }
}
