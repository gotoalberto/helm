"use client"

import { useState, useEffect, useCallback } from "react"
import { mcapToTick } from "@/lib/uniswap/mcap"

// ─── Types ───────────────────────────────────────────────────────────────────
interface Wall {
  id: number
  tick_lower: number
  tick_upper: number
  mcap_usd: number
  status: string
  deployed_at: string
  demolished_at?: string
  breached_at?: string
  peak_liquidity: string
}

// ─── Auth Gate ───────────────────────────────────────────────────────────────
function AuthGate({ onAuth }: { onAuth: (pw: string) => void }) {
  const [pw, setPw] = useState("")
  const [error, setError] = useState("")

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    // Test password against a protected endpoint
    const res = await fetch("/api/citadel/wall", {
      headers: { "x-admin-password": pw },
    })
    // We check by trying to POST a fake wall and seeing if we get 401 vs another error
    const testRes = await fetch("/api/citadel/wall", {
      method: "POST",
      headers: { "x-admin-password": pw, "Content-Type": "application/json" },
      body: JSON.stringify({ __test: true }),
    })
    if (testRes.status === 401) {
      setError("Invalid password")
    } else {
      onAuth(pw)
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-void)",
      backgroundImage: "radial-gradient(ellipse at 50% 50%, rgba(0,245,255,0.03) 0%, transparent 70%)",
    }}>
      <div style={{ width: "100%", maxWidth: 360, padding: "2rem" }}>
        <div className="panel" style={{ padding: "2rem" }}>
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/citadel-logo.png" alt="Citadel" style={{ height: 48, margin: "0 auto 1rem" }} />
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", letterSpacing: "0.15em", color: "var(--neon-cyan)", textTransform: "uppercase" }}>
              Admin Access
            </h1>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>
              CITADEL PROTOCOL — COMMAND CENTER
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ fontFamily: "var(--font-display)", fontSize: "0.65rem", letterSpacing: "0.1em", color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                className={`input-citadel ${error ? "error" : ""}`}
                value={pw}
                onChange={e => { setPw(e.target.value); setError("") }}
                placeholder="Enter admin password"
                autoFocus
              />
              {error && (
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--neon-red)", marginTop: 6 }}>
                  ⚠ {error}
                </p>
              )}
            </div>
            <button type="submit" className="btn-primary">Access Command Center</button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── Deploy Wall Form ─────────────────────────────────────────────────────────
function DeployWallForm({ password, onDeploy }: { password: string; onDeploy: () => void }) {
  const [mcap, setMcap] = useState("")
  const [ethPrice, setEthPrice] = useState<number | null>(null)
  const [totalSupply, setTotalSupply] = useState<bigint>(BigInt("420690000000000000000000")) // fallback
  const [preview, setPreview] = useState<{ tickLower: number; tickUpper: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    fetch("/api/price").then(r => r.json()).then(d => {
      setEthPrice(d.ethPriceUsd || 3000)
    }).catch(() => setEthPrice(3000))
  }, [])

  const calcPreview = useCallback(() => {
    const mcapVal = parseFloat(mcap.replace(/[,$]/g, "")) * 1_000_000
    if (!mcapVal || !ethPrice) return
    try {
      const tick = mcapToTick(mcapVal, ethPrice, totalSupply)
      setPreview({ tickLower: tick, tickUpper: tick + 60 })
    } catch {
      setPreview(null)
    }
  }, [mcap, ethPrice, totalSupply])

  useEffect(() => { calcPreview() }, [calcPreview])

  async function handleDeploy() {
    if (!preview) return
    setLoading(true)
    setError("")
    try {
      const mcapVal = parseFloat(mcap.replace(/[,$]/g, "")) * 1_000_000
      const res = await fetch("/api/citadel/wall", {
        method: "POST",
        headers: { "x-admin-password": password, "Content-Type": "application/json" },
        body: JSON.stringify({
          tickLower: preview.tickLower,
          tickUpper: preview.tickUpper,
          mcapUsd: mcapVal,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Deploy failed")
      setConfirmOpen(false)
      onDeploy()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Deploy failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="panel" style={{ padding: "1.5rem" }}>
      <h3 style={{ fontFamily: "var(--font-display)", fontSize: "0.85rem", letterSpacing: "0.1em", color: "var(--neon-cyan)", textTransform: "uppercase", marginBottom: "1.25rem" }}>
        Deploy New Wall
      </h3>

      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ fontFamily: "var(--font-display)", fontSize: "0.62rem", letterSpacing: "0.1em", color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
            Target MCAP (USD millions)
          </label>
          <input
            type="text"
            className="input-citadel"
            value={mcap}
            onChange={e => setMcap(e.target.value)}
            placeholder="e.g. 1.5 (= $1.5M)"
          />
        </div>

        {preview && (
          <div className="panel" style={{ padding: "0.75rem 1rem", minWidth: 220 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "0.6rem", color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
              Preview
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              tickLower: <span style={{ color: "var(--neon-cyan)" }}>{preview.tickLower}</span>
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              tickUpper: <span style={{ color: "var(--neon-cyan)" }}>{preview.tickUpper}</span>
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 4 }}>
              @ ETH ${ethPrice?.toLocaleString() ?? "..."}
            </div>
          </div>
        )}

        <button
          className="btn-primary"
          disabled={!preview || loading}
          onClick={() => setConfirmOpen(true)}
          style={{ whiteSpace: "nowrap" }}
        >
          {loading ? "Deploying..." : "Deploy Wall →"}
        </button>
      </div>

      {error && (
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--neon-red)", marginTop: "0.75rem" }}>
          ⚠ {error}
        </p>
      )}

      {/* Confirm modal */}
      {confirmOpen && preview && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div className="panel" style={{ maxWidth: 400, width: "90%", padding: "2rem" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "0.9rem", letterSpacing: "0.1em", color: "var(--neon-cyan)", marginBottom: "1rem" }}>
              Confirm Wall Deploy
            </h3>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.8, marginBottom: "1.5rem" }}>
              <div>MCAP Target: <span style={{ color: "var(--neon-cyan)" }}>${(parseFloat(mcap)*1e6).toLocaleString()}</span></div>
              <div>tickLower: <span style={{ color: "var(--neon-cyan)" }}>{preview.tickLower}</span></div>
              <div>tickUpper: <span style={{ color: "var(--neon-cyan)" }}>{preview.tickUpper}</span></div>
              <div style={{ color: "var(--neon-orange)", marginTop: "0.5rem", fontSize: "0.75rem" }}>
                ⚠ Any existing active wall will be demolished
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button className="btn-primary" onClick={handleDeploy} disabled={loading} style={{ flex: 1 }}>
                {loading ? "Deploying..." : "Confirm Deploy"}
              </button>
              <button className="btn-secondary" onClick={() => setConfirmOpen(false)} style={{ flex: 1 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Wall Card ───────────────────────────────────────────────────────────────
function WallCard({ wall, password, onAction }: { wall: Wall; password: string; onAction: () => void }) {
  const [demolishing, setDemolishing] = useState(false)
  const [confirmDemolish, setConfirmDemolish] = useState(false)

  const statusColor = wall.status === "active" ? "var(--neon-green)"
    : wall.status === "breached" ? "var(--neon-red)"
    : "var(--text-muted)"

  async function handleDemolish() {
    setDemolishing(true)
    await fetch(`/api/citadel/wall/${wall.id}`, {
      method: "DELETE",
      headers: { "x-admin-password": password },
    })
    setConfirmDemolish(false)
    setDemolishing(false)
    onAction()
  }

  return (
    <div className="panel" style={{ padding: "1.25rem", display: "grid", gridTemplateColumns: "1fr auto", alignItems: "start", gap: "1rem" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", fontWeight: 700, color: statusColor, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {wall.status}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--text-muted)" }}>
            ID #{wall.id}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "0.58rem", color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>MCAP</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem", color: "var(--neon-cyan)" }}>
              ${(wall.mcap_usd / 1e6).toFixed(2)}M
            </div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "0.58rem", color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Ticks</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              {wall.tick_lower} → {wall.tick_upper}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "0.58rem", color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Deployed</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              {new Date(wall.deployed_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
      {wall.status === "active" && (
        <div>
          {confirmDemolish ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <button className="btn-danger" onClick={handleDemolish} disabled={demolishing} style={{ fontSize: "0.7rem", padding: "0.4rem 0.8rem" }}>
                {demolishing ? "..." : "Confirm"}
              </button>
              <button className="btn-secondary" onClick={() => setConfirmDemolish(false)} style={{ fontSize: "0.7rem", padding: "0.4rem 0.8rem" }}>
                Cancel
              </button>
            </div>
          ) : (
            <button className="btn-danger" onClick={() => setConfirmDemolish(true)} style={{ fontSize: "0.7rem", padding: "0.4rem 0.8rem" }}>
              Demolish
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────
export default function AdminPage() {
  const [password, setPassword] = useState("")
  const [walls, setWalls] = useState<Wall[]>([])
  const [battles, setBattles] = useState<{ id: number; outcome: string; ended_at: string; mcap_usd: number; guardian_count: number }[]>([])
  const [loadingData, setLoadingData] = useState(false)

  const fetchData = useCallback(async () => {
    if (!password) return
    setLoadingData(true)
    try {
      const [wallsRes, battlesRes] = await Promise.all([
        fetch("/api/citadel/wall"),
        fetch("/api/citadel/battles"),
      ])
      const wallData = await wallsRes.json()
      const battleData = await battlesRes.json()

      // Also fetch all walls (active + history) — for now just show active
      if (wallData.wall) setWalls([wallData.wall])
      else setWalls([])

      setBattles(battleData.battles || [])
    } catch {
      // ignore
    } finally {
      setLoadingData(false)
    }
  }, [password])

  useEffect(() => {
    if (password) fetchData()
  }, [password, fetchData])

  if (!password) {
    return <AuthGate onAuth={pw => setPassword(pw)} />
  }

  const activeWall = walls.find(w => w.status === "active")

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-void)",
      backgroundImage: "radial-gradient(ellipse at 50% 0%, rgba(0,245,255,0.03) 0%, transparent 60%)",
    }}>
      {/* Header */}
      <header style={{ background: "rgba(3,6,8,0.95)", borderBottom: "1px solid var(--glass-border)", padding: "0 1.5rem" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <a href="/" style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", letterSpacing: "0.1em", color: "var(--text-muted)", textDecoration: "none", textTransform: "uppercase" }}>
              ← Citadel
            </a>
            <span style={{ color: "var(--glass-border)" }}>|</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "0.85rem", letterSpacing: "0.12em", color: "var(--neon-cyan)", textTransform: "uppercase" }}>
              Command Center
            </span>
          </div>
          <button
            onClick={() => setPassword("")}
            className="btn-secondary"
            style={{ fontSize: "0.7rem", padding: "0.35rem 0.8rem", minHeight: "1.8rem" }}
          >
            Logout
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1.5rem" }}>
        {/* Status bar */}
        <div className="panel" style={{ padding: "1rem 1.5rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap" }}>
          <div>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "0.6rem", letterSpacing: "0.1em", color: "var(--text-muted)", textTransform: "uppercase" }}>Wall Status</span>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem", color: activeWall ? "var(--neon-green)" : "var(--text-muted)", marginTop: 2 }}>
              {activeWall ? `ACTIVE — $${(activeWall.mcap_usd/1e6).toFixed(2)}M` : "NO ACTIVE WALL"}
            </div>
          </div>
          <div>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "0.6rem", letterSpacing: "0.1em", color: "var(--text-muted)", textTransform: "uppercase" }}>Total Battles</span>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem", color: "var(--text-primary)", marginTop: 2 }}>
              {battles.length}
            </div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <button onClick={fetchData} disabled={loadingData} className="btn-secondary" style={{ fontSize: "0.7rem", padding: "0.35rem 0.8rem", minHeight: "1.8rem" }}>
              {loadingData ? "..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Grid layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          {/* Left: Deploy */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <DeployWallForm password={password} onDeploy={fetchData} />

            {/* Active wall */}
            <div>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", letterSpacing: "0.1em", color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: "0.75rem" }}>
                Active Wall
              </h3>
              {activeWall ? (
                <WallCard wall={activeWall} password={password} onAction={fetchData} />
              ) : (
                <div className="panel" style={{ padding: "2rem", textAlign: "center" }}>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    No active wall. Deploy one above.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Battle history */}
          <div>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", letterSpacing: "0.1em", color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: "0.75rem" }}>
              Battle History
            </h3>
            {battles.length === 0 ? (
              <div className="panel" style={{ padding: "2rem", textAlign: "center" }}>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  No battles recorded yet.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: 500, overflowY: "auto" }}>
                {battles.map(battle => (
                  <div key={battle.id} className="panel" style={{ padding: "1rem 1.25rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase",
                        color: battle.outcome === "defended" ? "var(--neon-green)" : "var(--neon-red)" }}>
                        {battle.outcome === "defended" ? "DEFENDED" : "BREACHED"}
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--text-muted)" }}>
                        {new Date(battle.ended_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 4 }}>
                      ${(battle.mcap_usd / 1e6).toFixed(2)}M — {battle.guardian_count} guardians
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
