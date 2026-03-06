"use client"

/**
 * JoinCitadelForm — specialized liquidity form for joining the Citadel Wall
 * Wraps AddLiquidityForm with the wall's fixed tick range
 * and records participation via the guardian join API
 */

import { useState } from "react"
import { useAccount } from "wagmi"
import { useAppKit } from "@reown/appkit/react"
import { AddLiquidityForm } from "@/components/liquidity/AddLiquidityForm"
import type { CitadelWall } from "@/hooks/useCitadelWall"

interface JoinCitadelFormProps {
  wall: CitadelWall
  onJoined?: () => void
}

export function JoinCitadelForm({ wall, onJoined }: JoinCitadelFormProps) {
  const { address, isConnected } = useAccount()
  const { open } = useAppKit()
  const [joined] = useState(false)
  const [isFirstGuardian] = useState(false)

  if (!isConnected) {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)", marginBottom: "1.25rem", lineHeight: 1.6 }}>
          Connect your wallet to join the wall's defense and earn fees.
        </p>
        <button className="btn-primary" onClick={() => open()}>
          Connect Wallet
        </button>
      </div>
    )
  }

  if (joined) {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>
        {isFirstGuardian && (
          <div style={{ marginBottom: "1rem" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/badge-first-guardian.png" alt="First Guardian" style={{ width: 80, margin: "0 auto 0.75rem", display: "block" }} />
            <div style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", letterSpacing: "0.12em", color: "var(--neon-cyan)", textTransform: "uppercase" }}>
              FIRST GUARDIAN BADGE EARNED!
            </div>
          </div>
        )}
        <div style={{ fontFamily: "var(--font-display)", fontSize: "1rem", color: "var(--neon-green)", marginBottom: "0.5rem", letterSpacing: "0.08em" }}>
          ✓ YOU ARE NOW A GUARDIAN
        </div>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
          Your liquidity is defending the wall. You will earn 0.3% fees on all volume in range.
        </p>
      </div>
    )
  }

  const wallMcapM = (wall.mcap_usd / 1_000_000).toFixed(2)

  return (
    <div>
      <div className="panel" style={{ padding: "1rem 1.25rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "0.6rem", letterSpacing: "0.1em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 3 }}>
              Wall Target
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.1rem", color: "var(--neon-cyan)" }}>
              ${wallMcapM}M MCAP
            </div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "0.6rem", letterSpacing: "0.1em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 3 }}>
              Tick Range
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              {wall.tick_lower} → {wall.tick_upper}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "0.6rem", letterSpacing: "0.1em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 3 }}>
              Fee Rate
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "var(--neon-green)" }}>
              0.3%
            </div>
          </div>
        </div>
      </div>

      {/* Reuse existing AddLiquidityForm with prefilled range */}
      <AddLiquidityForm
        initialMinMcap={wall.mcap_usd}
        initialMaxMcap={wall.mcap_usd}
      />
    </div>
  )
}
