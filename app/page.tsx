"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { useAppKit } from "@reown/appkit/react"
import { useAccount } from "wagmi"
import { MarketStats } from "@/components/ui/MarketStats"
import { LiquidityDepthChart } from "@/components/liquidity/LiquidityDepthChart"
import { WarRoom } from "@/components/citadel/WarRoom"
import { BattleHistory } from "@/components/citadel/BattleHistory"
import { useGPUTier } from "@/hooks/useGPUTier"
import { integrityToImage } from "@/lib/citadel/wallImage"
import type { WallState } from "@/lib/citadel/wallIntegrity"

// Lazy load Three.js wall — heavy dependency
const CitadelWall3D = dynamic(
  () => import("@/components/citadel/CitadelWall3D").then(m => ({ default: m.CitadelWall3D })),
  { ssr: false, loading: () => <div style={{ width: "100%", height: "100%", background: "var(--bg-panel)" }} /> }
)

const NAV = [
  ["Citadel", "#citadel"],
  ["War Room", "#war-room"],
  ["Battles", "#battles"],
  ["Guardians", "#guardians"],
] as const

// ─── Hook: useCitadelWall ────────────────────────────────────────────────────
function useCitadelWall() {
  const [wall, setWall] = useState<null | {
    id: number
    tick_lower: number
    tick_upper: number
    mcap_usd: number
    status: string
    integrity: number
    wallState: string
    wallImage: string
    currentTick: number
    deployed_at: string
    peak_liquidity: string
  }>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchWall() {
      try {
        const res = await fetch("/api/citadel/wall")
        const data = await res.json()
        setWall(data.wall)
      } catch {
        setWall(null)
      } finally {
        setLoading(false)
      }
    }
    fetchWall()
    const interval = setInterval(fetchWall, 30_000)
    return () => clearInterval(interval)
  }, [])

  return { wall, loading }
}

// ─── Animated Counter ────────────────────────────────────────────────────────
function AnimatedCounter({ value, prefix = "", suffix = "", decimals = 0 }: {
  value: number; prefix?: string; suffix?: string; decimals?: number
}) {
  const [display, setDisplay] = useState(value)
  useEffect(() => {
    let start = display
    const end = value
    if (start === end) return
    const steps = 30
    const increment = (end - start) / steps
    let step = 0
    const t = setInterval(() => {
      step++
      start += increment
      setDisplay(step >= steps ? end : start)
      if (step >= steps) clearInterval(t)
    }, 16)
    return () => clearInterval(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <span style={{ fontFamily: "var(--font-mono)" }}>
      {prefix}{display.toFixed(decimals)}{suffix}
    </span>
  )
}

// ─── Wall Health Bar ─────────────────────────────────────────────────────────
function WallHealthBar({ integrity, wallState }: { integrity: number; wallState: string }) {
  const stateClass = wallState === "INTACT" ? "health-intact"
    : wallState === "SIEGE" ? "health-siege"
    : wallState === "CRITICAL" ? "health-critical"
    : "health-fallen"

  const stateColor = wallState === "INTACT" ? "var(--intact-color)"
    : wallState === "SIEGE" ? "var(--siege-color)"
    : wallState === "CRITICAL" ? "var(--critical-color)"
    : "var(--fallen-color)"

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "0.65rem", letterSpacing: "0.1em", color: "var(--text-muted)", textTransform: "uppercase" }}>
          Wall Integrity
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem", color: stateColor }}>
          {integrity}%
        </span>
      </div>
      <div className="health-bar-track">
        <div
          className={`health-bar-fill ${stateClass}`}
          style={{ width: `${Math.max(0, Math.min(100, integrity))}%` }}
        />
      </div>
    </div>
  )
}

// ─── Wall Visual (3D or 2D fallback) ────────────────────────────────────────
function WallVisual({ wall }: { wall: { integrity: number; wallState: string; wallImage: string } }) {
  const gpuTier = useGPUTier()
  const wallState = wall.wallState as WallState
  const use3D = gpuTier !== "low" && gpuTier !== "unknown"

  if (!use3D) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={integrityToImage(wall.integrity)}
        alt={`Wall - ${wall.wallState}`}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    )
  }

  return (
    <CitadelWall3D
      integrity={wall.integrity}
      wallState={wallState}
      style={{ width: "100%", height: "100%" }}
    />
  )
}

// ─── Active Battle Section ───────────────────────────────────────────────────
function ActiveBattleSection({ wall, loading }: {
  wall: ReturnType<typeof useCitadelWall>["wall"]
  loading: boolean
}) {
  // State A: No wall
  if (!loading && !wall) {
    return (
      <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
        <div className="panel" style={{ maxWidth: 600, margin: "0 auto", padding: "3rem 2rem" }}>
          <div style={{ fontSize: "4rem", marginBottom: "1rem", filter: "grayscale(1) opacity(0.4)" }}>🏰</div>
          <h2 className="section-title" style={{ marginBottom: "0.75rem", color: "var(--text-muted)" }}>
            NO ACTIVE WALL
          </h2>
          <p style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)", lineHeight: 1.6 }}>
            The Citadel has no active price wall. The admin must deploy a new wall to begin a battle.
          </p>
        </div>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", padding: "2rem 0" }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 100, borderRadius: 2 }} />
        ))}
      </div>
    )
  }

  if (!wall) return null

  const isBattle  = wall.status === "active"
  const isBreached = wall.status === "breached"
  const mcap = wall.mcap_usd

  const stateLabel = wall.wallState === "INTACT" ? "WALL INTACT"
    : wall.wallState === "SIEGE" ? "UNDER SIEGE"
    : wall.wallState === "CRITICAL" ? "CRITICAL — FALLING"
    : "WALL BREACHED"

  const stateClass = wall.wallState === "INTACT" ? "status-intact"
    : wall.wallState === "SIEGE" ? "status-siege"
    : wall.wallState === "CRITICAL" ? "status-critical"
    : "status-fallen"

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", alignItems: "start" }}>
      {/* Left: Wall image */}
      <div style={{ position: "relative" }}>
        <div className={`panel ${wall.wallState === "CRITICAL" ? "wall-shake" : ""}`}
             style={{ aspectRatio: "4/3", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <WallVisual wall={wall} />
          {/* Siege pulse rings for critical/siege */}
          {(wall.wallState === "SIEGE" || wall.wallState === "CRITICAL") && (
            <>
              <div className="siege-pulse-ring" style={{ width: "60%", height: "60%", top: "20%", left: "20%" }} />
              <div className="siege-pulse-ring" style={{ width: "80%", height: "80%", top: "10%", left: "10%", animationDelay: "0.7s" }} />
            </>
          )}
        </div>
        <div style={{ marginTop: "0.75rem" }}>
          <WallHealthBar integrity={wall.integrity} wallState={wall.wallState} />
        </div>
      </div>

      {/* Right: Stats */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* Status badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span className={`status-badge ${stateClass}`}>{stateLabel}</span>
          {isBattle && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--neon-red)", display: "inline-block", animation: "neon-pulse-red 1s ease-in-out infinite" }} />}
        </div>

        {/* MCAP target */}
        <div className="panel" style={{ padding: "1.25rem" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "0.6rem", letterSpacing: "0.12em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>
            Wall Target MCAP
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "2rem", color: "var(--neon-cyan)", letterSpacing: "0.05em" }}>
            <AnimatedCounter value={mcap} prefix="$" suffix="M" decimals={2} />
          </div>
        </div>

        {/* Tick range */}
        <div className="panel" style={{ padding: "1rem 1.25rem" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "0.6rem", letterSpacing: "0.12em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>
            Price Range
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
            <span style={{ color: "var(--text-secondary)" }}>Tick {wall.tick_lower}</span>
            <span style={{ color: "var(--text-muted)" }}>→</span>
            <span style={{ color: "var(--text-secondary)" }}>Tick {wall.tick_upper}</span>
          </div>
        </div>

        {/* Current tick */}
        <div className="panel" style={{ padding: "1rem 1.25rem" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "0.6rem", letterSpacing: "0.12em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>
            Current Pool Tick
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.2rem",
            color: wall.currentTick >= wall.tick_lower ? "var(--neon-green)" : "var(--neon-red)" }}>
            {wall.currentTick} {wall.currentTick >= wall.tick_lower ? "▲ IN RANGE" : "▼ BREACHED"}
          </div>
        </div>

        {/* CTA */}
        {isBattle && (
          <a href="#war-room" className="btn-primary" style={{ textAlign: "center" }}>
            JOIN THE DEFENSE →
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function Home() {
  const { open } = useAppKit()
  const { address, isConnected } = useAccount()
  const { wall, loading } = useCitadelWall()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrollY, setScrollY] = useState(0)

  const walletLabel = isConnected
    ? `${address?.slice(0, 6)}···${address?.slice(-4)}`
    : "Connect"

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-void)" }}>

      {/* ── Scroll progress bar ─────────────────── */}
      <div style={{
        position: "fixed", top: 0, left: 0, zIndex: 100,
        height: 2, background: "var(--neon-cyan)",
        width: `${Math.min(100, (scrollY / (document.body?.scrollHeight - window.innerHeight || 1)) * 100)}%`,
        transition: "width 0.1s",
        boxShadow: "0 0 8px var(--neon-cyan)",
      }} />

      {/* ── HEADER ─────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(3, 6, 8, 0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--glass-border)",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 1.5rem", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>

          {/* Logo */}
          <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "0.6rem" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/citadel-logo.png" alt="Citadel" style={{ height: 28, width: "auto" }} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.12em", color: "var(--neon-cyan)", textTransform: "uppercase" }}>
              Citadel Protocol
            </span>
          </a>

          {/* Nav */}
          <nav className="hidden md:flex" style={{ alignItems: "center", gap: "0.5rem" }}>
            {NAV.map(([label, href]) => (
              <a key={href} href={href} className="nav-link">{label}</a>
            ))}
          </nav>

          {/* Right */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {/* Wall status indicator */}
            {wall && (
              <span className="status-badge status-intact hidden md:inline-block"
                    style={{ fontSize: "0.6rem", padding: "2px 8px" }}>
                WALL LIVE
              </span>
            )}
            <button
              onClick={() => open()}
              className="btn-primary hidden md:inline-flex"
              style={{ fontSize: "0.72rem", padding: "0.5rem 1rem", minHeight: "2rem" }}
            >
              {walletLabel}
            </button>
            {/* Mobile hamburger */}
            <button
              className="md:hidden"
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ background: "none", border: "1px solid var(--glass-border)", cursor: "pointer", padding: "0.4rem 0.6rem", display: "flex", flexDirection: "column", gap: 4 }}
            >
              {[0,1,2].map(i => (
                <span key={i} style={{
                  display: "block", width: 18, height: 1.5,
                  background: "var(--neon-cyan)", borderRadius: 1,
                  transition: "all 0.2s",
                  transform: i===0&&menuOpen ? "rotate(45deg) translateY(5.5px)" : i===2&&menuOpen ? "rotate(-45deg) translateY(-5.5px)" : "none",
                  opacity: i===1&&menuOpen ? 0 : 1
                }} />
              ))}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div style={{ background: "var(--bg-panel)", borderTop: "1px solid var(--glass-border)", padding: "1rem 1.5rem" }}>
            {NAV.map(([label, href]) => (
              <a key={href} href={href} className="nav-link"
                 style={{ display: "block", padding: "0.6rem 0" }}
                 onClick={() => setMenuOpen(false)}>{label}</a>
            ))}
            <button onClick={() => { open(); setMenuOpen(false) }} className="btn-primary" style={{ width: "100%", marginTop: "0.75rem" }}>
              {walletLabel}
            </button>
          </div>
        )}
      </header>

      {/* ── HERO ───────────────────────────────── */}
      <section style={{
        minHeight: "85vh",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        textAlign: "center",
        padding: "4rem 1.5rem",
        position: "relative",
        overflow: "hidden",
        background: "radial-gradient(ellipse at 50% 60%, rgba(0,245,255,0.04) 0%, transparent 70%)",
      }}>
        {/* Background grid */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 0,
          backgroundImage: "linear-gradient(rgba(0,245,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,245,255,0.03) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
        }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 800 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.3em", color: "var(--neon-cyan)", marginBottom: "1.5rem", textTransform: "uppercase" }}>
            — Uniswap V4 Concentrated Liquidity —
          </div>

          <h1 className="hero-title" style={{ marginBottom: "1.5rem" }}>
            CITADEL<br />PROTOCOL
          </h1>

          <p style={{
            fontFamily: "var(--font-body)", fontSize: "clamp(1rem, 2vw, 1.25rem)", fontWeight: 500,
            color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: "2.5rem", maxWidth: 560, margin: "0 auto 2.5rem"
          }}>
            The admin deploys a <strong style={{ color: "var(--neon-cyan)" }}>price wall</strong> — a single-tick concentrated liquidity position.
            Guardians defend it. Bears attack. The wall lives or falls.
          </p>

          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <a href="#citadel" className="btn-primary">View Active Wall</a>
            <a href="#war-room" className="btn-secondary">Join the Defense</a>
          </div>
        </div>

        {/* Animated corner decorations */}
        <div style={{ position: "absolute", top: "2rem", left: "2rem", width: 60, height: 60, borderTop: "1px solid var(--neon-cyan)", borderLeft: "1px solid var(--neon-cyan)", opacity: 0.3 }} />
        <div style={{ position: "absolute", bottom: "2rem", right: "2rem", width: 60, height: 60, borderBottom: "1px solid var(--neon-cyan)", borderRight: "1px solid var(--neon-cyan)", opacity: 0.3 }} />
      </section>

      {/* ── ACTIVE CITADEL SECTION ─────────────── */}
      <section id="citadel" style={{ padding: "4rem 1.5rem", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
          <h2 className="section-title">Active Battle</h2>
          <div style={{ flex: 1, height: 1, background: "var(--glass-border)" }} />
          {!loading && wall && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Deployed {new Date(wall.deployed_at).toLocaleDateString()}
            </span>
          )}
        </div>
        <ActiveBattleSection wall={wall} loading={loading} />
      </section>

      {/* ── MARKET STATS ──────────────────────── */}
      <section id="market" style={{ padding: "2rem 1.5rem", borderTop: "1px solid var(--glass-border)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <MarketStats />
        </div>
      </section>

      {/* ── PRICE CHART ──────────────────────── */}
      <section style={{ padding: "3rem 1.5rem", borderTop: "1px solid var(--glass-border)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
            <h2 className="section-title">Depth Chart</h2>
            <div style={{ flex: 1, height: 1, background: "var(--glass-border)" }} />
          </div>
          <LiquidityDepthChart />
        </div>
      </section>

      {/* ── WAR ROOM ─────────────────────────── */}
      <section id="war-room" style={{ padding: "4rem 1.5rem", borderTop: "1px solid var(--glass-border)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
            <h2 className="section-title">War Room</h2>
            <div style={{ flex: 1, height: 1, background: "var(--glass-border)" }} />
          </div>
          <WarRoom wall={wall} loading={loading} />
        </div>
      </section>

      {/* ── BATTLE HISTORY ───────────────────── */}
      <section id="battles" style={{ padding: "4rem 1.5rem", borderTop: "1px solid var(--glass-border)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
            <h2 className="section-title">Battle History</h2>
            <div style={{ flex: 1, height: 1, background: "var(--glass-border)" }} />
          </div>
          <BattleHistory />
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────── */}
      <footer style={{ borderTop: "1px solid var(--glass-border)", padding: "2rem 1.5rem", marginTop: "2rem" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.1em", color: "var(--text-muted)", textTransform: "uppercase" }}>
            Citadel Protocol — Defend the Wall
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--text-muted)" }}>
            ZEUS: 0x0f7d...cCC8 · Pool Fee: 0.3% · Tick Spacing: 60
          </span>
        </div>
      </footer>
    </div>
  )
}
