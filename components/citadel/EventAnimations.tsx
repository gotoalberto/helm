"use client"

/**
 * Event Animations — Breach, Deploy, Join sequences
 *
 * BREACH  (3200ms): Flash rojo → glitch texto → shake → oscurecer → "WALL BREACHED"
 * DEPLOY  (2500ms): Líneas escaneando → paredes materializándose → "WALL DEPLOYED"
 * JOIN    (800ms):  Pulso cyan → badge reveal → "GUARDIAN JOINED"
 */

import { useEffect, useRef, useState } from "react"

// ─── Breach Animation (3200ms) ────────────────────────────────────────────────
export function BreachAnimation({ onComplete }: { onComplete?: () => void }) {
  const [phase, setPhase] = useState(0)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 0)      // flash
    const t2 = setTimeout(() => setPhase(2), 400)    // glitch
    const t3 = setTimeout(() => setPhase(3), 900)    // shake + red fill
    const t4 = setTimeout(() => setPhase(4), 1800)   // text appears
    const t5 = setTimeout(() => setPhase(5), 2600)   // fade out
    const t6 = setTimeout(() => { onComplete?.() }, 3200)
    timeoutsRef.current = [t1, t2, t3, t4, t5, t6]
    return () => timeoutsRef.current.forEach(clearTimeout)
  }, [onComplete])

  if (phase === 0 || phase >= 5) return null

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      pointerEvents: "none",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {/* Red flash overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: phase === 1
          ? "rgba(255,34,68,0.4)"
          : phase === 2
            ? "rgba(255,34,68,0.15)"
            : phase === 3
              ? "rgba(255,34,68,0.25)"
              : "rgba(255,34,68,0.05)",
        transition: "background 0.3s",
        animation: phase === 3 ? "breach-flash 0.15s ease-in-out infinite" : "none",
      }} />

      {/* Scanlines */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "repeating-linear-gradient(0deg, rgba(255,34,68,0.08) 0px, rgba(255,34,68,0.08) 2px, transparent 2px, transparent 4px)",
        opacity: phase >= 2 ? 1 : 0,
        transition: "opacity 0.2s",
      }} />

      {/* Central text */}
      {phase >= 4 && (
        <div style={{
          textAlign: "center",
          animation: "fadeInUp 0.3s ease-out",
        }}>
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 8vw, 5rem)",
            fontWeight: 900,
            letterSpacing: "0.1em",
            color: "#ff2244",
            textTransform: "uppercase",
            textShadow: "0 0 40px #ff2244, 0 0 80px rgba(255,34,68,0.5)",
            lineHeight: 1,
          }}>
            WALL
          </div>
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 8vw, 5rem)",
            fontWeight: 900,
            letterSpacing: "0.1em",
            color: "#ff2244",
            textTransform: "uppercase",
            textShadow: "0 0 40px #ff2244, 0 0 80px rgba(255,34,68,0.5)",
            lineHeight: 1,
          }}>
            BREACHED
          </div>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.85rem",
            color: "rgba(255,34,68,0.7)",
            letterSpacing: "0.3em",
            marginTop: "1rem",
            textTransform: "uppercase",
          }}>
            THE BEARS HAVE CROSSED THE LINE
          </div>
        </div>
      )}

      {/* Corner glitch lines */}
      {phase >= 2 && (
        <>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "#ff2244", boxShadow: "0 0 12px #ff2244", animation: "breach-scan-h 0.3s linear" }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "#ff2244", boxShadow: "0 0 12px #ff2244", animation: "breach-scan-h 0.3s linear reverse" }} />
        </>
      )}
    </div>
  )
}

// ─── Deploy Animation (2500ms) ────────────────────────────────────────────────
export function DeployAnimation({ mcapUsd, onComplete }: { mcapUsd: number; onComplete?: () => void }) {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 0)      // scan lines appear
    const t2 = setTimeout(() => setPhase(2), 500)    // panels materialize
    const t3 = setTimeout(() => setPhase(3), 1200)   // text appears
    const t4 = setTimeout(() => setPhase(4), 2000)   // fade out
    const t5 = setTimeout(() => onComplete?.(), 2500)
    return () => [t1, t2, t3, t4, t5].forEach(clearTimeout)
  }, [onComplete])

  if (phase === 0 || phase >= 4) return null

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      pointerEvents: "none",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.75)",
      backdropFilter: "blur(2px)",
    }}>
      {/* Scan line sweeping down */}
      {phase === 1 && (
        <div style={{
          position: "absolute", left: 0, right: 0, height: 3,
          background: "linear-gradient(90deg, transparent, #00f5ff, transparent)",
          boxShadow: "0 0 20px #00f5ff",
          animation: "deploy-scan 0.5s linear",
        }} />
      )}

      {/* Grid materialization */}
      {phase >= 2 && (
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(rgba(0,245,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,245,255,0.05) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          animation: "fadeInUp 0.4s ease-out",
        }} />
      )}

      {/* Corner frames */}
      {phase >= 2 && (
        <>
          {[
            { top: "10%", left: "10%", borderWidth: "2px 0 0 2px" },
            { top: "10%", right: "10%", borderWidth: "2px 2px 0 0" },
            { bottom: "10%", left: "10%", borderWidth: "0 0 2px 2px" },
            { bottom: "10%", right: "10%", borderWidth: "0 2px 2px 0" },
          ].map((s, i) => (
            <div key={i} style={{
              position: "absolute", width: 60, height: 60,
              borderColor: "#00f5ff", borderStyle: "solid",
              boxShadow: "0 0 10px rgba(0,245,255,0.5)",
              animation: `fadeInUp 0.3s ease-out ${i * 0.05}s both`,
              ...s,
            }} />
          ))}
        </>
      )}

      {/* Central text */}
      {phase >= 3 && (
        <div style={{ textAlign: "center" }}>
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(1.5rem, 5vw, 3rem)",
            fontWeight: 900,
            letterSpacing: "0.12em",
            color: "#00f5ff",
            textTransform: "uppercase",
            textShadow: "0 0 30px #00f5ff",
            lineHeight: 1.2,
            animation: "fadeInUp 0.4s ease-out",
          }}>
            WALL DEPLOYED
          </div>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: "1.1rem",
            color: "rgba(0,245,255,0.8)",
            letterSpacing: "0.2em",
            marginTop: "0.75rem",
          }}>
            TARGET: ${(mcapUsd / 1_000_000).toFixed(2)}M MCAP
          </div>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.75rem",
            color: "rgba(0,245,255,0.5)",
            letterSpacing: "0.15em",
            marginTop: "0.5rem",
            textTransform: "uppercase",
          }}>
            Guardians — defend your positions
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Join Animation (800ms) ───────────────────────────────────────────────────
export function JoinAnimation({ isFirstGuardian, onComplete }: { isFirstGuardian?: boolean; onComplete?: () => void }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); onComplete?.() }, 800)
    return () => clearTimeout(t)
  }, [onComplete])

  if (!visible) return null

  return (
    <div style={{
      position: "fixed",
      bottom: "5rem",
      right: "2rem",
      zIndex: 8000,
      pointerEvents: "none",
    }}>
      {/* Pulse ring */}
      <div style={{
        position: "absolute",
        inset: -20,
        border: "2px solid #00f5ff",
        borderRadius: "50%",
        animation: "siege-pulse 0.8s ease-out forwards",
      }} />

      <div style={{
        background: "var(--bg-panel-alt)",
        border: "1px solid var(--glass-border-bright)",
        borderLeft: "3px solid #00f5ff",
        padding: "1rem 1.5rem",
        borderRadius: 2,
        boxShadow: "0 0 30px rgba(0,245,255,0.3)",
        animation: "fadeInUp 0.3s ease-out",
      }}>
        {isFirstGuardian ? (
          <>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.12em", color: "#00f5ff", textTransform: "uppercase" }}>
              FIRST GUARDIAN!
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 4 }}>
              Badge earned 🏅
            </div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.12em", color: "#00ff88", textTransform: "uppercase" }}>
              GUARDIAN JOINED
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 4 }}>
              Defending the wall
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Event Manager — central controller ──────────────────────────────────────
type EventType = "breach" | "deploy" | "join"

interface EventState {
  type: EventType
  mcapUsd?: number
  isFirstGuardian?: boolean
}

let globalTrigger: ((evt: EventState) => void) | null = null

export function triggerCitadelEvent(evt: EventState) {
  globalTrigger?.(evt)
}

export function CitadelEventOverlay() {
  const [event, setEvent] = useState<EventState | null>(null)

  useEffect(() => {
    globalTrigger = (evt) => setEvent(evt)
    return () => { globalTrigger = null }
  }, [])

  if (!event) return null

  const clear = () => setEvent(null)

  switch (event.type) {
    case "breach":
      return <BreachAnimation onComplete={clear} />
    case "deploy":
      return <DeployAnimation mcapUsd={event.mcapUsd ?? 0} onComplete={clear} />
    case "join":
      return <JoinAnimation isFirstGuardian={event.isFirstGuardian} onComplete={clear} />
    default:
      return null
  }
}
