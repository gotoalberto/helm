/**
 * GET /api/fees/leaderboard
 *
 * Top 10 defenders by uncollected fees (USD).
 *
 * Cache strategy (stale-while-revalidate in DB):
 *  - Always return cached data instantly if it exists (even if stale)
 *  - If cache is older than 1h, trigger background refresh via waitUntil
 *  - On first ever call (no cache), compute synchronously and wait
 */

import { NextResponse } from "next/server"
import { getDb, ensureSchema } from "@/lib/db"
import { getCurrentPoolTick } from "@/lib/uniswap/positions"
import { getZeusPriceData, getEthPriceUsd } from "@/lib/services/coingecko"
import {
  ZEUS_DECIMALS,
  UNISWAP_V4_POSITION_MANAGER,
  UNISWAP_V4_POOL_MANAGER,
  UNISWAP_V4_STATE_VIEW,
  ZEUS_TOKEN_ADDRESS,
  POOL_FEE,
  POOL_TICK_SPACING,
  POOL_HOOKS_ADDRESS,
} from "@/lib/constants"
import { encodeAbiParameters, keccak256 } from "viem"
import { waitUntil } from "@vercel/functions"

export const runtime = "nodejs"
export const maxDuration = 300 // allow up to 5 min for background compute

const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes
const ALCHEMY_URL = `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
const V4_LAUNCH_BLOCK = 21355000
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
const ZERO_ADDR = "0x0000000000000000000000000000000000000000"
const CHUNK_SIZE = 9999
const PARALLEL = 8

// ── RPC helpers ───────────────────────────────────────────────────────────────

async function rpcSingle<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
  const res = await fetch(ALCHEMY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data.result
}

async function rpcBatch(calls: { method: string; params: unknown[] }[]): Promise<unknown[]> {
  if (calls.length === 0) return []
  const res = await fetch(ALCHEMY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      calls.map((c, i) => ({ jsonrpc: "2.0", id: i, method: c.method, params: c.params }))
    ),
  })
  const data = await res.json()
  const sorted = [...data].sort((a: any, b: any) => a.id - b.id)
  return sorted.map((d: any) => d.result ?? null)
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
      [{
        currency0: ZERO_ADDR as `0x${string}`,
        currency1: ZEUS_TOKEN_ADDRESS as `0x${string}`,
        fee: POOL_FEE,
        tickSpacing: POOL_TICK_SPACING,
        hooks: POOL_HOOKS_ADDRESS as `0x${string}`,
      }]
    )
  )
}

const encodeInt24 = (v: number) =>
  (v < 0 ? BigInt(v) + (1n << 256n) : BigInt(v)).toString(16).padStart(64, "0")

// ── core computation ──────────────────────────────────────────────────────────

async function buildLeaderboard() {
  const poolId = computePoolId()
  const ownerHex = UNISWAP_V4_POSITION_MANAGER.slice(2).toLowerCase().padStart(64, "0")

  // Step 1: get all ZEUS pool tokenIds from ModifyLiquidity events (salt field = tokenId).
  // These events are already filtered to the ZEUS poolId, so no payload issues.
  const MODIFY_LIQUIDITY_TOPIC = "0xf208f4912782fd25c7f114ca3723a2d5dd6f3bcc3ac8db5af63baa85f711d5ec"

  const blockHex = await rpcSingle<string>("eth_blockNumber")
  const currentBlock = parseInt(blockHex, 16)

  const chunks: { from: number; to: number }[] = []
  for (let start = V4_LAUNCH_BLOCK; start <= currentBlock; start += CHUNK_SIZE) {
    chunks.push({ from: start, to: Math.min(start + CHUNK_SIZE - 1, currentBlock) })
  }

  // Fetch ModifyLiquidity logs for our specific pool (small result set)
  const modifyLogs: { data: string }[] = []
  for (let i = 0; i < chunks.length; i += PARALLEL) {
    const batch = chunks.slice(i, i + PARALLEL)
    const results = await Promise.all(
      batch.map(({ from, to }) =>
        rpcSingle<{ data: string }[]>("eth_getLogs", [{
          address: UNISWAP_V4_POOL_MANAGER,
          fromBlock: `0x${from.toString(16)}`,
          toBlock: `0x${to.toString(16)}`,
          topics: [MODIFY_LIQUIDITY_TOPIC, poolId],
        }])
      )
    )
    for (const logs of results) modifyLogs.push(...logs)
  }

  // Extract unique tokenIds from salt (last 32 bytes of event data)
  const zeusTokenIds = new Set<string>()
  for (const log of modifyLogs) {
    const d = log.data.slice(2)
    if (d.length < 256) continue // need at least 4 words
    const salt = d.slice(192, 256) // 4th word = salt = tokenId
    const tokenId = BigInt("0x" + salt)
    if (tokenId > 0n) zeusTokenIds.add(tokenId.toString())
  }

  if (zeusTokenIds.size === 0) return []

  // Step 2: for each ZEUS tokenId, get Transfer events filtered by that tokenId.
  // Fetch in parallel batches — there are few ZEUS positions so few unique tokenIds.
  const tokenIdList = [...zeusTokenIds]
  const transferResults = await Promise.all(
    tokenIdList.map((id) => {
      const paddedId = "0x" + BigInt(id).toString(16).padStart(64, "0")
      return rpcSingle<{ topics: string[] }[]>("eth_getLogs", [{
        address: UNISWAP_V4_POSITION_MANAGER,
        fromBlock: `0x${V4_LAUNCH_BLOCK.toString(16)}`,
        toBlock: "latest",
        topics: [TRANSFER_TOPIC, null, null, paddedId],
      }])
    })
  )

  // Build owner map from Transfer events
  const currentOwner = new Map<string, string>() // tokenId → current owner
  for (let i = 0; i < tokenIdList.length; i++) {
    const id = tokenIdList[i]
    const logs = transferResults[i]
    // Sort by... logs are in order. Last Transfer determines current owner.
    for (const log of logs) {
      const to = "0x" + log.topics[2].slice(26).toLowerCase()
      currentOwner.set(id, to === ZERO_ADDR ? "" : to)
    }
  }

  const flat: { owner: string; tokenId: bigint }[] = []
  for (const [id, owner] of currentOwner) {
    if (owner) flat.push({ owner, tokenId: BigInt(id) })
  }

  if (flat.length === 0) return []

  // Step 2: batch-fetch position info for all tokens
  const [priceData, ethPriceUsd, currentTick] = await Promise.all([
    getZeusPriceData(),
    getEthPriceUsd(),
    getCurrentPoolTick(),
  ])

  const infoCalls = flat.flatMap(({ tokenId }) => {
    const hex = tokenId.toString(16).padStart(64, "0")
    return [
      { method: "eth_call", params: [{ to: UNISWAP_V4_POSITION_MANAGER, data: `0x7ba03aad${hex}` }, "latest"] },
      { method: "eth_call", params: [{ to: UNISWAP_V4_POSITION_MANAGER, data: `0x1efeed33${hex}` }, "latest"] },
    ]
  })

  const infoResults = await rpcBatch(infoCalls)

  // Parse ticks + liquidity
  const parsedInfos = flat.map((_, i) => {
    const infoHex = infoResults[i * 2] as string | null
    const liqHex  = infoResults[i * 2 + 1] as string | null
    if (!infoHex || infoHex === "0x") return null
    const hex = infoHex.slice(2)
    const packed = BigInt("0x" + hex.slice(5 * 64, 6 * 64))
    const tickLowerRaw = (packed >> 8n) & 0xFFFFFFn
    const tickUpperRaw = (packed >> 32n) & 0xFFFFFFn
    const tickLower = tickLowerRaw >= 0x800000n ? Number(tickLowerRaw) - 0x1000000 : Number(tickLowerRaw)
    const tickUpper = tickUpperRaw >= 0x800000n ? Number(tickUpperRaw) - 0x1000000 : Number(tickUpperRaw)
    const liquidity = liqHex && liqHex !== "0x" ? BigInt(liqHex) : 0n
    return { tickLower, tickUpper, liquidity }
  })

  // Step 3: batch fee calls for active positions
  const activePositions: { idx: number; tickLower: number; tickUpper: number; liquidity: bigint }[] = []
  const uniqueRanges = new Map<string, { tickLower: number; tickUpper: number }>()

  for (let i = 0; i < flat.length; i++) {
    const info = parsedInfos[i]
    if (!info || info.liquidity === 0n) continue
    activePositions.push({ idx: i, ...info })
    const key = `${info.tickLower}:${info.tickUpper}`
    if (!uniqueRanges.has(key)) uniqueRanges.set(key, info)
  }

  const feeBatch: { method: string; params: unknown[] }[] = []

  for (const { idx, tickLower, tickUpper } of activePositions) {
    const saltHex = flat[idx].tokenId.toString(16).padStart(64, "0")
    const tl = encodeInt24(tickLower)
    const tu = encodeInt24(tickUpper)
    feeBatch.push({ method: "eth_call", params: [{ to: UNISWAP_V4_STATE_VIEW, data: `0xdacf1d2f${poolId.slice(2)}${ownerHex}${tl}${tu}${saltHex}` }, "latest"] })
  }

  const rangeKeys = [...uniqueRanges.keys()]
  for (const key of rangeKeys) {
    const { tickLower, tickUpper } = uniqueRanges.get(key)!
    feeBatch.push({ method: "eth_call", params: [{ to: UNISWAP_V4_STATE_VIEW, data: `0x53e9c1fb${poolId.slice(2)}${encodeInt24(tickLower)}${encodeInt24(tickUpper)}` }, "latest"] })
  }

  const feeResults = await rpcBatch(feeBatch)
  const posInfoResults = feeResults.slice(0, activePositions.length)
  const growthResults  = feeResults.slice(activePositions.length)

  const growthByRange = new Map<string, { g0: bigint; g1: bigint }>()
  rangeKeys.forEach((key, i) => {
    const hex = growthResults[i] as string | null
    if (!hex || hex === "0x") return
    const h = hex.slice(2)
    growthByRange.set(key, { g0: BigInt("0x" + h.slice(0, 64)), g1: BigInt("0x" + h.slice(64, 128)) })
  })

  // ── Step 4: compute pending fees + position value per active position ──────────
  const Q128 = 2n ** 128n
  const Q96  = 2n ** 96n

  function tickToSqrt(tick: number): bigint {
    return BigInt(Math.floor(Math.sqrt(1.0001 ** tick) * Number(Q96)))
  }

  function getAmounts(sqrtPrice: bigint, tickLower: number, tickUpper: number, liquidity: bigint) {
    const sqrtLower = tickToSqrt(tickLower)
    const sqrtUpper = tickToSqrt(tickUpper)
    if (sqrtPrice <= sqrtLower) {
      return {
        amount0: (liquidity * Q96 * (sqrtUpper - sqrtLower)) / (sqrtUpper * sqrtLower),
        amount1: 0n,
      }
    } else if (sqrtPrice < sqrtUpper) {
      return {
        amount0: (liquidity * Q96 * (sqrtUpper - sqrtPrice)) / (sqrtUpper * sqrtPrice),
        amount1: (liquidity * (sqrtPrice - sqrtLower)) / Q96,
      }
    } else {
      return { amount0: 0n, amount1: (liquidity * (sqrtUpper - sqrtLower)) / Q96 }
    }
  }

  const sqrtPriceCurrent = tickToSqrt(currentTick)

  // pendingByToken: tokenId → { owner, pendingUsd, valueUsd }
  const pendingByToken = new Map<string, { owner: string; pendingUsd: number; valueUsd: number }>()

  activePositions.forEach(({ idx, tickLower, tickUpper, liquidity }, j) => {
    const owner  = flat[idx].owner
    const tokenId = flat[idx].tokenId.toString()
    const posHex = posInfoResults[j] as string | null

    // Position value (principal)
    const { amount0, amount1 } = getAmounts(sqrtPriceCurrent, tickLower, tickUpper, liquidity)
    const valueUsd =
      (Number(amount0) / 1e18) * ethPriceUsd +
      (Number(amount1) / 10 ** ZEUS_DECIMALS) * priceData.priceUsd

    if (!posHex || posHex === "0x") {
      pendingByToken.set(tokenId, { owner, pendingUsd: 0, valueUsd })
      return
    }
    const ph = posHex.slice(2)
    const fg0Last = BigInt("0x" + ph.slice(64, 128))
    const fg1Last = BigInt("0x" + ph.slice(128, 192))
    const growth  = growthByRange.get(`${tickLower}:${tickUpper}`)
    if (!growth) {
      pendingByToken.set(tokenId, { owner, pendingUsd: 0, valueUsd })
      return
    }
    const delta0 = (growth.g0 - fg0Last + Q128 * Q128) % (Q128 * Q128)
    const delta1 = (growth.g1 - fg1Last + Q128 * Q128) % (Q128 * Q128)
    const pendingUsd =
      (Number((delta0 * liquidity) / Q128) / 1e18) * ethPriceUsd +
      (Number((delta1 * liquidity) / Q128) / 10 ** ZEUS_DECIMALS) * priceData.priceUsd
    pendingByToken.set(tokenId, { owner, pendingUsd, valueUsd })
  })

  // ── Step 5: load previous snapshots, detect collected fees, update DB ─────────
  const db = process.env.DATABASE_URL ? getDb() : null

  // Load ALL snapshots that have pending fees — not just currently active ones.
  // This allows us to detect when a position was closed (no longer active) and
  // credit its previously-tracked pending fees to accumulated.
  const allPrevSnapshots = new Map<string, { owner: string; pendingUsd: number; accumulatedUsd: number }>()

  if (db) {
    try {
      const rows = await db.query(
        `SELECT token_id, owner, pending_usd::float, accumulated_usd::float
         FROM zeus_position_fees_snapshot`
      )
      for (const row of rows.rows) {
        allPrevSnapshots.set(row.token_id, {
          owner: row.owner,
          pendingUsd: parseFloat(row.pending_usd),
          accumulatedUsd: parseFloat(row.accumulated_usd),
        })
      }
    } catch (e) {
      console.error("Failed to load fee snapshots:", e)
    }
  }

  // Compute new accumulated values and upsert snapshots for currently active positions
  const newSnapshots: { tokenId: string; owner: string; pendingUsd: number; accumulatedUsd: number }[] = []

  for (const [tokenId, { owner, pendingUsd }] of pendingByToken) {
    const prev = allPrevSnapshots.get(tokenId)
    let accumulatedUsd = prev?.accumulatedUsd ?? 0

    // If pending dropped since last snapshot, user collected fees — add the difference
    if (prev && pendingUsd < prev.pendingUsd - 0.001) {
      accumulatedUsd += prev.pendingUsd - pendingUsd
    }

    newSnapshots.push({ tokenId, owner, pendingUsd, accumulatedUsd })
  }

  // For positions that were previously tracked with pending fees but are now gone
  // (closed/burned — no longer in activePositions), credit their pending as collected.
  const activeTokenIdSet = new Set(pendingByToken.keys())
  const closedWithFees: { tokenId: string; owner: string; accumulatedUsd: number }[] = []
  for (const [tokenId, prev] of allPrevSnapshots) {
    if (!activeTokenIdSet.has(tokenId) && prev.pendingUsd > 0.001) {
      // Position closed with pending fees — credit them as collected
      closedWithFees.push({
        tokenId,
        owner: prev.owner,
        accumulatedUsd: prev.accumulatedUsd + prev.pendingUsd,
      })
    }
  }

  if (db) {
    // Upsert active position snapshots
    if (newSnapshots.length > 0) {
      try {
        const values = newSnapshots.map((_, i) =>
          `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4}, NOW())`
        ).join(", ")
        const params = newSnapshots.flatMap(s => [s.tokenId, s.owner, s.pendingUsd, s.accumulatedUsd])
        await db.query(
          `INSERT INTO zeus_position_fees_snapshot (token_id, owner, pending_usd, accumulated_usd, updated_at)
           VALUES ${values}
           ON CONFLICT (token_id) DO UPDATE
             SET owner = EXCLUDED.owner,
                 pending_usd = EXCLUDED.pending_usd,
                 accumulated_usd = EXCLUDED.accumulated_usd,
                 updated_at = EXCLUDED.updated_at`,
          params
        )
      } catch (e) {
        console.error("Failed to upsert fee snapshots:", e)
      }
    }
    // Credit pending fees for closed positions (pending → accumulated, pending reset to 0)
    if (closedWithFees.length > 0) {
      try {
        for (const { tokenId, owner, accumulatedUsd } of closedWithFees) {
          await db.query(
            `UPDATE zeus_position_fees_snapshot
             SET pending_usd = 0, accumulated_usd = $1, updated_at = NOW()
             WHERE token_id = $2 AND owner = $3`,
            [accumulatedUsd, tokenId, owner]
          )
        }
      } catch (e) {
        console.error("Failed to credit closed position fees:", e)
      }
    }
  }

  // ── Step 6: aggregate total fees per owner ────────────────────────────────────
  // For each owner with at least one active position, sum:
  //   - accumulated_usd from ALL their historical snapshots (including closed positions)
  //   - pending_usd from currently active positions only

  // Build active owner → active position count map
  const activeOwnerPositions = new Map<string, number>()
  for (const { idx } of activePositions) {
    const owner = flat[idx].owner
    activeOwnerPositions.set(owner, (activeOwnerPositions.get(owner) ?? 0) + 1)
  }

  // Load full historical accumulated_usd per owner from DB (all tokens, including closed ones)
  const ownerHistorical = new Map<string, number>()
  if (db && activeOwnerPositions.size > 0) {
    try {
      const owners = [...activeOwnerPositions.keys()]
      const rows = await db.query(
        `SELECT owner, SUM(accumulated_usd)::float AS total_accumulated
         FROM zeus_position_fees_snapshot
         WHERE owner = ANY($1)
         GROUP BY owner`,
        [owners]
      )
      for (const row of rows.rows) {
        ownerHistorical.set(row.owner, parseFloat(row.total_accumulated) || 0)
      }
    } catch (e) {
      console.error("Failed to load historical fees per owner:", e)
    }
  }

  // Sum pending fees + position value from active positions
  const ownerPending = new Map<string, number>()
  const ownerValue   = new Map<string, number>()
  for (const [, { owner, pendingUsd, valueUsd }] of pendingByToken) {
    ownerPending.set(owner, (ownerPending.get(owner) ?? 0) + pendingUsd)
    ownerValue.set(owner, (ownerValue.get(owner) ?? 0) + valueUsd)
  }

  // Final aggregation: only owners with active positions appear in leaderboard
  const ownerFees = new Map<string, { totalFeesUsd: number; totalValueUsd: number; positions: number }>()
  for (const [owner, positions] of activeOwnerPositions) {
    const accumulated = ownerHistorical.get(owner) ?? 0
    const pending     = ownerPending.get(owner) ?? 0
    const value       = ownerValue.get(owner) ?? 0
    ownerFees.set(owner, { totalFeesUsd: accumulated + pending, totalValueUsd: value, positions })
  }

  return [...ownerFees.entries()]
    .sort((a, b) => b[1].totalFeesUsd - a[1].totalFeesUsd)
    .slice(0, 10)
    .map(([address, { totalFeesUsd, totalValueUsd, positions }], i) => ({
      rank: i + 1,
      address,
      uncollectedFeesUsd: totalFeesUsd,
      totalValueUsd,
      positionCount: positions,
    }))
}

async function saveCache(leaderboard: unknown[]) {
  if (!process.env.DATABASE_URL) return
  try {
    const db = getDb()
    await db.query(
      `INSERT INTO zeus_user_positions_cache (address, positions, computed_at)
       VALUES ('__leaderboard__', $1, NOW())
       ON CONFLICT (address) DO UPDATE
       SET positions = EXCLUDED.positions, computed_at = EXCLUDED.computed_at`,
      [JSON.stringify(leaderboard)]
    )
  } catch {}
}

// ── handler ───────────────────────────────────────────────────────────────────

export async function GET() {
  let cachedData: unknown[] | null = null
  let cacheAge = Infinity

  if (process.env.DATABASE_URL) {
    try {
      await ensureSchema()
      const db = getDb()
      const row = await db.query(
        `SELECT positions, computed_at FROM zeus_user_positions_cache WHERE address = '__leaderboard__'`
      )
      if (row.rows.length > 0) {
        cachedData = row.rows[0].positions
        cacheAge = Date.now() - new Date(row.rows[0].computed_at).getTime()
      }
    } catch {}
  }

  // Cache is fresh — return immediately
  if (cachedData && cacheAge < CACHE_TTL_MS) {
    return NextResponse.json({ leaderboard: cachedData, cached: true })
  }

  // Cache stale or missing — return what we have immediately (empty array if nothing),
  // recompute in background via waitUntil so Vercel keeps the function alive even if
  // the visitor closes the page before the response is sent.
  waitUntil(buildLeaderboard().then(saveCache).catch(console.error))
  return NextResponse.json({ leaderboard: cachedData ?? [], cached: !!cachedData, stale: true })
}
