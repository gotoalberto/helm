"use client"

import { useState } from "react"
import { LiquidityDepthChart } from "@/components/liquidity/LiquidityDepthChart"
import { MarketStats } from "@/components/ui/MarketStats"
import { PositionsList } from "@/components/positions/PositionsList"
import { AddLiquidityForm } from "@/components/liquidity/AddLiquidityForm"
import { AprDisplay } from "@/components/ui/AprDisplay"
import { FeeLeaderboard } from "@/components/ui/FeeLeaderboard"
import { useAppKit } from "@reown/appkit/react"
import { useAccount } from "wagmi"

const NAV = [["Defend", "#defend"], ["Market", "#market"], ["Positions", "#positions"], ["Add LP", "#addlp"]] as const

export default function Home() {
  const { open } = useAppKit()
  const { address, isConnected } = useAccount()
  const [menuOpen, setMenuOpen] = useState(false)
  const [prefillMcap, setPrefillMcap] = useState<{ min: number; max: number } | null>(null)
  const walletLabel = isConnected ? `${address?.slice(0, 6)}...${address?.slice(-4)}` : "Connect Wallet"

  function handleJoinRange(mcapLow: number, mcapHigh: number) {
    setPrefillMcap({ min: mcapLow, max: mcapHigh })
    document.getElementById("addlp")?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>

      {/* ── HEADER ────────────────────────────────── */}
      <header className="header-zeus" style={{ position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1440, margin: "0 auto", padding: "0 1.5rem", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>

          <a href="/" style={{ display: "flex", alignItems: "center", gap: "0.55rem", textDecoration: "none" }}>
            <span style={{ fontFamily: "var(--font-body)", fontSize: "1rem", fontWeight: 700, color: "#fff", letterSpacing: "0.01em" }}>earn.pepes.dog</span>
          </a>

          <nav className="hidden md:flex" style={{ alignItems: "center", gap: "0.1rem" }}>
            {NAV.map(([l, h]) => <a key={h} href={h} className="nav-link">{l}</a>)}
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button onClick={() => open()} className="btn-zeus hidden md:inline-flex" style={{ fontSize: "0.82rem", padding: "0.45rem 1.2rem", minHeight: "2rem" }}>{walletLabel}</button>
            <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)} style={{ background: "none", border: "none", cursor: "pointer", padding: "0.4rem", flexDirection: "column", gap: 5 }}>
              {[0,1,2].map(i => <span key={i} style={{ display: "block", width: 20, height: 2, background: "#fff", borderRadius: 2, transition: "all 0.2s", transform: i===0&&menuOpen?"rotate(45deg) translateY(7px)":i===2&&menuOpen?"rotate(-45deg) translateY(-7px)":"none", opacity: i===1&&menuOpen?0:1 }}/>)}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div style={{ background: "rgba(19,12,26,0.98)", borderTop: "1px solid var(--glass-border)", padding: "1rem 1.5rem 1.5rem" }}>
            <nav style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
              {NAV.map(([l, h]) => <a key={h} href={h} onClick={() => setMenuOpen(false)} className="nav-link" style={{ fontSize: "1rem", padding: "0.65rem 0.75rem" }}>{l}</a>)}
              <div style={{ height: 1, background: "var(--glass-border)", margin: "0.75rem 0" }} />
              <button onClick={() => { open(); setMenuOpen(false) }} className="btn-zeus" style={{ width: "100%" }}>{walletLabel}</button>
            </nav>
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section style={{ minHeight: "calc(100vh - 60px)", display: "flex", alignItems: "center", padding: "5rem 1.5rem 4rem", position: "relative", overflow: "hidden" }}>

        <div style={{ position: "absolute", top: "-20%", left: "50%", transform: "translateX(-50%)", width: "80%", height: "60%", background: "radial-gradient(ellipse, rgba(240,230,78,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-10%", right: "10%", width: "40%", height: "40%", background: "radial-gradient(ellipse, rgba(109,156,244,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ maxWidth: 1280, margin: "0 auto", width: "100%" }}>

          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "var(--glass-bg)", border: "1px solid var(--glass-border-bright)", borderRadius: "9999px", padding: "0.3rem 1rem", width: "fit-content", backdropFilter: "blur(12px)", marginBottom: "1.75rem" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80" }} />
            <span style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Price Defender HQ
            </span>
          </div>

          {/* Title */}
          <div style={{ marginBottom: "1.25rem" }}>
            <img src="/title.webp" alt="ZEUS — Pepe's Dog" style={{ maxWidth: "clamp(280px, 50vw, 520px)", height: "auto", mixBlendMode: "screen" }} />
          </div>

          {/* Tagline */}
          <p style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.2rem, 2.5vw, 1.8rem)", color: "#fff", marginBottom: "0.75rem", letterSpacing: "-0.01em" }}>
            Become a Price Defender
          </p>

          {/* Description */}
          <p style={{ fontSize: "clamp(1rem, 1.5vw, 1.1rem)", color: "var(--text-secondary)", lineHeight: 1.65, maxWidth: 560, marginBottom: "1.75rem" }}>
            Don't just hold — defend. Add liquidity to the ZEUS/ETH pool and earn trading fees while protecting the price.
          </p>

          {/* Stats pills */}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.75rem" }}>
            {[{ v: "0%", l: "Tax" }, { v: "V4", l: "Uniswap" }].map(({ v, l }) => (
              <div key={l} style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border-bright)", borderRadius: "9999px", padding: "0.4rem 1rem", display: "flex", gap: "0.4rem", alignItems: "center", backdropFilter: "blur(8px)" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "1rem", color: "#fff" }}>{v}</span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>{l}</span>
              </div>
            ))}
            <AprDisplay variant="pill" />
          </div>

          {/* CTAs */}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <a href="#addlp" className="btn-zeus" style={{ fontSize: "1rem", padding: "0.8rem 2rem" }}>Start Defending</a>
            <a href="#positions" className="btn-outline" style={{ fontSize: "1rem", padding: "0.8rem 2rem" }}>My Positions</a>
          </div>
        </div>
      </section>

      {/* ── WHY LP? — 3 value props ── */}
      <section id="defend" style={{ padding: "5rem 1.5rem", background: "var(--bg-secondary)", borderTop: "1px solid var(--glass-border)", borderBottom: "1px solid var(--glass-border)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ marginBottom: "3rem" }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.4rem" }}>Why LP?</p>
            <h2 className="section-title">Three Reasons to Defend</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>

            {/* Card 1: DCA Exit */}
            <div className="card-zeus" style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1rem", borderTop: "2px solid rgba(240,230,78,0.3)" }}>
              <div style={{ width: 40, height: 40, borderRadius: "0.75rem", background: "rgba(240,230,78,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(240,230,78,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                  <polyline points="16 7 22 7 22 13" />
                </svg>
              </div>
              <div>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", color: "#f0e64e", marginBottom: "0.5rem" }}>Gradual Selling</h3>
                <p style={{ fontSize: "0.92rem", color: "var(--text-secondary)", lineHeight: 1.65 }}>
                  As ZEUS pumps through your range, you sell gradually at every price level — not in one panic dump. Classic DCA exit, automated.
                </p>
              </div>
            </div>

            {/* Card 2: Defend */}
            <div className="card-zeus" style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1rem", borderTop: "2px solid rgba(67,148,244,0.4)" }}>
              <div style={{ width: 40, height: 40, borderRadius: "0.75rem", background: "rgba(67,148,244,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(67,148,244,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", color: "#4394f4", marginBottom: "0.5rem" }}>Defend the Price</h3>
                <p style={{ fontSize: "0.92rem", color: "var(--text-secondary)", lineHeight: 1.65 }}>
                  Your liquidity acts as a buy wall below current price. When bears attack, your position absorbs the sell pressure and keeps the floor.
                </p>
              </div>
            </div>

            {/* Card 3: Earn Fees */}
            <div className="card-zeus" style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1rem", borderTop: "2px solid rgba(34,197,94,0.4)" }}>
              <div style={{ width: 40, height: 40, borderRadius: "0.75rem", background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(34,197,94,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <div>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", color: "#22c55e", marginBottom: "0.5rem" }}>Earn Fees</h3>
                <p style={{ fontSize: "0.92rem", color: "var(--text-secondary)", lineHeight: 1.65 }}>
                  Every swap through your range pays you. The more volume, the more you earn.
                </p>
                <AprDisplay variant="card" />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── MARKET STATS ──────────────────────────── */}
      <section id="market" style={{ padding: "5rem 1.5rem" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ marginBottom: "2.5rem" }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.4rem" }}>Live Data</p>
            <h2 className="section-title">Market Overview</h2>
          </div>
          <MarketStats />
        </div>
      </section>

      {/* ── DEFENDERS MAP ─────────────────────────── */}
      <section style={{ padding: "5rem 1.5rem", background: "var(--bg-secondary)", borderTop: "1px solid var(--glass-border)", borderBottom: "1px solid var(--glass-border)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "2.5rem", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.4rem" }}>V4 Liquidity Zones</p>
              <h2 className="section-title">The Defense Lines</h2>
            </div>
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", maxWidth: 420, lineHeight: 1.6, textAlign: "right" }}>
              This is where pepes.dog holders are putting real ETH on the line to defend the price. Each rectangle is a live LP position. Yellow = in range, blue = standby.
            </p>
          </div>
          <div className="card-zeus" style={{ padding: "1.5rem" }}>
            <LiquidityDepthChart onJoinRange={handleJoinRange} />
          </div>
        </div>
      </section>

      {/* ── PROMO ── */}
      <section style={{ padding: "5rem 1.5rem" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div className="feature-card" style={{ padding: "3rem 3.5rem", position: "relative", overflow: "hidden" }}>

            <div style={{ position: "absolute", top: "-30%", right: "-5%", width: 400, height: 400, background: "radial-gradient(circle, rgba(240,230,78,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 540 }}>
              <div>
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.5rem" }}>Uniswap V4</p>
                <h2 className="section-title">Join the<br />Defenders</h2>
              </div>
              <p style={{ fontSize: "1rem", color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 400 }}>
                Don't let bears eat the floor. Put your ZEUS and ETH to work as concentrated liquidity — earn fees, set your exit, and defend at the same time.
              </p>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                {[{ v: "0%", l: "Tax" }, { v: "0.3%", l: "Fee Tier" }, { v: "V4", l: "Uniswap" }].map(({ v, l }) => (
                  <div key={l} className="card-yellow" style={{ padding: "0.65rem 1.2rem", textAlign: "center" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", lineHeight: 1, color: "rgba(240,230,78,0.9)" }}>{v}</div>
                    <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(240,230,78,0.5)", marginTop: "0.2rem" }}>{l}</div>
                  </div>
                ))}
              </div>
              <a href="#addlp" className="btn-zeus" style={{ width: "fit-content", fontSize: "1rem" }}>Start Defending</a>
            </div>
          </div>
        </div>
      </section>

      {/* ── LEADERBOARD ── */}
      <FeeLeaderboard />

      {/* ── POSITIONS ── */}
      <PositionsList />

      {/* ── ADD LIQUIDITY ─────────────────────────── */}
      <section id="addlp" style={{ padding: "5rem 1.5rem", background: "var(--bg-secondary)", borderTop: "1px solid var(--glass-border)", borderBottom: "1px solid var(--glass-border)" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.5rem" }}>Uniswap V4 Pool</p>
            <h2 className="section-title">Add Liquidity</h2>
          </div>
          <div className="card-zeus" style={{ padding: "2rem 2.5rem" }}>
            <AddLiquidityForm initialMinMcap={prefillMcap?.min} initialMaxMcap={prefillMcap?.max} onConnect={() => open()} />
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: "var(--bg-primary)", borderTop: "1px solid var(--glass-border)", padding: "3rem 1.5rem" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1.5rem", marginBottom: "2rem" }}>
            <a href="/" style={{ display: "flex", alignItems: "center", gap: "0.6rem", textDecoration: "none" }}>
              <div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: "1rem", fontWeight: 700, color: "#fff" }}>earn.pepes.dog</div>
                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 500 }}>ZEUS Liquidity Manager</div>
              </div>
            </a>
          </div>

          <div className="divider" />
          <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", textAlign: "center", marginTop: "1.5rem", lineHeight: 1.6 }}>
            Built on Uniswap V4 · Ethereum Mainnet · Not financial advice. Use at your own risk.
          </p>
        </div>
      </footer>

    </div>
  )
}
