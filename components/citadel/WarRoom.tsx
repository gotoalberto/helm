"use client"

import { useState } from "react"
import type { CitadelWall } from "@/hooks/useCitadelWall"
import { JoinCitadelForm } from "./JoinCitadelForm"

interface WarRoomProps {
  wall: CitadelWall | null
  loading: boolean
}

export function WarRoom({ wall, loading }: WarRoomProps) {
  const [activeTab, setActiveTab] = useState<"join" | "leaderboard">("join")

  if (loading) {
    return (
      <div className="war-room-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {[0, 1].map(i => (
          <div key={i} className="skeleton" style={{ height: 200, borderRadius: 2 }} />
        ))}
      </div>
    )
  }

  if (!wall || wall.status !== "active") {
    return (
      <div className="panel" style={{ padding: "3rem", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem", opacity: 0.3 }}>⚔️</div>
        <p style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", letterSpacing: "0.1em", color: "var(--text-muted)", textTransform: "uppercase" }}>
          No active battle — war room offline
        </p>
      </div>
    )
  }

  return (
    <div className="war-room-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", alignItems: "start" }}>

      {/* Left: Join form */}
      <div>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
          <button
            onClick={() => setActiveTab("join")}
            className={activeTab === "join" ? "btn-primary" : "btn-secondary"}
            style={{ fontSize: "0.7rem", padding: "0.4rem 1rem", minHeight: "1.8rem" }}
          >
            Join Defense
          </button>
          <button
            onClick={() => setActiveTab("leaderboard")}
            className={activeTab === "leaderboard" ? "btn-primary" : "btn-secondary"}
            style={{ fontSize: "0.7rem", padding: "0.4rem 1rem", minHeight: "1.8rem" }}
          >
            Guardians
          </button>
        </div>

        {activeTab === "join" ? (
          <div className="panel" style={{ padding: "1.5rem" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "0.85rem", letterSpacing: "0.1em", color: "var(--neon-cyan)", textTransform: "uppercase", marginBottom: "1rem" }}>
              Join the Defense
            </h3>
            <JoinCitadelForm wall={wall} />
          </div>
        ) : (
          <div className="panel" style={{ padding: "2rem", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Guardian leaderboard — live data from on-chain positions coming soon
            </p>
          </div>
        )}
      </div>

      {/* Right: Battle info */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div className="panel" style={{ padding: "1.5rem" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", letterSpacing: "0.1em", color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: "1rem" }}>
            Battle Briefing
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "0.65rem", color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Mission</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-secondary)" }}>Defend ${(wall.mcap_usd / 1e6).toFixed(2)}M MCAP</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "0.65rem", color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Strategy</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-secondary)" }}>Add ETH/ZEUS liquidity</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "0.65rem", color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Reward</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--neon-green)" }}>0.3% on all volume</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "0.65rem", color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Risk</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--neon-orange)" }}>IL if price moves far</span>
            </div>
          </div>
        </div>

        <div className="panel" style={{ padding: "1.25rem" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", letterSpacing: "0.1em", color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: "1rem" }}>
            How to Defend
          </h3>
          <ol style={{ paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {[
              "Connect your wallet above",
              "Set amount of ETH/ZEUS to provide",
              "Approve ZEUS spend if needed",
              "Confirm the liquidity transaction",
              "Earn fees while price stays in range",
            ].map((step, i) => (
              <li key={i} style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* Badges preview */}
        <div className="panel" style={{ padding: "1.25rem" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", letterSpacing: "0.1em", color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: "0.75rem" }}>
            Earnable Badges
          </h3>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {[
              { src: "/badge-first-guardian.png", label: "First Guardian" },
              { src: "/badge-fee-harvester.png", label: "Fee Harvester" },
              { src: "/badge-veteran.png", label: "Veteran" },
              { src: "/badge-survivor.png", label: "Survivor" },
            ].map(b => (
              <div key={b.label} style={{ textAlign: "center" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.src} alt={b.label} style={{ width: 40, height: 40, objectFit: "cover" }} />
                <div style={{ fontFamily: "var(--font-display)", fontSize: "0.5rem", color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 3 }}>
                  {b.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
