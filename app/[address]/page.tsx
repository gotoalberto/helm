"use client"

import { notFound } from "next/navigation"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { isAddress } from "viem"
import { useState } from "react"
import { PublicPositionCard, FeeCollection } from "@/components/positions/PublicPositionCard"
import { deserializePosition } from "@/lib/uniswap/positions"
import { useZeusPrice, useEthPrice } from "@/hooks/useZeusPrice"
import { Position } from "@/types"

function fmtUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
  return `$${value.toFixed(2)}`
}

function fmtZeus(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`
  return value.toFixed(4)
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
      style={{
        background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: "0.5rem", color: copied ? "#4ade80" : "var(--text-muted)",
        fontSize: "0.72rem", fontWeight: 700, padding: "0.25rem 0.65rem", cursor: "pointer",
        letterSpacing: "0.04em", transition: "color 0.15s",
      }}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  )
}

export default function ProfilePage() {
  const params = useParams()
  const address = typeof params.address === "string" ? params.address : ""
  const valid = isAddress(address)

  if (!valid) {
    notFound()
  }

  return <ProfileClient address={address} />
}

function ProfileClient({ address }: { address: string }) {
  const { data: zeusPriceData } = useZeusPrice()
  const { data: ethPriceUsd = 0 } = useEthPrice()
  const zeusPriceUsd = zeusPriceData?.priceUsd ?? 0

  const { data: positionsData, isLoading: posLoading } = useQuery({
    queryKey: ["profile-positions", address],
    queryFn: async () => {
      const res = await fetch(`/api/positions/${address}`, { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to fetch positions")
      const json = await res.json()
      const positions: Position[] = (json.positions ?? []).map(
        (raw: Record<string, unknown>) => deserializePosition(raw)
      )
      return { positions, cachedAt: json.cachedAt as string }
    },
    staleTime: 0,
  })

  const { data: feesData } = useQuery({
    queryKey: ["profile-fees", address],
    queryFn: async () => {
      const res = await fetch(`/api/fees/collect?address=${address}`)
      if (!res.ok) throw new Error("Failed to fetch fee history")
      const json = await res.json()
      return json.collections as FeeCollection[]
    },
    staleTime: 60_000,
  })

  const { data: feeHistoryData } = useQuery({
    queryKey: ["profile-fee-history", address],
    queryFn: async () => {
      const res = await fetch(`/api/fees/history/${address}`)
      if (!res.ok) return { accumulatedUsd: 0, pendingUsd: 0, totalUsd: 0 }
      return res.json() as Promise<{ accumulatedUsd: number; pendingUsd: number; totalUsd: number }>
    },
    staleTime: 5 * 60_000,
  })

  const positions = positionsData?.positions ?? []
  const feeHistory = feesData ?? []

  const totalValueUsd = positions.reduce((s, p) => s + p.totalValueUsd, 0)
  const totalUncollectedUsd = positions.reduce((s, p) => s + p.uncollectedFeesUsd, 0)
  const totalFeesEarnedUsd = feeHistoryData?.totalUsd ?? feeHistory.reduce((s, f) => s + f.totalUsd, 0)

  // Get current tick from first position or 0
  const currentTick = 0 // not needed for display, only for in/out range (already computed server-side)

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>

      {/* Header */}
      <header className="header-zeus" style={{ position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1440, margin: "0 auto", padding: "0 1.5rem", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: "0.55rem", textDecoration: "none" }}>
            <span style={{ fontFamily: "var(--font-body)", fontSize: "1rem", fontWeight: 700, color: "#fff" }}>earn.pepes.dog</span>
          </a>
          <a href="/" style={{
            fontSize: "0.82rem", fontWeight: 700, color: "var(--text-muted)",
            textDecoration: "none", padding: "0.4rem 0.875rem",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "0.625rem",
          }}>
            Back to Home
          </a>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "2.5rem 1.5rem 4rem" }}>

        {/* Address chip */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "2rem", flexWrap: "wrap" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "0.75rem",
            background: "var(--glass-bg)", border: "1px solid var(--glass-border-bright)",
            borderRadius: "9999px", padding: "0.4rem 1.1rem",
            backdropFilter: "blur(12px)",
          }}>
            <span style={{ fontFamily: "monospace", fontSize: "0.9rem", color: "#fff", letterSpacing: "0.04em" }}>
              {shortAddr(address)}
            </span>
            <CopyButton value={address} />
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
            {address}
          </span>
        </div>

        {/* Portfolio summary */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem",
          marginBottom: "2.5rem",
        }}>
          {[
            { label: "Total Value", value: fmtUsd(totalValueUsd), accent: "#4394f4" },
            { label: "Fees Earned", value: fmtUsd(totalFeesEarnedUsd), accent: "#4ade80" },
            { label: "Positions", value: positions.length.toString(), accent: "var(--text-secondary)" },
          ].map(({ label, value, accent }) => (
            <div key={label} style={{
              background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
              borderRadius: "1rem", padding: "1.25rem 1.5rem",
              backdropFilter: "blur(12px)",
            }}>
              <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                {label}
              </p>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", color: accent, lineHeight: 1.1 }}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Positions */}
        <div style={{ marginBottom: "2.5rem" }}>
          <h2 style={{
            fontFamily: "var(--font-display)", fontSize: "1.25rem", color: "#fff",
            marginBottom: "1.25rem",
          }}>
            LP Positions
          </h2>

          {posLoading ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)", fontSize: "0.875rem" }}>
              Loading positions...
            </div>
          ) : positions.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "3rem",
              background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
              borderRadius: "1.25rem", color: "var(--text-muted)", fontSize: "0.875rem",
            }}>
              No positions found for this address.
            </div>
          ) : (
            <div style={{ display: "grid", gap: "1.25rem", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>
              {positions.map((position) => (
                <PublicPositionCard
                  key={position.tokenId.toString()}
                  position={position}
                  ethPriceUsd={ethPriceUsd}
                  zeusPriceUsd={zeusPriceUsd}
                  currentTick={currentTick}
                  feeHistory={feeHistory}
                />
              ))}
            </div>
          )}
        </div>

        {/* Fee History */}
        {feeHistory.length > 0 && (
          <div>
            <h2 style={{
              fontFamily: "var(--font-display)", fontSize: "1.25rem", color: "#fff",
              marginBottom: "1.25rem",
            }}>
              Fee Collection History
            </h2>
            <div style={{
              background: "var(--glass-bg)", border: "1px solid var(--glass-border-bright)",
              borderRadius: "1.25rem", backdropFilter: "blur(12px)", overflow: "hidden",
            }}>
              {/* Summary */}
              <div style={{
                padding: "1rem 1.5rem",
                borderBottom: "1px solid var(--glass-border)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  {feeHistory.length} collection{feeHistory.length !== 1 ? "s" : ""}
                </span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", color: "#4ade80" }}>
                  {fmtUsd(totalFeesEarnedUsd)} total
                </span>
              </div>

              {/* Table */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
                      {["Date", "Position", "ETH", "ZEUS", "USD Value"].map((h) => (
                        <th key={h} style={{
                          padding: "0.75rem 1.25rem", textAlign: "left",
                          fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em",
                          textTransform: "uppercase", color: "var(--text-muted)",
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {feeHistory.map((f) => (
                      <tr key={f.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "0.75rem 1.25rem", color: "var(--text-muted)" }}>
                          {new Date(f.collectedAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: "0.75rem 1.25rem", fontFamily: "monospace", color: "var(--text-secondary)", fontSize: "0.75rem" }}>
                          #{f.tokenId}
                        </td>
                        <td style={{ padding: "0.75rem 1.25rem", color: "#a8c8ff" }}>
                          {f.amount0Eth.toFixed(6)}
                        </td>
                        <td style={{ padding: "0.75rem 1.25rem", color: "var(--highlight)" }}>
                          {fmtZeus(f.amount1Zeus)}
                        </td>
                        <td style={{ padding: "0.75rem 1.25rem", color: "#4ade80", fontWeight: 700 }}>
                          {fmtUsd(f.totalUsd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
