"use client"

import { useZeusPrice } from "@/hooks/useZeusPrice"

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
  return `$${value.toFixed(2)}`
}

function formatPrice(value: number): string {
  if (value < 0.000001) return `$${value.toExponential(3)}`
  if (value < 0.0001) return `$${value.toFixed(9)}`
  if (value < 0.01) return `$${value.toFixed(6)}`
  return `$${value.toFixed(4)}`
}

function formatPercentage(value: number): string {
  const sign = value >= 0 ? "+" : ""
  return `${sign}${value.toFixed(2)}%`
}

interface StatCardProps {
  label: string
  value: string
  sub?: string
  isPositive?: boolean
  accent?: "yellow" | "blue" | "green" | "default"
}

function StatCard({ label, value, sub, isPositive, accent = "default" }: StatCardProps) {
  const accentColor = {
    yellow: "var(--yellow)",
    blue: "var(--blue-light)",
    green: "#4ade80",
    default: "rgba(255,255,255,0.6)",
  }

  return (
    <div className="stat-card" style={{ minHeight: 110 }}>
      <p style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: accentColor[accent], marginBottom: "0.6rem" }}>{label}</p>
      <p style={{ fontFamily: "var(--font-display)", fontSize: "1.65rem", color: "#fff", letterSpacing: "0.01em", lineHeight: 1, marginBottom: "0.4rem" }}>{value}</p>
      {sub && (
        <p style={{ fontSize: "0.78rem", fontWeight: 600, color: isPositive === undefined ? "var(--text-muted)" : isPositive ? "#4ade80" : "#f87171" }}>{sub}</p>
      )}
    </div>
  )
}

export function MarketStats() {
  const { data: priceData, isLoading, error } = useZeusPrice()

  if (error) {
    return (
      <div className="card-zeus" style={{ padding: "1.25rem" }}>
        <p style={{ fontSize: "0.875rem", color: "#f87171", fontWeight: 700 }}>Failed to load market data</p>
      </div>
    )
  }

  if (isLoading || !priceData) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
        {[1, 2].map((i) => (
          <div key={i} className="stat-card" style={{ minHeight: 110 }}>
            <div className="skeleton" style={{ height: 12, width: 80, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 28, width: 110, marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 12, width: 60 }} />
          </div>
        ))}
      </div>
    )
  }

  const isPositive = priceData.priceChange24h >= 0
  const priceChangeText = formatPercentage(priceData.priceChange24h) + " 24h"

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
      <StatCard
        accent="default"
        label="Market Cap"
        value={formatCurrency(priceData.marketCapUsd)}
        sub={`FDV: ${formatCurrency(priceData.fullyDilutedValuation)}`}
      />
      <StatCard
        accent="green"
        label="24h Volume"
        value={formatCurrency(priceData.volume24h)}
        sub={`Updated: ${new Date(priceData.lastUpdated).toLocaleTimeString()}`}
      />
    </div>
  )
}
