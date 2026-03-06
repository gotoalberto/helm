/**
 * Uniswap V4 Position Management
 *
 * V4 PositionManager uses different functions than V3:
 *   - getPoolAndPositionInfo(uint256 tokenId) → (PoolKey, PositionInfo packed bytes32)
 *   - getPositionLiquidity(uint256 tokenId) → uint128
 *   - PositionInfo is packed bytes32: poolId prefix | tickUpper (24 bits) | tickLower (24 bits) | hasSubscriber (1 bit)
 *
 * V4 PoolManager for current price:
 *   - getSlot0(PoolId) → (sqrtPriceX96, tick, protocolFee, lpFee)
 */

import { encodeAbiParameters, keccak256, isAddress } from "viem"
import { getLogs, ethCall, alchemyBatchRpcCall } from "@/lib/services/alchemy"
import {
  UNISWAP_V4_POSITION_MANAGER,
  UNISWAP_V4_POOL_MANAGER,
  UNISWAP_V4_STATE_VIEW,
  ZEUS_TOKEN_ADDRESS,
  ZEUS_DECIMALS,
  POOL_FEE,
  POOL_TICK_SPACING,
  POOL_HOOKS_ADDRESS,
} from "@/lib/constants"
import { Position } from "@/types"
import { tickToMcap, tickToZeusEthPrice } from "@/lib/uniswap/mcap"

// ERC721 Transfer event topic
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

// V4 PositionManager function selectors
// getPoolAndPositionInfo(uint256): 0x7ba03aad
// getPositionLiquidity(uint256): 0x1efeed33
// V4 PoolManager: getSlot0(bytes32): 0xc815641c

// PoolId for ETH/ZEUS fee=3000 tickSpacing=60 hooks=0x0
// Computed as keccak256(abi.encode(poolKey))
function computePoolId(): `0x${string}` {
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

/**
 * Get current tick from the V4 PoolManager via getSlot0(poolId)
 */
export async function getCurrentPoolTick(): Promise<number> {
  try {
    const poolId = computePoolId()
    // getSlot0(bytes32 poolId) selector = 0xc815641c
    const data = `0xc815641c${poolId.slice(2)}` as `0x${string}`
    const result = await ethCall({ to: UNISWAP_V4_POOL_MANAGER, data })
    if (!result || result === "0x") return 0
    // Returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)
    // slot 0 = sqrtPriceX96 (uint160, padded to 32 bytes)
    // slot 1 = tick (int24, padded to 32 bytes)
    const hex = (result as string).slice(2)
    const tickRaw = parseInt(hex.slice(64, 128), 16)
    return tickRaw > 0x7fffffff ? tickRaw - 0x100000000 : tickRaw
  } catch {
    return 0
  }
}

/**
 * Get all position NFT token IDs currently owned by an address.
 * Returns tokenId + the blockNumber of the first Transfer-in (mint block).
 */
export async function getUserPositionTokenIds(
  userAddress: string
): Promise<{ tokenId: bigint; mintBlock: string }[]> {
  try {
    const fromBlockHex = `0x${(21355000).toString(16)}`
    const addr = userAddress.slice(2).toLowerCase()

    // Fetch transfers IN (to=user) and OUT (from=user) in parallel
    const [logsIn, logsOut] = await Promise.all([
      getLogs({
        address: UNISWAP_V4_POSITION_MANAGER,
        fromBlock: fromBlockHex,
        toBlock: "latest",
        topics: [TRANSFER_TOPIC, null, `0x000000000000000000000000${addr}`],
      }),
      getLogs({
        address: UNISWAP_V4_POSITION_MANAGER,
        fromBlock: fromBlockHex,
        toBlock: "latest",
        topics: [TRANSFER_TOPIC, `0x000000000000000000000000${addr}`, null],
      }),
    ])

    // Track earliest Transfer-in block per tokenId
    const mintBlockByToken = new Map<string, string>()
    for (const l of logsIn) {
      const id = BigInt(l.topics[3]).toString()
      if (!mintBlockByToken.has(id)) mintBlockByToken.set(id, l.blockNumber)
    }

    const sent = new Set(logsOut.map((l) => BigInt(l.topics[3]).toString()))

    // Only keep tokens received but not sent away / burned
    return [...mintBlockByToken.entries()]
      .filter(([id]) => !sent.has(id))
      .map(([id, mintBlock]) => ({ tokenId: BigInt(id), mintBlock }))
  } catch (error) {
    console.error("Failed to fetch position token IDs:", error)
    return []
  }
}

/**
 * Batch-fetch block timestamps for a list of block numbers (hex strings).
 * Returns a map of blockNumber → unix timestamp (seconds).
 */
export async function getBlockTimestamps(
  blockNumbers: string[]
): Promise<Map<string, number>> {
  const unique = [...new Set(blockNumbers)]
  if (unique.length === 0) return new Map()

  const results = await alchemyBatchRpcCall(
    unique.map((b) => ({ method: "eth_getBlockByNumber", params: [b, false] }))
  )

  const map = new Map<string, number>()
  for (let i = 0; i < unique.length; i++) {
    const block = results[i]
    if (block?.timestamp) {
      map.set(unique[i], parseInt(block.timestamp, 16))
    }
  }
  return map
}

/**
 * Decode PositionInfo packed bytes32:
 * bit 0: hasSubscriber
 * bits 8..31: tickLower (24-bit signed)
 * bits 32..55: tickUpper (24-bit signed)
 * bits 56..255: poolId prefix (200 bits)
 */
function decodePositionInfo(packed: `0x${string}`): { tickLower: number; tickUpper: number } {
  const val = BigInt(packed)
  const tickLowerRaw = (val >> 8n) & 0xFFFFFFn
  const tickUpperRaw = (val >> 32n) & 0xFFFFFFn
  const tickLower = tickLowerRaw >= 0x800000n ? Number(tickLowerRaw) - 0x1000000 : Number(tickLowerRaw)
  const tickUpper = tickUpperRaw >= 0x800000n ? Number(tickUpperRaw) - 0x1000000 : Number(tickUpperRaw)
  return { tickLower, tickUpper }
}

/**
 * Fetch position data for a tokenId using V4-correct functions
 */
export async function getV4PositionInfo(tokenId: bigint): Promise<{
  tickLower: number; tickUpper: number; liquidity: bigint
} | null> {
  try {
    const tokenIdHex = tokenId.toString(16).padStart(64, "0")

    const [infoResult, liqResult] = await Promise.all([
      ethCall({ to: UNISWAP_V4_POSITION_MANAGER, data: `0x7ba03aad${tokenIdHex}` as `0x${string}` }),
      ethCall({ to: UNISWAP_V4_POSITION_MANAGER, data: `0x1efeed33${tokenIdHex}` as `0x${string}` }),
    ])

    if (!infoResult || infoResult === "0x") return null

    // getPoolAndPositionInfo returns (PoolKey poolKey, PositionInfo info)
    // PoolKey = 5 slots (currency0, currency1, fee, tickSpacing, hooks)
    // PositionInfo = 1 slot (packed bytes32)
    const infoHex = (infoResult as string).slice(2)
    const positionInfoPacked = `0x${infoHex.slice(5 * 64, 6 * 64)}` as `0x${string}`
    const { tickLower, tickUpper } = decodePositionInfo(positionInfoPacked)

    const liquidity = liqResult && liqResult !== "0x" ? BigInt(liqResult as string) : 0n

    return { tickLower, tickUpper, liquidity }
  } catch (error) {
    console.error(`Failed to fetch V4 position ${tokenId}:`, error)
    return null
  }
}

/**
 * Calculate token amounts from liquidity using sqrtPrice math
 */
function getAmountsForLiquidity(
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint
): { amount0: bigint; amount1: bigint } {
  if (liquidity === 0n) return { amount0: 0n, amount1: 0n }

  const Q96 = 2n ** 96n
  const sqrtPriceLower = BigInt(Math.floor(Math.sqrt(1.0001 ** tickLower) * Number(Q96)))
  const sqrtPriceUpper = BigInt(Math.floor(Math.sqrt(1.0001 ** tickUpper) * Number(Q96)))

  let amount0 = 0n
  let amount1 = 0n

  if (sqrtPriceX96 <= sqrtPriceLower) {
    // All token0 (ETH)
    amount0 = (liquidity * Q96 * (sqrtPriceUpper - sqrtPriceLower)) / (sqrtPriceUpper * sqrtPriceLower)
  } else if (sqrtPriceX96 < sqrtPriceUpper) {
    // Both tokens
    amount0 = (liquidity * Q96 * (sqrtPriceUpper - sqrtPriceX96)) / (sqrtPriceUpper * sqrtPriceX96)
    amount1 = (liquidity * (sqrtPriceX96 - sqrtPriceLower)) / Q96
  } else {
    // All token1 (ZEUS)
    amount1 = (liquidity * (sqrtPriceUpper - sqrtPriceLower)) / Q96
  }

  return { amount0, amount1 }
}

/**
 * Get sqrtPriceX96 from pool tick (approximation for amount calculation)
 */
function tickToSqrtPriceX96(tick: number): bigint {
  const Q96 = 2n ** 96n
  return BigInt(Math.floor(Math.sqrt(1.0001 ** tick) * Number(Q96)))
}

/**
 * Get uncollected fees for a V4 position using StateView.
 *
 * Uses:
 *   - getPositionInfo(poolId, owner=PositionManager, tickLower, tickUpper, salt=tokenId)
 *     → feeGrowthInside0LastX128, feeGrowthInside1LastX128
 *   - getFeeGrowthInside(poolId, tickLower, tickUpper)
 *     → current feeGrowthInside0X128, feeGrowthInside1X128
 *
 * pendingFees = (feeGrowthInsideCurrent - feeGrowthInsideLast) * liquidity / 2^128
 */
export async function getPositionFees(
  tokenId: bigint,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint
): Promise<{ tokensOwed0: bigint; tokensOwed1: bigint }> {
  try {
    if (liquidity === 0n) return { tokensOwed0: 0n, tokensOwed1: 0n }
    const poolId = computePoolId()

    // ABI-encode int24 as int256 (sign-extend to 32 bytes)
    const encodeInt24 = (v: number) => (v < 0 ? (BigInt(v) + (1n << 256n)) : BigInt(v)).toString(16).padStart(64, "0")
    const tickLowerHex = encodeInt24(tickLower)
    const tickUpperHex = encodeInt24(tickUpper)
    const saltHex = tokenId.toString(16).padStart(64, "0")
    const ownerHex = UNISWAP_V4_POSITION_MANAGER.slice(2).toLowerCase().padStart(64, "0")

    // getPositionInfo(bytes32,address,int24,int24,bytes32) selector: 0xdacf1d2f
    const posInfoData = `0xdacf1d2f${poolId.slice(2)}${ownerHex}${tickLowerHex}${tickUpperHex}${saltHex}` as `0x${string}`

    // getFeeGrowthInside(bytes32,int24,int24) selector: 0x53e9c1fb
    const feeGrowthData = `0x53e9c1fb${poolId.slice(2)}${tickLowerHex}${tickUpperHex}` as `0x${string}`

    const [posInfoResult, feeGrowthResult] = await Promise.all([
      ethCall({ to: UNISWAP_V4_STATE_VIEW, data: posInfoData }),
      ethCall({ to: UNISWAP_V4_STATE_VIEW, data: feeGrowthData }),
    ])

    if (!posInfoResult || posInfoResult === "0x" || !feeGrowthResult || feeGrowthResult === "0x") {
      return { tokensOwed0: 0n, tokensOwed1: 0n }
    }

    // getPositionInfo returns (uint128 liquidity, uint256 feeGrowthInside0Last, uint256 feeGrowthInside1Last)
    // ABI encoding: slot0=32bytes (uint128 right-aligned), slot1=32bytes, slot2=32bytes
    const posHex = (posInfoResult as string).slice(2)
    const feeGrowthInside0Last = BigInt("0x" + posHex.slice(64, 128))   // slot 1
    const feeGrowthInside1Last = BigInt("0x" + posHex.slice(128, 192))  // slot 2

    // getFeeGrowthInside returns (uint256 feeGrowthInside0X128, uint256 feeGrowthInside1X128)
    const feeHex = (feeGrowthResult as string).slice(2)
    const feeGrowthInside0Now = BigInt("0x" + feeHex.slice(0, 64))
    const feeGrowthInside1Now = BigInt("0x" + feeHex.slice(64, 128))

    const Q128 = 2n ** 128n
    // Use modular subtraction to handle uint256 wraparound
    const delta0 = (feeGrowthInside0Now - feeGrowthInside0Last + Q128 * Q128) % (Q128 * Q128)
    const delta1 = (feeGrowthInside1Now - feeGrowthInside1Last + Q128 * Q128) % (Q128 * Q128)

    const tokensOwed0 = (delta0 * liquidity) / Q128
    const tokensOwed1 = (delta1 * liquidity) / Q128

    return { tokensOwed0, tokensOwed1 }
  } catch (err) {
    console.error("getPositionFees error:", err)
    return { tokensOwed0: 0n, tokensOwed1: 0n }
  }
}

/**
 * Enrich a V4 position with USD values and market data
 */
export async function buildPosition(
  tokenId: bigint,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint,
  currentTick: number,
  ethPriceUsd: number,
  zeusPriceUsd: number,
  totalSupplyRaw: bigint,
  owner: string,
  openedAt: number = 0
): Promise<Position> {
  const sqrtPriceCurrent = tickToSqrtPriceX96(currentTick)
  const { amount0, amount1 } = getAmountsForLiquidity(sqrtPriceCurrent, tickLower, tickUpper, liquidity)

  const amount0Human = Number(amount0) / 1e18
  const amount1Human = Number(amount1) / (10 ** ZEUS_DECIMALS)
  const totalValueUsd = amount0Human * ethPriceUsd + amount1Human * zeusPriceUsd

  const minMcap = tickToMcap(tickLower, ethPriceUsd, totalSupplyRaw)
  const maxMcap = tickToMcap(tickUpper, ethPriceUsd, totalSupplyRaw)
  const minPriceEth = tickToZeusEthPrice(tickLower)
  const maxPriceEth = tickToZeusEthPrice(tickUpper)

  let status: "in-range" | "out-of-range" | "closed"
  if (liquidity === 0n) {
    status = "closed"
  } else if (currentTick >= tickLower && currentTick < tickUpper) {
    status = "in-range"
  } else {
    status = "out-of-range"
  }

  const { tokensOwed0, tokensOwed1 } = await getPositionFees(tokenId, tickLower, tickUpper, liquidity)
  const feesEthUsd = (Number(tokensOwed0) / 1e18) * ethPriceUsd
  const feesZeusUsd = (Number(tokensOwed1) / 10 ** ZEUS_DECIMALS) * zeusPriceUsd
  const uncollectedFeesUsd = feesEthUsd + feesZeusUsd

  return {
    tokenId,
    owner,
    tickLower,
    tickUpper,
    liquidity,
    feeGrowthInside0LastX128: 0n,
    feeGrowthInside1LastX128: 0n,
    tokensOwed0,
    tokensOwed1,
    amount0,
    amount1,
    totalValueUsd,
    status,
    minMcap,
    maxMcap,
    minPriceEth,
    maxPriceEth,
    uncollectedFeesUsd,
    openedAt,
  }
}

const BIGINT_FIELDS = [
  "tokenId", "liquidity", "amount0", "amount1",
  "tokensOwed0", "tokensOwed1",
  "feeGrowthInside0LastX128", "feeGrowthInside1LastX128",
] as const

export function serializePosition(p: Position): Record<string, unknown> {
  const result: Record<string, unknown> = { ...p }
  for (const field of BIGINT_FIELDS) {
    result[field] = (p[field] as bigint).toString()
  }
  return result
}

export function deserializePosition(raw: Record<string, unknown>): Position {
  const result = { ...raw } as Record<string, unknown>
  for (const field of BIGINT_FIELDS) {
    result[field] = BigInt(raw[field] as string)
  }
  return result as unknown as Position
}
