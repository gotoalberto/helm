"use client"

import { useEffect } from "react"
import { musicEngine } from "@/lib/audio/musicEngine"

export function AudioInit() {
  useEffect(() => {
    const handler = () => {
      musicEngine.start().catch(() => {})
    }
    document.addEventListener("click", handler, { once: true })
    return () => document.removeEventListener("click", handler)
  }, [])

  return null
}
