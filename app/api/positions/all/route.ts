/**
 * GET /api/positions/all
 *
 * Returns all active V4 ZEUS/ETH positions (tickLower, tickUpper, liquidity).
 * Used to render the "defenders" liquidity depth overlay chart.
 *
 * Strategy: query V4 PoolManager ModifyLiquidity events filtered by the ZEUS poolId.
 * This is fast because we filter to a specific pool from the start.
 * Then we batch-read current liquidity for each unique tick range.
 */

import { NextResponse } from "next/server"
import { UNISWAP_V4_POOL_MANAGER, ZEUS_TOKEN_ADDRESS, ZEUS_DECIMALS, POOL_FEE, POOL_TICK_SPACING, POOL_HOOKS_ADDRESS } from "@/lib/constants"
import { getDb, ensureSchema } from "@/lib/db"
import { encodeAbiParameters, keccak256 } from "viem"

export const runtime = "nodejs"
export const revalidate = 3600

const ALCHEMY_URL = `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const V4_LAUNCH_BLOCK = 21355000
const CHUNK_SIZE = 9999
const PARALLEL = 5 // conservative parallelism

// V4 PoolManager ModifyLiquidity event:
// ModifyLiquidity(bytes32 indexed id, address indexed sender, int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt)
// keccak256("ModifyLiquidity(bytes32,address,int24,int24,int256,bytes32)")
const MODIFY_LIQUIDITY_TOPIC = "0xf208f4912782fd25c7f114ca3723a2d5dd6f3bcc3ac8db5af63baa85f711d5ec"

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

async function batchRpc(calls: { method: string; params: any[] }[]): Promise<any[]> {
  if (calls.length === 0) return []
  const res = await fetch(ALCHEMY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(calls.map((c, i) => ({ jsonrpc: "2.0", id: i + 1, method: c.method, params: c.params }))),
  })
  const data = await res.json()
  return data.map((d: any) => d.result)
}

function computePoolId(): string {
  return keccak256(
    encodeAbiParameters(
      [{ type: "tuple", components: [
        { name: "currency0", type: "address" },
        { name: "currency1", type: "address" },
        { name: "fee", type: "uint24" },
        { name: "tickSpacing", type: "int24" },
        { name: "hooks", type: "address" },
      ]}],
      [{ currency0: "0x0000000000000000000000000000000000000000", currency1: ZEUS_TOKEN_ADDRESS as `0x${string}`, fee: POOL_FEE, tickSpacing: POOL_TICK_SPACING, hooks: POOL_HOOKS_ADDRESS as `0x${string}` }]
    )
  )
}

export async function GET() {
  try {
    // Check DB cache first (1h TTL)
    if (process.env.DATABASE_URL) {
      await ensureSchema()
      const db = getDb()
      const cached = await db.query(
        `SELECT positions, computed_at FROM zeus_positions_cache ORDER BY computed_at DESC LIMIT 1`
      )
      if (
        cached.rows.length > 0 &&
        new Date(cached.rows[0].computed_at) > new Date(Date.now() - CACHE_TTL_MS)
      ) {
        return NextResponse.json({
          positions: cached.rows[0].positions,
          cached: true,
        })
      }
    }

    const poolId = computePoolId()

    const blockNumberHex = await rpcCall<string>("eth_blockNumber")
    const currentBlock = parseInt(blockNumberHex, 16)

    // Build chunk ranges and fetch ModifyLiquidity events for this specific pool
    const chunks: Array<{ from: number; to: number }> = []
    for (let start = V4_LAUNCH_BLOCK; start <= currentBlock; start += CHUNK_SIZE) {
      chunks.push({ from: start, to: Math.min(start + CHUNK_SIZE - 1, currentBlock) })
    }

    // Fetch chunks in small parallel batches
    const allLogs: any[] = []
    for (let i = 0; i < chunks.length; i += PARALLEL) {
      const batch = chunks.slice(i, i + PARALLEL)
      const results = await Promise.all(
        batch.map(({ from, to }) =>
          rpcCall<any[]>("eth_getLogs", [{
            address: UNISWAP_V4_POOL_MANAGER,
            fromBlock: `0x${from.toString(16)}`,
            toBlock: `0x${to.toString(16)}`,
            topics: [MODIFY_LIQUIDITY_TOPIC, poolId],
          }])
        )
      )
      for (const logs of results) allLogs.push(...logs)
    }

    // Decode each ModifyLiquidity event to get tick ranges and liquidity deltas
    // Event data: tickLower (int24), tickUpper (int24), liquidityDelta (int256), salt (bytes32)
    // Packed in non-indexed data (3 words)
    const liquidityByRange = new Map<string, bigint>()

    for (const log of allLogs) {
      const d = log.data.slice(2)
      // Data layout: tickLower(int24), tickUpper(int24), liquidityDelta(int256), salt(bytes32)
      // Each padded to 32 bytes in ABI encoding
      // int24 is sign-extended in 32 bytes — parse as BigInt for correct sign handling
      const tickLowerBig = BigInt("0x" + d.slice(0, 64))
      const tickLower = tickLowerBig > 0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn
        ? Number(tickLowerBig - 0x10000000000000000000000000000000000000000000000000000000000000000n)
        : Number(tickLowerBig)
      const tickUpperBig = BigInt("0x" + d.slice(64, 128))
      const tickUpper = tickUpperBig > 0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn
        ? Number(tickUpperBig - 0x10000000000000000000000000000000000000000000000000000000000000000n)
        : Number(tickUpperBig)
      // liquidityDelta: next 32 bytes (int256)
      const deltaHex = d.slice(128, 192)
      let delta = BigInt("0x" + deltaHex)
      // Two's complement for negative
      if (delta > 0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn) {
        delta = delta - 0x10000000000000000000000000000000000000000000000000000000000000000n
      }

      const key = `${tickLower}:${tickUpper}`
      liquidityByRange.set(key, (liquidityByRange.get(key) ?? 0n) + delta)
    }

    // Build results — only include ranges with positive net liquidity
    const results: { tickLower: number; tickUpper: number; liquidity: string }[] = []
    for (const [key, liq] of liquidityByRange) {
      if (liq <= 0n) continue
      const [tl, tu] = key.split(":").map(Number)
      results.push({ tickLower: tl, tickUpper: tu, liquidity: liq.toString() })
    }

    // Persist to DB cache
    if (process.env.DATABASE_URL) {
      const db = getDb()
      await db.query(
        `INSERT INTO zeus_positions_cache (positions) VALUES ($1)`,
        [JSON.stringify(results)]
      )
    }

    return NextResponse.json({ positions: results }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300" }
    })
  } catch (error) {
    console.error("All positions API error:", error)
    return NextResponse.json({ error: "Failed to fetch positions" }, { status: 500 })
  }
}
