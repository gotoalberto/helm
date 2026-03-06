"use client"

import { useQuery } from "@tanstack/react-query"
import { useAccount } from "wagmi"

interface LeaderboardEntry {
  rank: number
  address: string
  uncollectedFeesUsd: number
  totalValueUsd: number
  positionCount: number
}

function fmtUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
  return `$${value.toFixed(2)}`
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

const MEDALS = ["🥇", "🥈", "🥉"]

const RANK_STYLES: Record<number, { color: string; bg: string; border: string }> = {
  1: { color: "#f0e64e", bg: "rgba(240,230,78,0.08)", border: "rgba(240,230,78,0.25)" },
  2: { color: "#a8c8ff", bg: "rgba(109,156,244,0.07)", border: "rgba(109,156,244,0.2)" },
  3: { color: "#fda47b", bg: "rgba(253,164,123,0.07)", border: "rgba(253,164,123,0.2)" },
}

export function FeeLeaderboard() {
  const { address } = useAccount()

  const { data, isLoading } = useQuery<{ leaderboard: LeaderboardEntry[]; stale?: boolean }>({
    queryKey: ["fee-leaderboard"],
    queryFn: async () => {
      const res = await fetch("/api/fees/leaderboard")
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
    staleTime: 60_000,
    // Poll every 8s while the server is still computing (stale=true, empty list)
    refetchInterval: (query) =>
      query.state.data?.stale && query.state.data.leaderboard.length === 0 ? 8_000 : 60_000,
  })

  const leaderboard = data?.leaderboard ?? []
  // Show skeleton while loading OR while server is still computing (stale + empty)
  const computing = isLoading || (data?.stale && leaderboard.length === 0)

  return (
    <section id="leaderboard" style={{ padding: "5rem 1.5rem" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.4rem" }}>
            Live rankings
          </p>
          <h2 className="section-title">Top Defenders</h2>
        </div>

        {computing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 56, borderRadius: "0.875rem" }} />
            ))}
          </div>
        ) : leaderboard.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "3rem 2rem",
            background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
            borderRadius: "1.25rem", backdropFilter: "blur(12px)",
          }}>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
              No fees collected yet. Be the first defender to collect!
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {leaderboard.map((entry) => {
              const isMe = address?.toLowerCase() === entry.address.toLowerCase()
              const rankStyle = RANK_STYLES[entry.rank]

              return (
                <a
                  key={entry.address}
                  href={`/${entry.address}`}
                  style={{ textDecoration: "none" }}
                >
                  <div style={{
                    display: "flex", alignItems: "center", gap: "1rem",
                    padding: "0.875rem 1.25rem",
                    background: isMe
                      ? "rgba(240,230,78,0.06)"
                      : rankStyle
                        ? rankStyle.bg
                        : "var(--glass-bg)",
                    border: `1px solid ${isMe
                      ? "rgba(240,230,78,0.3)"
                      : rankStyle
                        ? rankStyle.border
                        : "var(--glass-border)"}`,
                    borderRadius: "0.875rem",
                    backdropFilter: "blur(12px)",
                    transition: "border-color 0.15s, background 0.15s",
                    cursor: "pointer",
                  }}>

                    {/* Rank */}
                    <div style={{
                      width: 32, textAlign: "center", flexShrink: 0,
                      fontFamily: "var(--font-display)", fontSize: entry.rank <= 3 ? "1.25rem" : "1rem",
                      color: rankStyle ? rankStyle.color : "var(--text-muted)",
                    }}>
                      {entry.rank <= 3 ? MEDALS[entry.rank - 1] : `#${entry.rank}`}
                    </div>

                    {/* Address */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{
                          fontFamily: "monospace", fontSize: "0.9rem",
                          color: isMe ? "var(--highlight)" : "#fff",
                          fontWeight: isMe ? 700 : 400,
                        }}>
                          {shortAddr(entry.address)}
                        </span>
                        {isMe && (
                          <span style={{
                            fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em",
                            padding: "0.15rem 0.5rem", borderRadius: "9999px",
                            background: "rgba(240,230,78,0.15)", border: "1px solid rgba(240,230,78,0.35)",
                            color: "var(--highlight)", textTransform: "uppercase",
                          }}>
                            You
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>
                        {entry.positionCount} position{entry.positionCount !== 1 ? "s" : ""}
                      </div>
                    </div>

                    {/* Position Value */}
                    <div style={{ textAlign: "right", flexShrink: 0, minWidth: 90 }}>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: "1rem", color: "#4394f4" }}>
                        {fmtUsd(entry.totalValueUsd ?? 0)}
                      </div>
                      <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "0.1rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                        TVL
                      </div>
                    </div>

                    {/* Fees Earned */}
                    <div style={{ textAlign: "right", flexShrink: 0, minWidth: 90 }}>
                      <div style={{
                        fontFamily: "var(--font-display)", fontSize: "1rem",
                        color: rankStyle ? rankStyle.color : "#4ade80",
                      }}>
                        {fmtUsd(entry.uncollectedFeesUsd)}
                      </div>
                      <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "0.1rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                        fees earned
                      </div>
                    </div>

                  </div>
                </a>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
