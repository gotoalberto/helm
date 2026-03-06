/**
 * MCAP Range Math Tests
 *
 * Validates tick calculations with ZEUS 9-decimal precision
 */

import {
  mcapToTick,
  tickToMcap,
  tickToZeusEthPrice,
  zeusEthPriceToTick,
  isValidTick,
  getPresetRange,
} from "@/lib/uniswap/mcap"

// Test constants
const ETH_PRICE_USD = 3000
const ZEUS_TOTAL_SUPPLY = BigInt(1_000_000_000 * 10 ** 9) // 1B ZEUS with 9 decimals

describe("MCAP to Tick Conversion (9 Decimals)", () => {
  test("converts $1M market cap to tick correctly", () => {
    const mcap = 1_000_000 // $1M
    const tick = mcapToTick(mcap, ETH_PRICE_USD, ZEUS_TOTAL_SUPPLY)

    expect(tick).toBeDefined()
    expect(Math.abs(tick % 60)).toBe(0) // Must be divisible by tickSpacing
    expect(isValidTick(tick)).toBe(true)
  })

  test("converts $10M market cap to tick correctly", () => {
    const mcap = 10_000_000 // $10M
    const tick = mcapToTick(mcap, ETH_PRICE_USD, ZEUS_TOTAL_SUPPLY)

    expect(Math.abs(tick % 60)).toBe(0)
    expect(isValidTick(tick)).toBe(true)
  })

  test("converts $100M market cap to tick correctly", () => {
    const mcap = 100_000_000 // $100M
    const tick = mcapToTick(mcap, ETH_PRICE_USD, ZEUS_TOTAL_SUPPLY)

    expect(Math.abs(tick % 60)).toBe(0)
    expect(isValidTick(tick)).toBe(true)
  })

  test("higher mcap produces higher tick", () => {
    const mcap1M = mcapToTick(1_000_000, ETH_PRICE_USD, ZEUS_TOTAL_SUPPLY)
    const mcap10M = mcapToTick(10_000_000, ETH_PRICE_USD, ZEUS_TOTAL_SUPPLY)
    const mcap100M = mcapToTick(100_000_000, ETH_PRICE_USD, ZEUS_TOTAL_SUPPLY)

    expect(mcap10M).toBeGreaterThan(mcap1M)
    expect(mcap100M).toBeGreaterThan(mcap10M)
  })

  test("throws on invalid inputs", () => {
    expect(() => mcapToTick(0, ETH_PRICE_USD, ZEUS_TOTAL_SUPPLY)).toThrow()
    expect(() => mcapToTick(-1000, ETH_PRICE_USD, ZEUS_TOTAL_SUPPLY)).toThrow()
    expect(() => mcapToTick(1_000_000, 0, ZEUS_TOTAL_SUPPLY)).toThrow()
    expect(() => mcapToTick(1_000_000, ETH_PRICE_USD, 0n)).toThrow()
  })
})

describe("Tick to MCAP Conversion (Reversibility)", () => {
  test("mcap -> tick -> mcap roundtrip preserves value within tolerance", () => {
    const originalMcap = 5_000_000 // $5M
    const tick = mcapToTick(originalMcap, ETH_PRICE_USD, ZEUS_TOTAL_SUPPLY)
    const recoveredMcap = tickToMcap(tick, ETH_PRICE_USD, ZEUS_TOTAL_SUPPLY)

    // Allow 1% tolerance due to tick rounding
    const tolerance = originalMcap * 0.01
    expect(Math.abs(recoveredMcap - originalMcap)).toBeLessThan(tolerance)
  })

  test("tick -> mcap works for various ticks", () => {
    const tick = -276000 // Example tick
    const mcap = tickToMcap(tick, ETH_PRICE_USD, ZEUS_TOTAL_SUPPLY)

    expect(mcap).toBeGreaterThan(0)
    expect(Number.isFinite(mcap)).toBe(true)
  })
})

describe("ZEUS ETH Price Conversions", () => {
  test("tick to ZEUS ETH price returns positive value", () => {
    const tick = -276000
    const price = tickToZeusEthPrice(tick)

    expect(price).toBeGreaterThan(0)
    expect(Number.isFinite(price)).toBe(true)
  })

  test("ZEUS ETH price to tick roundtrip", () => {
    const originalPrice = 0.00001 // 1 ZEUS = 0.00001 ETH
    const tick = zeusEthPriceToTick(originalPrice)
    const recoveredPrice = tickToZeusEthPrice(tick)

    // Allow 1% tolerance due to tick rounding
    const tolerance = originalPrice * 0.01
    expect(Math.abs(recoveredPrice - originalPrice)).toBeLessThan(tolerance)
  })

  test("throws on zero or negative price", () => {
    expect(() => zeusEthPriceToTick(0)).toThrow()
    expect(() => zeusEthPriceToTick(-0.001)).toThrow()
  })
})

describe("Tick Validation", () => {
  test("valid tick divisible by 60", () => {
    expect(isValidTick(-276000)).toBe(true)
    expect(isValidTick(0)).toBe(true)
    expect(isValidTick(276000)).toBe(true)
  })

  test("invalid tick not divisible by 60", () => {
    expect(isValidTick(-276001)).toBe(false)
    expect(isValidTick(59)).toBe(false)
    expect(isValidTick(121)).toBe(false)
  })

  test("rejects ticks outside bounds", () => {
    expect(isValidTick(-900000)).toBe(false) // Below MIN_TICK
    expect(isValidTick(900000)).toBe(false) // Above MAX_TICK
  })
})

describe("Preset Range Calculations", () => {
  test("conservative preset generates valid range", () => {
    const currentMcap = 10_000_000 // $10M
    const range = getPresetRange(
      currentMcap,
      0.8, // 80% - 300%
      3.0,
      ETH_PRICE_USD,
      ZEUS_TOTAL_SUPPLY
    )

    expect(range.minTick).toBeLessThan(range.maxTick)
    expect(range.minMcap).toBeCloseTo(currentMcap * 0.8)
    expect(range.maxMcap).toBeCloseTo(currentMcap * 3.0)
    expect(isValidTick(range.minTick)).toBe(true)
    expect(isValidTick(range.maxTick)).toBe(true)
  })

  test("aggressive preset generates wider range", () => {
    const currentMcap = 10_000_000
    const conservative = getPresetRange(
      currentMcap,
      0.8,
      3.0,
      ETH_PRICE_USD,
      ZEUS_TOTAL_SUPPLY
    )
    const aggressive = getPresetRange(
      currentMcap,
      0.2,
      50.0,
      ETH_PRICE_USD,
      ZEUS_TOTAL_SUPPLY
    )

    // Aggressive range should be wider
    expect(aggressive.minTick).toBeLessThan(conservative.minTick)
    expect(aggressive.maxTick).toBeGreaterThan(conservative.maxTick)
  })
})

describe("Decimal Precision (9 vs 18)", () => {
  test("correctly handles ZEUS 9-decimal supply", () => {
    const supply9Decimals = BigInt(1_000_000_000 * 10 ** 9) // 1B tokens, 9 decimals
    const mcap = 5_000_000 // $5M

    const tick = mcapToTick(mcap, ETH_PRICE_USD, supply9Decimals)

    expect(isValidTick(tick)).toBe(true)
  })

  test("price calculations account for decimal difference", () => {
    // With 9 decimals, the tick values should differ from 18-decimal tokens
    // This test validates that DECIMAL_ADJUSTMENT is applied correctly

    const mcap = 10_000_000
    const tick = mcapToTick(mcap, ETH_PRICE_USD, ZEUS_TOTAL_SUPPLY)

    // Verify tick is reasonable for a 9-decimal token
    // For reference, 18-decimal tokens would have very different tick ranges
    expect(tick).toBeLessThan(0) // ZEUS price is small, so tick should be negative
    expect(tick).toBeGreaterThan(-500000) // But not extremely negative
  })
})
