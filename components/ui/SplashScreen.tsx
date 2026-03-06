"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

export function SplashScreen() {
  const [visible, setVisible] = useState(true)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 1800)
    const hideTimer = setTimeout(() => setVisible(false), 2400)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      className="splash-screen"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#130C1A",
        backgroundImage: "radial-gradient(ellipse 70% 50% at 50% 30%, rgba(240, 230, 78, 0.08) 0%, transparent 60%)",
        opacity: fading ? 0 : 1,
        transition: "opacity 0.6s ease",
        pointerEvents: fading ? "none" : "all",
      }}
    >
      <style>{`
        @keyframes splash-bounce {
          0%, 100% { transform: translateY(0) scale(1); }
          40% { transform: translateY(-24px) scale(1.05); }
          60% { transform: translateY(-14px) scale(1.02); }
        }
        @keyframes splash-title-in {
          0% { opacity: 0; transform: scale(0.7) translateY(16px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes splash-sub-in {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes splash-dots {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
        .splash-avatar {
          animation: splash-bounce 1.2s ease-in-out infinite;
        }
        .splash-title {
          animation: splash-title-in 0.5s ease-out 0.2s both;
        }
        .splash-sub {
          animation: splash-sub-in 0.5s ease-out 0.5s both;
        }
        .splash-dot-1 { animation: splash-dots 0.8s ease-in-out 0.7s infinite; }
        .splash-dot-2 { animation: splash-dots 0.8s ease-in-out 0.9s infinite; }
        .splash-dot-3 { animation: splash-dots 0.8s ease-in-out 1.1s infinite; }
      `}</style>

      {/* Avatar bouncing */}
      <div className="splash-avatar mb-6" style={{ width: 140, height: 140, position: "relative" }}>
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: "50%",
            overflow: "hidden",
            border: "2px solid rgba(240,230,78,0.4)",
            boxShadow: "0 0 30px rgba(67,148,244,0.4)",
          }}
        >
          <Image
            src="/zeus-avatar.png"
            alt="ZEUS"
            width={140}
            height={140}
            className="object-cover w-full h-full"
            priority
          />
        </div>
      </div>

      {/* Title */}
      <div className="splash-title" style={{ textAlign: "center" }}>
        <div
          style={{
            fontFamily: "var(--font-titan-one)",
            fontSize: "clamp(3rem, 14vw, 5rem)",
            color: "#f0e64e",
            WebkitTextStroke: "2px rgba(240,230,78,0.3)",
            textShadow: "0 0 40px rgba(240,230,78,0.35), 0 0 80px rgba(240,230,78,0.15)",
            lineHeight: 1,
            letterSpacing: "0.05em",
          }}
        >
          ZEUS
        </div>
      </div>

      {/* Subtitle */}
      <div
        className="splash-sub mt-2"
        style={{
          fontFamily: "var(--font-titan-one)",
          fontSize: "clamp(0.9rem, 3vw, 1.2rem)",
          color: "#FFE600",
          WebkitTextStroke: "1.5px #000",
          textShadow: "2px 2px 0 #000",
          letterSpacing: "0.08em",
        }}
      >
        LIQUIDITY MANAGER
      </div>

      {/* Loading dots */}
      <div style={{ display: "flex", gap: 10, marginTop: 32 }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`splash-dot-${i}`}
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "var(--yellow)",
              boxShadow: "0 0 8px rgba(240,230,78,0.5)",
            }}
          />
        ))}
      </div>
    </div>
  )
}
