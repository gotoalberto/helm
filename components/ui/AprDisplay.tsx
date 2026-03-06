"use client"

import { useApr } from "@/hooks/useApr"

interface AprDisplayProps {
  variant?: "pill" | "card"
}

function formatK(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`
  return `$${val.toFixed(0)}`
}

export function AprDisplay({ variant = "pill" }: AprDisplayProps) {
  const { apr, volume24hUsd, isLoading } = useApr()

  if (variant === "pill") {
    if (isLoading) {
      return (
        <div style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border-bright)", borderRadius: "9999px", padding: "0.4rem 1rem", display: "flex", gap: "0.4rem", alignItems: "center", backdropFilter: "blur(8px)" }}>
          <div style={{ width: 36, height: 16, background: "rgba(255,255,255,0.08)", borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite" }} />
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Est. APR</span>
        </div>
      )
    }
    return (
      <div style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border-bright)", borderRadius: "9999px", padding: "0.4rem 1rem", display: "flex", gap: "0.4rem", alignItems: "center", backdropFilter: "blur(8px)" }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "1rem", color: "#f0e64e" }}>
          {apr !== null ? `${apr.toFixed(0)}%` : "—"}
        </span>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Est. APR</span>
      </div>
    )
  }

  // card variant
  if (isLoading) {
    return (
      <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <div style={{ width: 80, height: 28, background: "rgba(255,255,255,0.08)", borderRadius: 6, animation: "pulse 1.5s ease-in-out infinite" }} />
        <div style={{ width: 100, height: 14, background: "rgba(255,255,255,0.05)", borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite" }} />
      </div>
    )
  }

  return (
    <div style={{ marginTop: "0.75rem" }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", color: "#f0e64e", lineHeight: 1 }}>
        {apr !== null ? `${apr.toFixed(0)}%` : "—"}
      </div>
      {volume24hUsd !== null && (
        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.25rem", fontWeight: 600, letterSpacing: "0.06em" }}>
          ~{formatK(volume24hUsd)} / 24h vol
        </div>
      )}
    </div>
  )
}
