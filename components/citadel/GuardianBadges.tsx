"use client"

import { useState, useEffect } from "react"
import type { Badge } from "@/lib/citadel/badgeCalculator"

interface GuardianStats {
  battleCount: number
  survivedBattles: number
  breachedBattles: number
  totalFeesUsd: number
  isFirstGuardian: boolean
  wasLastStand: boolean
  hasCollectedFees: boolean
}

interface GuardianProfile {
  address: string
  stats: GuardianStats
  badges: Badge[]
  recentBattles: {
    id: number
    outcome: string
    ended_at: string
    mcap_usd: number
    liquidity_contributed: string
    fees_earned_usd: number
  }[]
}

interface GuardianBadgesProps {
  address: string
}

export function GuardianBadges({ address }: GuardianBadgesProps) {
  const [profile, setProfile] = useState<GuardianProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/citadel/guardian/${address}`)
      .then(r => r.json())
      .then(d => setProfile(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [address])

  if (loading) {
    return (
      <div className="panel" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "1rem" }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ width: 60, height: 60, borderRadius: "50%" }} />
          ))}
        </div>
      </div>
    )
  }

  if (!profile || profile.stats.battleCount === 0) {
    return (
      <div className="panel" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", letterSpacing: "0.1em", color: "var(--text-muted)", textTransform: "uppercase" }}>
            Citadel Record
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-muted)" }}>
            No battles yet — join the defense to earn badges
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="panel" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem" }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: "0.85rem", letterSpacing: "0.1em", color: "var(--neon-cyan)", textTransform: "uppercase" }}>
          Guardian Record
        </h3>
        <div style={{ flex: 1, height: 1, background: "var(--glass-border)" }} />
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: "2rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {[
          { label: "Battles", value: profile.stats.battleCount },
          { label: "Defended", value: profile.stats.survivedBattles, color: "var(--neon-green)" },
          { label: "Breached", value: profile.stats.breachedBattles, color: "var(--neon-red)" },
          { label: "Fees Earned", value: `$${profile.stats.totalFeesUsd.toFixed(2)}`, color: "var(--neon-cyan)" },
        ].map(s => (
          <div key={s.label}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "0.58rem", letterSpacing: "0.1em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 3 }}>
              {s.label}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "1rem", color: s.color || "var(--text-primary)" }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Badges */}
      {profile.badges.length > 0 && (
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "0.62rem", letterSpacing: "0.1em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.75rem" }}>
            Earned Badges
          </div>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            {profile.badges.map(badge => (
              <div
                key={badge.type}
                style={{ position: "relative", cursor: "pointer" }}
                onMouseEnter={() => setHoveredBadge(badge.type)}
                onMouseLeave={() => setHoveredBadge(null)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={badge.image}
                  alt={badge.label}
                  className="badge-reveal"
                  style={{ width: 56, height: 56, objectFit: "cover", transition: "filter 0.2s", filter: hoveredBadge === badge.type ? "brightness(1.3) drop-shadow(0 0 8px var(--neon-cyan))" : "none" }}
                />

                {/* Tooltip */}
                {hoveredBadge === badge.type && (
                  <div style={{
                    position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
                    background: "var(--bg-panel-alt)", border: "1px solid var(--glass-border-bright)",
                    padding: "0.5rem 0.75rem", borderRadius: 2, whiteSpace: "nowrap", zIndex: 10,
                    boxShadow: "0 0 12px rgba(0,245,255,0.15)",
                  }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "0.65rem", letterSpacing: "0.08em", color: "var(--neon-cyan)", textTransform: "uppercase", marginBottom: 2 }}>
                      {badge.label}
                    </div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                      {badge.description}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent battles */}
      {profile.recentBattles.length > 0 && (
        <div style={{ marginTop: "1.25rem" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "0.62rem", letterSpacing: "0.1em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.75rem" }}>
            Recent Battles
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {profile.recentBattles.slice(0, 5).map(b => (
              <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.75rem", background: "rgba(0,0,0,0.3)", borderRadius: 1 }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "0.65rem", letterSpacing: "0.08em", textTransform: "uppercase",
                  color: b.outcome === "defended" ? "var(--neon-green)" : "var(--neon-red)" }}>
                  {b.outcome}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  ${(b.mcap_usd / 1e6).toFixed(2)}M
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--neon-cyan)" }}>
                  +${b.fees_earned_usd.toFixed(2)}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--text-muted)" }}>
                  {new Date(b.ended_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
