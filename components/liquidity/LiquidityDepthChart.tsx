"use client"

import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { createChart, ColorType, CandlestickSeries, type IChartApi, type ISeriesApi } from "lightweight-charts"
import { useZeusOHLC, useZeusPrice } from "@/hooks/useZeusPrice"
import { useEthPrice } from "@/hooks/useZeusPrice"
import { tickToMcap, tickToZeusEthPrice, mcapToTick } from "@/lib/uniswap/mcap"
import { ZEUS_DECIMALS, ETH_DECIMALS } from "@/lib/constants"

interface V4Position {
  tickLower: number
  tickUpper: number
  liquidity: string
}

interface DrawnBand {
  top: number
  bottom: number
  mcapLow: number
  mcapHigh: number
  totalLiquidity: bigint
  tvlUsd: number
  inRange: boolean
}

interface TooltipInfo {
  x: number
  y: number
  band: DrawnBand
}

function formatMcap(value: number): string {
  if (!isFinite(value) || value <= 0) return "—"
  if (value >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(2)}T`
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
  return `$${value.toFixed(0)}`
}

function fmtTvl(usd: number): string {
  if (!isFinite(usd) || usd <= 0) return "—"
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(2)}B`
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(2)}K`
  return `$${usd.toFixed(0)}`
}

// In Uniswap V4, tick directly encodes price = 1.0001^tick = zeusRaw/ethRaw
// sqrtPrice = sqrt(1.0001^tick), amounts in raw units
function calcTvlUsd(liquidity: bigint, tickLower: number, tickUpper: number, currentTick: number, ethPriceUsd: number, zeusPriceUsd: number): number {
  try {
    const sqrtPriceLow  = Math.sqrt(1.0001 ** tickLower)
    const sqrtPriceHigh = Math.sqrt(1.0001 ** tickUpper)
    const sqrtPriceCur  = Math.sqrt(1.0001 ** currentTick)
    const sqrtP = Math.max(sqrtPriceLow, Math.min(sqrtPriceCur, sqrtPriceHigh))
    const L = Number(liquidity)
    // ethRaw = amount0 = L * (1/sqrtP - 1/sqrtPriceHigh)
    // zeusRaw = amount1 = L * (sqrtP - sqrtPriceLow)
    const ethRaw  = L * (1 / sqrtP - 1 / sqrtPriceHigh)
    const zeusRaw = L * (sqrtP - sqrtPriceLow)
    const ethHuman  = ethRaw  / 10 ** ETH_DECIMALS
    const zeusHuman = zeusRaw / 10 ** ZEUS_DECIMALS
    const tvl = ethHuman * ethPriceUsd + zeusHuman * zeusPriceUsd
    return isFinite(tvl) && tvl > 0 ? tvl : 0
  } catch {
    return 0
  }
}

const TIMEFRAMES = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
] as const

interface LiquidityDepthChartProps {
  onJoinRange?: (mcapLow: number, mcapHigh: number) => void
}

export function LiquidityDepthChart({ onJoinRange }: LiquidityDepthChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const drawnBandsRef = useRef<DrawnBand[]>([])
  const [days, setDays] = useState(7)
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)

  const { data: ohlcData, isLoading: chartLoading } = useZeusOHLC(days)
  const { data: priceData } = useZeusPrice()
  const { data: ethPriceUsd } = useEthPrice()

  const circulatingSupply = priceData?.circulatingSupply ?? 0
  const totalSupplyRaw = priceData?.totalSupply ?? 0n

  const { data: positionsData, isLoading: posLoading } = useQuery<{ positions: V4Position[] }>({
    queryKey: ["all-positions"],
    queryFn: async () => {
      const res = await fetch("/api/positions/all")
      if (!res.ok) throw new Error("Failed to fetch positions")
      return res.json()
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })

  // Build chart
  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255,255,255,0.5)",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      width: chartContainerRef.current.clientWidth,
      height: 420,
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
        visible: true,
        scaleMargins: { top: 0.1, bottom: 0.1 },
        minimumWidth: 90,
      },
      localization: {
        priceFormatter: (price: number) => formatMcap(price),
      },
      crosshair: {
        vertLine: { color: "rgba(67,148,244,0.5)", width: 1, style: 3 },
        horzLine: { color: "rgba(67,148,244,0.5)", width: 1, style: 3 },
      },
    })

    chartRef.current = chart

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    })
    candlestickSeriesRef.current = series

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth })
        drawOverlay()
      }
    }
    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
      chart.remove()
    }
  }, [])

  // Load candle data
  useEffect(() => {
    if (!ohlcData || !candlestickSeriesRef.current) return
    const supply = circulatingSupply || 1
    const chartData = ohlcData.map((candle: any) => ({
      time: Math.floor(candle.timestamp / 1000) as any,
      open: candle.open * supply,
      high: candle.high * supply,
      low: candle.low * supply,
      close: candle.close * supply,
    }))
    candlestickSeriesRef.current.setData(chartData)
    if (chartRef.current) chartRef.current.timeScale().fitContent()
  }, [ohlcData, circulatingSupply])

  function drawOverlay() {
    if (!overlayRef.current || !chartRef.current || !positionsData?.positions || !ethPriceUsd || !totalSupplyRaw) return
    const canvas = overlayRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const rect = chartContainerRef.current!.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const series = candlestickSeriesRef.current
    if (!series) return

    const currentMcap = priceData?.marketCapUsd ?? 0
    const zeusPriceUsd = priceData ? priceData.marketCapUsd / (Number(totalSupplyRaw) / 10 ** ZEUS_DECIMALS) : 0
    const currentTick = currentMcap > 0 ? mcapToTick(currentMcap, ethPriceUsd, totalSupplyRaw) : 0

    // Build one DrawnBand per position (no merging)
    const bands: DrawnBand[] = []

    for (const pos of positionsData.positions) {
      if (pos.tickLower >= pos.tickUpper) continue
      try {
        const mcapA = tickToMcap(pos.tickLower, ethPriceUsd, totalSupplyRaw)
        const mcapB = tickToMcap(pos.tickUpper, ethPriceUsd, totalSupplyRaw)
        const mcapLow  = Math.min(mcapA, mcapB)
        const mcapHigh = Math.max(mcapA, mcapB)

        if (!isFinite(mcapLow) || !isFinite(mcapHigh) || mcapHigh > 1e13) continue

        const yHigh = series.priceToCoordinate(mcapHigh)
        const yLow  = series.priceToCoordinate(mcapLow)
        if (yHigh === null || yLow === null) continue

        const top    = Math.min(yHigh, yLow)
        const bottom = Math.max(yHigh, yLow)
        if (bottom - top < 2) continue

        const liq    = BigInt(pos.liquidity)
        const tvlUsd = calcTvlUsd(liq, pos.tickLower, pos.tickUpper, currentTick, ethPriceUsd, zeusPriceUsd)
        const inRange = currentMcap >= mcapLow && currentMcap <= mcapHigh

        bands.push({ top, bottom, mcapLow, mcapHigh, totalLiquidity: liq, tvlUsd, inRange })
      } catch { /* ignore bad ticks */ }
    }

    // Paint largest bands first (bottom z-layer) so smaller ones appear on top
    const paintOrder = [...bands].sort((a, b) => (b.bottom - b.top) - (a.bottom - a.top))
    for (const band of paintOrder) {
      const height = band.bottom - band.top
      const alpha  = 0.18
      const color  = band.inRange ? `rgba(240,230,78,${alpha})` : `rgba(67,148,244,${alpha})`
      const border = band.inRange ? "rgba(240,230,78,0.45)"      : "rgba(67,148,244,0.35)"

      ctx.fillStyle = color
      ctx.fillRect(0, band.top, canvas.width - 90, height)

      ctx.strokeStyle = border
      ctx.lineWidth = 1
      ctx.setLineDash([4, 3])
      ctx.beginPath(); ctx.moveTo(0, band.top);    ctx.lineTo(canvas.width - 90, band.top);    ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, band.bottom); ctx.lineTo(canvas.width - 90, band.bottom); ctx.stroke()
      ctx.setLineDash([])
    }

    // Hit-test order: smallest bands first so they are selectable when nested inside larger ones
    drawnBandsRef.current = [...bands].sort((a, b) => (a.bottom - a.top) - (b.bottom - b.top))
  }

  // Redraw overlay when positions or price data changes
  useEffect(() => {
    drawOverlay()
  }, [positionsData, ethPriceUsd, totalSupplyRaw, ohlcData, priceData])

  // Also redraw overlay after chart renders new data (subscribe to visible range changes)
  useEffect(() => {
    if (!chartRef.current) return
    const sub = chartRef.current.timeScale().subscribeVisibleTimeRangeChange(() => drawOverlay())
    return () => chartRef.current?.timeScale().unsubscribeVisibleTimeRangeChange(sub as any)
  }, [positionsData, ethPriceUsd, totalSupplyRaw, priceData])

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseY = e.clientY - rect.top
    const mouseX = e.clientX - rect.left
    const band = drawnBandsRef.current.find(b => mouseY >= b.top && mouseY <= b.bottom)
    setTooltip(band ? { x: mouseX, y: mouseY, band } : null)
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseY = e.clientY - rect.top
    const band = drawnBandsRef.current.find(b => mouseY >= b.top && mouseY <= b.bottom)
    if (band && onJoinRange) {
      onJoinRange(band.mcapLow, band.mcapHigh)
    }
  }

  function handlePointerLeave() {
    setTooltip(null)
  }

  const isLoading = chartLoading || posLoading
  const posCount = positionsData?.positions?.length ?? 0

  // Tooltip positioning — stays within container bounds
  const TOOLTIP_W = 200
  const TOOLTIP_H = onJoinRange ? 88 : 72
  let tooltipLeft = 0
  let tooltipTop = 0
  if (tooltip) {
    tooltipLeft = Math.min(Math.max(tooltip.x - TOOLTIP_W / 2, 8), (chartContainerRef.current?.clientWidth ?? 400) - TOOLTIP_W - 8)
    tooltipTop = tooltip.y - TOOLTIP_H - 14
    if (tooltipTop < 8) tooltipTop = tooltip.y + 14
  }

  return (
    <div style={{ width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Market Cap (USD)
          </span>
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.label}
              onClick={() => setDays(tf.days)}
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "0.78rem",
                padding: "0.3rem 0.85rem",
                borderRadius: "9999px",
                border: days === tf.days ? "1px solid rgba(240,230,78,0.5)" : "1px solid rgba(255,255,255,0.12)",
                cursor: "pointer",
                background: days === tf.days ? "rgba(240,230,78,0.15)" : "rgba(255,255,255,0.04)",
                color: days === tf.days ? "#f0e64e" : "rgba(255,255,255,0.5)",
                transition: "all 0.15s",
              }}
            >
              {tf.label}
            </button>
          ))}
        </div>
        {posCount > 0 && (
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(240,230,78,0.5)", border: "1px solid rgba(240,230,78,0.7)" }} />
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>Active range</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(67,148,244,0.4)", border: "1px solid rgba(67,148,244,0.6)" }} />
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>Defense walls</span>
            </div>
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>
              {posCount} defender{posCount !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Chart container */}
      <div style={{ position: "relative", width: "100%", height: 420, borderRadius: "0.75rem", overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
        {isLoading && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(10,15,30,0.8)", backdropFilter: "blur(8px)", zIndex: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "rgba(255,255,255,0.5)", fontSize: "0.875rem", fontWeight: 600 }}>
              <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "var(--yellow)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              Loading...
            </div>
          </div>
        )}
        <div ref={chartContainerRef} style={{ width: "100%", height: "100%" }} />
        <canvas
          ref={overlayRef}
          style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 1, width: "100%", height: "100%" }}
        />
        {/* Invisible pointer-capture div (preserves chart crosshair) */}
        <div
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onPointerDown={handlePointerMove}
          onClick={handleClick}
          style={{
            position: "absolute",
            inset: 0,
            cursor: tooltip && onJoinRange ? "pointer" : tooltip ? "crosshair" : "default",
            zIndex: 2,
          }}
        />
        {/* Tooltip */}
        {tooltip && (
          <div
            style={{
              position: "absolute",
              left: tooltipLeft,
              top: tooltipTop,
              zIndex: 10,
              pointerEvents: "none",
              background: "rgba(10,15,30,0.92)",
              border: `1px solid ${tooltip.band.inRange ? "rgba(240,230,78,0.4)" : "rgba(67,148,244,0.4)"}`,
              borderTop: `2px solid ${tooltip.band.inRange ? "#f0e64e" : "#4394f4"}`,
              borderRadius: "0.625rem",
              padding: "0.625rem 0.875rem",
              backdropFilter: "blur(12px)",
              minWidth: TOOLTIP_W,
              userSelect: "none",
            }}
          >
            <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: "0.4rem" }}>
              1 position
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.3rem" }}>
              <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>TVL</span>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "1rem", color: "#fff" }}>{fmtTvl(tooltip.band.tvlUsd)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>Range</span>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: tooltip.band.inRange ? "#f0e64e" : "#4394f4", fontFamily: "monospace" }}>
                {formatMcap(tooltip.band.mcapLow)} → {formatMcap(tooltip.band.mcapHigh)}
              </span>
            </div>
            {onJoinRange && (
              <div style={{
                marginTop: "0.5rem",
                fontSize: "0.65rem",
                fontWeight: 600,
                letterSpacing: "0.06em",
                color: tooltip.band.inRange ? "rgba(240,230,78,0.45)" : "rgba(67,148,244,0.45)",
                textAlign: "center",
              }}>
                Click to join this range
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
