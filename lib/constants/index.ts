/**
 * ZEUS Liquidity Manager — Core Constants
 *
 * CRITICAL: ZEUS token has 9 decimals, NOT 18.
 * All tick calculations and amount conversions MUST use 1e9 for ZEUS.
 */

// ============================================================================
// Token Configuration
// ============================================================================

export const ZEUS_TOKEN_ADDRESS = "0x0f7dC5D02CC1E1f5Ee47854d534D332A1081cCC8" as const
export const ZEUS_DECIMALS = 9
export const ETH_DECIMALS = 18

// Decimal adjustment factor for Uniswap V4 price calculations
// currency0 = ETH (18 decimals), currency1 = ZEUS (9 decimals)
// adjustment = 10^(decimals1 - decimals0) = 10^(9 - 18) = 10^-9
export const DECIMAL_ADJUSTMENT = 10 ** (ZEUS_DECIMALS - ETH_DECIMALS)

// ============================================================================
// Uniswap V4 Contract Addresses (Ethereum Mainnet)
// ============================================================================

export const UNISWAP_V4_POSITION_MANAGER = "0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e" as const
export const UNISWAP_V4_POOL_MANAGER = "0x000000000004444c5dc75cB358380D2e3dE08A90" as const
export const UNISWAP_V4_STATE_VIEW = "0x7ffe42c4a5deea5b0fec41c94c136cf115597227" as const

// ============================================================================
// Pool Configuration
// ============================================================================

export const POOL_FEE = 3000 // 0.3%
export const POOL_TICK_SPACING = 60
export const POOL_HOOKS_ADDRESS = "0x0000000000000000000000000000000000000000" as const

// ============================================================================
// Chain Configuration
// ============================================================================

export const CHAIN_ID = 1 // Ethereum Mainnet

// ============================================================================
// Uniswap V2 ZEUS/ETH Pair (for APR calculation)
// ============================================================================

export const ZEUS_V2_PAIR = "0xf97503af8230a7e72909d6614f45e88168ff3c10" as const

// ============================================================================
// API Configuration
// ============================================================================

export const COINGECKO_API_KEY = process.env.NEXT_PUBLIC_COINGECKO_API_KEY
// ALCHEMY_API_KEY is server-side only (no NEXT_PUBLIC_ prefix) — used only in /app/api/rpc/route.ts
export const REOWN_PROJECT_ID = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID?.trim()

// ============================================================================
// Trading Configuration
// ============================================================================

export const DEFAULT_SLIPPAGE_TOLERANCE = 0.5 // 0.5%
export const SLIPPAGE_OPTIONS = [0.1, 0.5, 1.0] as const
export const TRANSACTION_DEADLINE_MINUTES = 20

// ============================================================================
// MCAP Range Presets
// ============================================================================

export const MCAP_RANGE_PRESETS = {
  conservative: { minMultiplier: 0.8, maxMultiplier: 3 },
  moderate: { minMultiplier: 0.5, maxMultiplier: 10 },
  aggressive: { minMultiplier: 0.2, maxMultiplier: 50 },
} as const

// ============================================================================
// UI Configuration
// ============================================================================

export const QUERY_STALE_TIME = 60_000 // 60 seconds
export const QUERY_CACHE_TIME = 5 * 60_000 // 5 minutes

// Etherscan URLs
export const ETHERSCAN_BASE_URL = "https://etherscan.io"
export const getEtherscanTxUrl = (txHash: string) => `${ETHERSCAN_BASE_URL}/tx/${txHash}`
export const getEtherscanAddressUrl = (address: string) => `${ETHERSCAN_BASE_URL}/address/${address}`
export const getEtherscanTokenUrl = (address: string) => `${ETHERSCAN_BASE_URL}/token/${address}`
