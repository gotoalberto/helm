"use client"

import { useState, useEffect } from "react"

interface Battle {
  id: number
  wall_id: number
  outcome: string
  ended_at: string
  peak_liquidity: string
  guardian_count: number
  mcap_usd: number
  tick_lower: number
  tick_upper: number
}

export function BattleHistory() {
  const [battles, setBattles] = useState<Battle[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Battle | null>(null)

  useEffect(() => {
    fetch("/api/citadel/battles")
      .then(r => r.json())
      .then(d => setBattles(d.battles || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 120, borderRadius: 2 }} />
        ))}
      </div>
    )
  }

  if (battles.length === 0) {
    return (
      <div className="panel" style={{ padding: "3rem", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem", opacity: 0.3 }}>📜</div>
        <p style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", letterSpacing: "0.1em", color: "var(--text-muted)", textTransform: "uppercase" }}>
          No battles recorded yet — be the first guardian
        </p>
      </div>
    )
  }

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
        {battles.map(battle => {
          const isDefended = battle.outcome === "defended"
          const accentColor = isDefended ? "var(--neon-green)" : "var(--neon-red)"
          const borderColor = isDefended ? "rgba(0,255,136,0.2)" : "rgba(255,34,68,0.2)"

          return (
            <div
              key={battle.id}
              onClick={() => setSelected(selected?.id === battle.id ? null : battle)}
              style={{
                background: "var(--bg-panel)",
                border: `1px solid ${borderColor}`,
                borderLeft: `3px solid ${accentColor}`,
                borderRadius: 2,
                padding: "1.25rem",
                cursor: "pointer",
                transition: "background 0.2s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: accentColor }}>
                  {isDefended ? "DEFENDED" : "BREACHED"}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--text-muted)" }}>
                  #{battle.id}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "0.58rem", color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>MCAP</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem", color: "var(--text-primary)" }}>
                    ${(battle.mcap_usd / 1e6).toFixed(2)}M
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "0.58rem", color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>Guardians</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem", color: "var(--text-primary)" }}>
                    {battle.guardian_count}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "0.58rem", color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>Date</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    {new Date(battle.ended_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Battle report modal */}
      {selected && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setSelected(null)}
        >
          <div
            className="panel"
            style={{ maxWidth: 480, width: "90%", padding: "2rem" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1rem", letterSpacing: "0.1em", textTransform: "uppercase", color: selected.outcome === "defended" ? "var(--neon-green)" : "var(--neon-red)" }}>
                Battle Report #{selected.id}
              </h3>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.2rem" }}>×</button>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selected.outcome === "defended" ? "/wall-100.png" : "/wall-0.png"}
              alt="Battle result"
              style={{ width: "100%", height: 160, objectFit: "cover", marginBottom: "1.5rem", borderRadius: 1 }}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              {[
                { label: "Outcome", value: selected.outcome.toUpperCase(), color: selected.outcome === "defended" ? "var(--neon-green)" : "var(--neon-red)" },
                { label: "MCAP Target", value: `$${(selected.mcap_usd / 1e6).toFixed(2)}M` },
                { label: "Tick Range", value: `${selected.tick_lower} → ${selected.tick_upper}` },
                { label: "Guardians", value: selected.guardian_count.toString() },
                { label: "Ended", value: new Date(selected.ended_at).toLocaleString() },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "0.58rem", letterSpacing: "0.1em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 3 }}>
                    {item.label}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: item.color || "var(--text-primary)" }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
