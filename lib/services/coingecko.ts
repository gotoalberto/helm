/**
 * CoinGecko API Client
 *
 * Provides price, market cap, and OHLC data for ZEUS token
 */

import { COINGECKO_API_KEY, ZEUS_TOKEN_ADDRESS, ZEUS_DECIMALS } from "@/lib/constants"
import { PriceData, OHLCData } from "@/types"

// CoinGecko Pro API requires different base URL
// Pro API keys must use pro-api.coingecko.com
const COINGECKO_BASE_URL = COINGECKO_API_KEY?.startsWith("CG-")
  ? "https://pro-api.coingecko.com/api/v3"
  : "https://api.coingecko.com/api/v3"

const headers: Record<string, string> = {
  "Accept": "application/json",
}

// Add API key header if available
if (COINGECKO_API_KEY) {
  // Pro API keys start with "CG-" and use x-cg-pro-api-key header
  headers["x-cg-pro-api-key"] = COINGECKO_API_KEY
}

// ============================================================================
// Resolve ZEUS CoinGecko ID
// ============================================================================

let cachedZeusId: string | null = null

export async function getZeusCoinGeckoId(): Promise<string> {
  if (cachedZeusId) return cachedZeusId

  const url = `${COINGECKO_BASE_URL}/coins/ethereum/contract/${ZEUS_TOKEN_ADDRESS.toLowerCase()}`

  try {
    const response = await fetch(url, { headers })
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    cachedZeusId = data.id
    return data.id
  } catch (error) {
    console.error("Failed to resolve ZEUS CoinGecko ID:", error)
    throw error
  }
}

// ============================================================================
// Get Current Price & Market Data
// ============================================================================

export async function getZeusPriceData(): Promise<PriceData> {
  const coinId = await getZeusCoinGeckoId()
  const url = `${COINGECKO_BASE_URL}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`

  try {
    const response = await fetch(url, {
      headers,
      next: { revalidate: 60 } // Cache for 60 seconds
    })

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const marketData = data.market_data

    // Get ETH price for ZEUS/ETH ratio
    const ethPriceUsd = marketData.current_price?.eth
      ? 1 / marketData.current_price.eth
      : 0

    // Total supply in raw units (9 decimals)
    const totalSupplyRaw = marketData.total_supply
      ? BigInt(Math.floor(marketData.total_supply * 10 ** ZEUS_DECIMALS))
      : BigInt(0)

    return {
      priceUsd: marketData.current_price?.usd || 0,
      priceEth: marketData.current_price?.eth || 0,
      marketCapUsd: marketData.market_cap?.usd || 0,
      fullyDilutedValuation: marketData.fully_diluted_valuation?.usd || 0,
      totalSupply: totalSupplyRaw,
      circulatingSupply: marketData.circulating_supply || 0,
      volume24h: marketData.total_volume?.usd || 0,
      priceChange24h: marketData.price_change_percentage_24h || 0,
      priceChange7d: marketData.price_change_percentage_7d || 0,
      lastUpdated: Date.now(),
    }
  } catch (error) {
    console.error("Failed to fetch ZEUS price data:", error)
    throw error
  }
}

// ============================================================================
// Get OHLC Chart Data
// ============================================================================

export async function getZeusOHLC(days: number = 7): Promise<OHLCData[]> {
  const coinId = await getZeusCoinGeckoId()
  const url = `${COINGECKO_BASE_URL}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`

  try {
    const response = await fetch(url, {
      headers,
      next: { revalidate: 300 } // Cache for 5 minutes
    })

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // CoinGecko OHLC format: [timestamp, open, high, low, close]
    return data.map((candle: number[]) => ({
      timestamp: candle[0],
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
    }))
  } catch (error) {
    console.error("Failed to fetch ZEUS OHLC data:", error)
    throw error
  }
}

// ============================================================================
// Get ETH Price (for conversions)
// ============================================================================

export async function getEthPriceUsd(): Promise<number> {
  const url = `${COINGECKO_BASE_URL}/simple/price?ids=ethereum&vs_currencies=usd`

  try {
    const response = await fetch(url, {
      headers,
      next: { revalidate: 60 }
    })

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.ethereum?.usd || 0
  } catch (error) {
    console.error("Failed to fetch ETH price:", error)
    throw error
  }
}
