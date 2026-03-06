/**
 * ZEUS Liquidity Manager — Type Definitions
 */

// ============================================================================
// Token Types
// ============================================================================

export interface TokenAmount {
  amount: bigint
  decimals: number
  symbol: string
  formatted: string
  usdValue?: number
}

export interface TokenBalance {
  address: string
  balance: bigint
  decimals: number
  symbol: string
  formatted: string
}

// ============================================================================
// Price & Market Data Types
// ============================================================================

export interface PriceData {
  priceUsd: number
  priceEth: number
  marketCapUsd: number
  fullyDilutedValuation: number
  totalSupply: bigint // Raw units (9 decimals for ZEUS)
  circulatingSupply: number // Human-readable
  volume24h: number
  priceChange24h: number
  priceChange7d: number
  lastUpdated: number
}

export interface OHLCData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export interface ChartTimeframe {
  label: string
  value: string
  days: number
}

// ============================================================================
// Uniswap V4 Pool Types
// ============================================================================

export interface PoolState {
  sqrtPriceX96: bigint
  tick: number
  liquidity: bigint
  feeGrowthGlobal0X128: bigint
  feeGrowthGlobal1X128: bigint
}

export interface PoolKey {
  currency0: string // ETH = address(0)
  currency1: string // ZEUS address
  fee: number
  tickSpacing: number
  hooks: string
}

// ============================================================================
// Position Types
// ============================================================================

export interface Position {
  tokenId: bigint
  owner: string
  tickLower: number
  tickUpper: number
  liquidity: bigint
  feeGrowthInside0LastX128: bigint
  feeGrowthInside1LastX128: bigint
  tokensOwed0: bigint
  tokensOwed1: bigint
  amount0: bigint // ETH amount in position
  amount1: bigint // ZEUS amount in position
  totalValueUsd: number
  status: "in-range" | "out-of-range" | "closed"
  minMcap: number // USD
  maxMcap: number // USD
  minPriceEth: number
  maxPriceEth: number
  uncollectedFeesUsd: number
  openedAt: number // Unix timestamp (seconds) of the mint block
}

export interface PositionInfo {
  tokenId: bigint
  poolKey: PoolKey
  tickLower: number
  tickUpper: number
  liquidity: bigint
  feeGrowthInside0LastX128: bigint
  feeGrowthInside1LastX128: bigint
  tokensOwed0: bigint
  tokensOwed1: bigint
}

// ============================================================================
// Range Selector Types
// ============================================================================

export interface PriceRange {
  minMcap: number // USD
  maxMcap: number // USD
  minTick: number
  maxTick: number
  minPriceEth: number
  maxPriceEth: number
  minPriceUsd: number
  maxPriceUsd: number
}

export type RangePreset = "conservative" | "moderate" | "aggressive" | "custom"

// ============================================================================
// Transaction Types
// ============================================================================

export interface TransactionStatus {
  status: "idle" | "pending" | "success" | "error"
  hash?: string
  error?: Error
}

export interface AddLiquidityParams {
  amount0Desired: bigint // ETH
  amount1Desired: bigint // ZEUS
  amount0Min: bigint
  amount1Min: bigint
  tickLower: number
  tickUpper: number
  recipient: string
  deadline: bigint
  slippageTolerance: number
}

export interface RemoveLiquidityParams {
  tokenId: bigint
  liquidity: bigint
  amount0Min: bigint
  amount1Min: bigint
  deadline: bigint
}

export interface CollectFeesParams {
  tokenId: bigint
  recipient: string
  amount0Max: bigint
  amount1Max: bigint
}

// ============================================================================
// Fee Types
// ============================================================================

export interface FeeData {
  amount0: bigint // ETH fees
  amount1: bigint // ZEUS fees
  usdValue: number
  timestamp: number
  txHash: string
}

export interface FeesSummary {
  totalFeesUsd: number
  uncollectedFeesUsd: number
  collectedFeesUsd: number
  feesByPosition: Map<bigint, FeeData[]>
}
