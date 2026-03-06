"use client"

import { usePositions } from "@/hooks/usePositions"
import { useZeusPrice, useEthPrice } from "@/hooks/useZeusPrice"
import { PositionCard } from "./PositionCard"
import { useAccount } from "wagmi"
import { mcapToTick } from "@/lib/uniswap/mcap"
import { useState } from "react"

const SkeletonCard = () => (
  <div style={{
    background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
    borderRadius: "1.25rem", padding: "1.5rem",
    display: "flex", flexDirection: "column", gap: "1.25rem",
  }}>
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <div className="skeleton" style={{ height: 20, width: 120, borderRadius: 6 }} />
      <div className="skeleton" style={{ height: 28, width: 80, borderRadius: 6 }} />
    </div>
    <div className="skeleton" style={{ height: 68, width: "100%", borderRadius: 12 }} />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
      <div className="skeleton" style={{ height: 72, borderRadius: 12 }} />
      <div className="skeleton" style={{ height: 72, borderRadius: 12 }} />
    </div>
    <div className="skeleton" style={{ height: 60, width: "100%", borderRadius: 12 }} />
  </div>
)

export function PositionsList() {
  const { address, isConnected } = useAccount()
  const { data: positions, isLoading } = usePositions()
  const [copied, setCopied] = useState(false)

  function handleShare() {
    const url = `https://earn.pepes.dog/${address}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  const { data: priceData } = useZeusPrice()
  const { data: ethPriceUsd } = useEthPrice()

  // Not connected or still loading with no data yet — hide section entirely
  if (!isConnected) return null

  if (isLoading) return (
    <section id="positions" style={{ padding: "5rem 1.5rem" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ marginBottom: "2.5rem" }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.4rem" }}>Uniswap V4</p>
          <h2 className="section-title">Your Positions</h2>
        </div>
        <div style={{ marginBottom: "2.5rem" }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.4rem" }}>Uniswap V4</p>
          <h2 className="section-title">Your Positions</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </section>
  )

  // No active positions — hide section entirely
  if (!positions || positions.length === 0) return null

  const eth = ethPriceUsd ?? 0
  const zeus = priceData?.priceUsd ?? 0
  const currentTick = priceData && eth
    ? (() => { try { return mcapToTick(priceData.marketCapUsd, eth, priceData.totalSupply) } catch { return 0 } })()
    : 0

  return (
    <section id="positions" style={{ padding: "5rem 1.5rem" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "2.5rem", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.4rem" }}>Uniswap V4</p>
            <h2 className="section-title">Your Positions</h2>
          </div>
          <button onClick={handleShare} style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            padding: "0.5rem 1.1rem", borderRadius: "0.75rem", cursor: "pointer",
            background: copied ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${copied ? "rgba(74,222,128,0.35)" : "rgba(255,255,255,0.15)"}`,
            color: copied ? "#4ade80" : "var(--text-secondary)",
            fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.04em",
            transition: "all 0.15s",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {copied
                ? <polyline points="20 6 9 17 4 12"/>
                : <><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></>
              }
            </svg>
            {copied ? "Link copied!" : "Share my positions"}
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {positions.map((position) => (
            <PositionCard
              key={position.tokenId.toString()}
              position={position}
              ethPriceUsd={eth}
              zeusPriceUsd={zeus}
              currentTick={currentTick}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
