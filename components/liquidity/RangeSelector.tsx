"use client"

import { useState, useEffect } from "react"
import { PriceRange } from "@/types"
import { mcapToTick, tickToZeusEthPrice, getPresetRange } from "@/lib/uniswap/mcap"
import { MCAP_RANGE_PRESETS } from "@/lib/constants"
import { useZeusPrice, useEthPrice } from "@/hooks/useZeusPrice"

interface RangeSelectorProps {
  onRangeChange: (range: PriceRange) => void
  initialMinMcap?: number
  initialMaxMcap?: number
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
  return `$${value.toFixed(2)}`
}

export function RangeSelector({ onRangeChange, initialMinMcap, initialMaxMcap }: RangeSelectorProps) {
  const { data: priceData } = useZeusPrice()
  const { data: ethPriceUsd } = useEthPrice()

  const [minMcap, setMinMcap] = useState<string>(initialMinMcap ? initialMinMcap.toFixed(0) : "")
  const [maxMcap, setMaxMcap] = useState<string>(initialMaxMcap ? initialMaxMcap.toFixed(0) : "")
const [minFocused, setMinFocused] = useState(false)
  const [maxFocused, setMaxFocused] = useState(false)

  // Apply externally injected initial values when they change
  useEffect(() => {
    if (initialMinMcap) setMinMcap(initialMinMcap.toFixed(0))
    if (initialMaxMcap) setMaxMcap(initialMaxMcap.toFixed(0))
  }, [initialMinMcap, initialMaxMcap])

  useEffect(() => {
    if (!priceData || !ethPriceUsd || !minMcap || !maxMcap) return

    try {
      const minMcapNum = parseFloat(minMcap)
      const maxMcapNum = parseFloat(maxMcap)

      if (minMcapNum <= 0 || maxMcapNum <= 0 || minMcapNum >= maxMcapNum) return

      const minTick = mcapToTick(minMcapNum, ethPriceUsd, priceData.totalSupply)
      const maxTick = mcapToTick(maxMcapNum, ethPriceUsd, priceData.totalSupply)

      const minPriceEth = tickToZeusEthPrice(minTick)
      const maxPriceEth = tickToZeusEthPrice(maxTick)

      const range: PriceRange = {
        minMcap: minMcapNum,
        maxMcap: maxMcapNum,
        minTick,
        maxTick,
        minPriceEth,
        maxPriceEth,
        minPriceUsd: minMcapNum / (Number(priceData.totalSupply) / 1e9 || 1),
        maxPriceUsd: maxMcapNum / (Number(priceData.totalSupply) / 1e9 || 1),
      }

      onRangeChange(range)
    } catch (error) {
      console.error("Failed to calculate range:", error)
    }
  }, [minMcap, maxMcap, priceData, ethPriceUsd, onRangeChange])

  const applyPreset = (preset: keyof typeof MCAP_RANGE_PRESETS) => {
    if (!priceData || !ethPriceUsd) return

    const { minMultiplier, maxMultiplier } = MCAP_RANGE_PRESETS[preset]
    const currentMcap = priceData.marketCapUsd

    const range = getPresetRange(currentMcap, minMultiplier, maxMultiplier, ethPriceUsd, priceData.totalSupply)
    setMinMcap(range.minMcap.toString())
    setMaxMcap(range.maxMcap.toString())
  }

  if (!priceData || !ethPriceUsd) {
    return (
      <div style={{ padding: "1.25rem", borderRadius: "1rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <p style={{ fontWeight: 600, color: "var(--text-muted)" }}>Loading market data...</p>
      </div>
    )
  }

  const currentMcap = priceData.marketCapUsd
  const minMcapNum = parseFloat(minMcap) || 0
  const maxMcapNum = parseFloat(maxMcap) || 0
  const isOutOfRange = minMcapNum > 0 && maxMcapNum > 0 && (currentMcap < minMcapNum || currentMcap > maxMcapNum)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Current Market Cap */}
      <div style={{ background: "rgba(240,230,78,0.08)", border: "1px solid rgba(240,230,78,0.2)", borderRadius: "0.875rem", padding: "1rem 1.25rem" }}>
        <p style={{ fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700, color: "rgba(240,230,78,0.5)", marginBottom: "0.3rem" }}>Current Market Cap</p>
        <p style={{ fontFamily: "var(--font-display)", fontSize: "1.7rem", color: "var(--yellow)" }}>
          {formatCurrency(currentMcap)}
        </p>
      </div>

      {/* Preset Buttons */}
      <div>
        <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.75rem" }}>Presets</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.5rem" }}>
          {[
            { key: "conservative" as const, label: "Conservative", range: "80% – 300%" },
            { key: "moderate" as const, label: "Moderate", range: "50% – 1000%" },
            { key: "aggressive" as const, label: "Aggressive", range: "20% – 5000%" },
          ].map(({ key, label, range }) => (
            <button
              key={key}
              onClick={() => applyPreset(key)}
              style={{
                padding: "0.65rem 0.75rem",
                borderRadius: "0.75rem",
                fontSize: "0.82rem",
                fontWeight: 700,
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.15s",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "var(--text-secondary)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(67,148,244,0.1)"
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(67,148,244,0.3)"
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)"
              }}
            >
              {label}
              <span style={{ display: "block", fontSize: "0.68rem", fontFamily: "monospace", color: "var(--text-muted)", marginTop: "0.2rem" }}>{range}</span>
            </button>
          ))}
        </div>
      </div>

      {/* MCAP Inputs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <label style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)" }}>Min Market Cap (USD)</label>
          <input
            type="text"
            value={minFocused ? minMcap : (minMcapNum >= 1000 ? formatCurrency(minMcapNum) : minMcap)}
            onFocus={() => setMinFocused(true)}
            onChange={(e) => { const v = e.target.value; if (v === "" || /^[\d.]+$/.test(v)) setMinMcap(v) }}
            onBlur={() => setMinFocused(false)}
            placeholder="1000000"
            className="input-zeus"
          />
          {minMcapNum > 0 && (
            <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", fontFamily: "monospace" }}>
              {formatCurrency(minMcapNum)}
            </p>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <label style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)" }}>Max Market Cap (USD)</label>
          <input
            type="text"
            value={maxFocused ? maxMcap : (maxMcapNum >= 1000 ? formatCurrency(maxMcapNum) : maxMcap)}
            onFocus={() => setMaxFocused(true)}
            onChange={(e) => { const v = e.target.value; if (v === "" || /^[\d.]+$/.test(v)) setMaxMcap(v) }}
            onBlur={() => setMaxFocused(false)}
            placeholder="10000000"
            className="input-zeus"
          />
          {maxMcapNum > 0 && (
            <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", fontFamily: "monospace" }}>
              {formatCurrency(maxMcapNum)}
            </p>
          )}
        </div>
      </div>

      {/* Validation Warning */}
      {minMcapNum > 0 && maxMcapNum > 0 && minMcapNum >= maxMcapNum && (
        <div style={{ borderRadius: "0.75rem", padding: "0.75rem 1rem", fontSize: "0.85rem", fontWeight: 700, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
          Min market cap must be less than max market cap
        </div>
      )}


    </div>
  )
}
