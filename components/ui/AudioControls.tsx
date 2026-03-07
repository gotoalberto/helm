"use client"

import { useState, useCallback } from "react"
import { musicEngine } from "@/lib/audio/musicEngine"

export function AudioControls() {
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(0.7)
  const [showSlider, setShowSlider] = useState(false)

  const toggleMute = useCallback(async () => {
    const next = !muted
    setMuted(next)
    await musicEngine.setMuted(next)
  }, [muted])

  const handleVolume = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    setVolume(val)
    await musicEngine.setVolume(val)
  }, [])

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: 24,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
      onMouseEnter={() => setShowSlider(true)}
      onMouseLeave={() => setShowSlider(false)}
    >
      <button
        onClick={toggleMute}
        title={muted ? "Unmute" : "Mute"}
        style={{
          width: 32,
          height: 32,
          background: "var(--bg-panel-alt)",
          border: "1px solid var(--glass-border-bright)",
          borderRadius: 2,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: muted ? "var(--text-dim)" : "var(--neon-cyan)",
          fontSize: "0.75rem",
          fontFamily: "var(--font-mono)",
          boxShadow: muted ? "none" : "0 0 8px rgba(0,245,255,0.2)",
          transition: "all 0.2s",
          clipPath: "polygon(15% 0%, 85% 0%, 100% 15%, 100% 85%, 85% 100%, 15% 100%, 0% 85%, 0% 15%)",
        }}
      >
        {muted ? "✕" : "♪"}
      </button>

      {showSlider && !muted && (
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={handleVolume}
          style={{
            width: 80,
            accentColor: "var(--neon-cyan)",
            opacity: 0.85,
          }}
        />
      )}
    </div>
  )
}
