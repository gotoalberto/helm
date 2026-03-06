/**
 * MCAP-Based Range Math for Uniswap V4
 *
 * CRITICAL: ZEUS has 9 decimals, NOT 18.
 * This module handles conversions between market cap (USD) and Uniswap V4 ticks
 * for the ETH/ZEUS pool, accounting for decimal differences.
 *
 * Pool Configuration:
 * - currency0 = ETH (address(0), 18 decimals)
 * - currency1 = ZEUS (9 decimals)
 * - Decimal adjustment = 10^(9-18) = 10^-9
 *
 * Math Explanation:
 * 1. Market cap (USD) → ZEUS price in USD
 *    zeusUsdPrice = marketCap / totalSupply
 *
 * 2. ZEUS price in USD → ZEUS price in ETH
 *    zeusEthPrice = zeusUsdPrice / ethUsdPrice
 *
 * 3. ZEUS price in ETH → Pool price ratio
 *    For Uniswap V4, the pool tracks "amount of currency1 per unit of currency0"
 *    But we need to account for decimal differences:
 *    priceRatio = zeusEthPrice * 10^(ZEUS_DECIMALS - ETH_DECIMALS)
 *    priceRatio = zeusEthPrice * 10^-9
 *
 * 4. Pool price ratio → Tick
 *    tick = floor(log(priceRatio) / log(1.0001))
 *
 * 5. Round to tickSpacing (60)
 *    finalTick = round(tick / 60) * 60
 */

import { ZEUS_DECIMALS, ETH_DECIMALS, POOL_TICK_SPACING } from "@/lib/constants"

// Decimal adjustment factor for Uniswap V4 price calculations
// currency0 = ETH (18 decimals), currency1 = ZEUS (9 decimals)
// adjustment = 10^(decimals1 - decimals0) = 10^(9 - 18) = 10^-9
const DECIMAL_ADJUSTMENT = 10 ** (ZEUS_DECIMALS - ETH_DECIMALS)

/**
 * Convert market cap (USD) to Uniswap V4 tick for ZEUS/ETH pool
 *
 * @param mcapUsd - Target market cap in USD
 * @param ethPriceUsd - Current ETH price in USD
 * @param totalSupplyRaw - ZEUS total supply in raw units (9 decimals)
 * @returns tick (rounded to nearest multiple of tickSpacing=60)
 */
export function mcapToTick(
  mcapUsd: number,
  ethPriceUsd: number,
  totalSupplyRaw: bigint
): number {
  if (mcapUsd <= 0 || ethPriceUsd <= 0 || totalSupplyRaw <= 0n) {
    throw new Error("Invalid inputs: all values must be positive")
  }

  // Convert total supply to human-readable units
  const totalSupplyHuman = Number(totalSupplyRaw) / 10 ** ZEUS_DECIMALS

  // Calculate ZEUS price in USD
  const zeusUsdPrice = mcapUsd / totalSupplyHuman

  // Calculate how many ZEUS per 1 ETH (human units)
  // zeusPerEth = ethPriceUsd / zeusUsdPrice
  const zeusPerEthHuman = ethPriceUsd / zeusUsdPrice

  // V4 pool price ratio = currency1_raw / currency0_raw = ZEUS_raw / ETH_raw
  // = zeusPerEthHuman * 10^ZEUS_DECIMALS / 10^ETH_DECIMALS
  // = zeusPerEthHuman * DECIMAL_ADJUSTMENT  (DECIMAL_ADJUSTMENT = 10^(9-18) = 1e-9)
  const priceRatio = zeusPerEthHuman * DECIMAL_ADJUSTMENT

  if (priceRatio <= 0) {
    throw new Error("Price ratio must be positive")
  }

  // Calculate tick: tick = log(priceRatio) / log(1.0001)
  const tick = Math.floor(Math.log(priceRatio) / Math.log(1.0001))

  // Round to nearest tickSpacing multiple
  return Math.round(tick / POOL_TICK_SPACING) * POOL_TICK_SPACING
}

/**
 * Convert tick back to market cap (USD) — for display
 *
 * @param tick - Uniswap V4 tick
 * @param ethPriceUsd - Current ETH price in USD
 * @param totalSupplyRaw - ZEUS total supply in raw units (9 decimals)
 * @returns market cap in USD
 */
export function tickToMcap(
  tick: number,
  ethPriceUsd: number,
  totalSupplyRaw: bigint
): number {
  if (ethPriceUsd <= 0 || totalSupplyRaw <= 0n) {
    throw new Error("Invalid inputs: ethPriceUsd and totalSupply must be positive")
  }

  // Convert total supply to human-readable units
  const totalSupplyHuman = Number(totalSupplyRaw) / 10 ** ZEUS_DECIMALS

  // priceRatio = 1.0001^tick = ZEUS_raw / ETH_raw
  const priceRatio = 1.0001 ** tick

  // zeusPerEthHuman = priceRatio / DECIMAL_ADJUSTMENT
  const zeusPerEthHuman = priceRatio / DECIMAL_ADJUSTMENT

  // ZEUS price in USD = ethPriceUsd / zeusPerEthHuman
  const zeusUsdPrice = ethPriceUsd / zeusPerEthHuman

  // Market cap
  return zeusUsdPrice * totalSupplyHuman
}

/**
 * Convert tick to ZEUS price in ETH
 *
 * @param tick - Uniswap V4 tick
 * @returns ZEUS price in ETH (how many ETH per 1 ZEUS)
 */
export function tickToZeusEthPrice(tick: number): number {
  const priceRatio = 1.0001 ** tick
  const zeusPerEth = priceRatio / DECIMAL_ADJUSTMENT
  // Return price of 1 ZEUS in ETH
  return 1 / zeusPerEth
}

/**
 * Convert ZEUS price in ETH to tick
 *
 * @param zeusEthPrice - Price of 1 ZEUS in ETH
 * @returns tick (rounded to tickSpacing)
 */
export function zeusEthPriceToTick(zeusEthPrice: number): number {
  if (zeusEthPrice <= 0) {
    throw new Error("ZEUS ETH price must be positive")
  }

  const zeusPerEth = 1 / zeusEthPrice
  const priceRatio = zeusPerEth * DECIMAL_ADJUSTMENT

  const tick = Math.floor(Math.log(priceRatio) / Math.log(1.0001))
  return Math.round(tick / POOL_TICK_SPACING) * POOL_TICK_SPACING
}

/**
 * Validate tick is within acceptable bounds and divisible by tickSpacing
 *
 * @param tick - Tick to validate
 * @returns true if valid
 */
export function isValidTick(tick: number): boolean {
  const MIN_TICK = -887272
  const MAX_TICK = 887272

  if (tick < MIN_TICK || tick > MAX_TICK) {
    return false
  }

  if (tick % POOL_TICK_SPACING !== 0) {
    return false
  }

  return true
}

/**
 * Get preset range based on current market cap and multipliers
 *
 * @param currentMcap - Current ZEUS market cap in USD
 * @param minMultiplier - Multiplier for lower bound (e.g., 0.8 = 80% of current)
 * @param maxMultiplier - Multiplier for upper bound (e.g., 3 = 300% of current)
 * @param ethPriceUsd - Current ETH price in USD
 * @param totalSupplyRaw - ZEUS total supply in raw units (9 decimals)
 * @returns { minTick, maxTick, minMcap, maxMcap }
 */
export function getPresetRange(
  currentMcap: number,
  minMultiplier: number,
  maxMultiplier: number,
  ethPriceUsd: number,
  totalSupplyRaw: bigint
) {
  const minMcap = currentMcap * minMultiplier
  const maxMcap = currentMcap * maxMultiplier

  const minTick = mcapToTick(minMcap, ethPriceUsd, totalSupplyRaw)
  const maxTick = mcapToTick(maxMcap, ethPriceUsd, totalSupplyRaw)

  return {
    minTick,
    maxTick,
    minMcap,
    maxMcap,
  }
}
