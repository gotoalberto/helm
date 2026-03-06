"use client"

import { useState, useEffect } from "react"

export type GPUTier = "low" | "medium" | "high" | "unknown"

export function useGPUTier(): GPUTier {
  const [tier, setTier] = useState<GPUTier>("unknown")

  useEffect(() => {
    async function detect() {
      try {
        // Check canvas webgl support
        const canvas = document.createElement("canvas")
        const gl = canvas.getContext("webgl2") || canvas.getContext("webgl")
        if (!gl) {
          setTier("low")
          return
        }

        // Check renderer string
        const ext = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info")
        if (ext) {
          const renderer = (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_RENDERER_WEBGL) as string
          const isLowGPU = /swiftshader|softpipe|llvmpipe|intel hd|intel(r) hd/i.test(renderer)
          setTier(isLowGPU ? "low" : "high")
        } else {
          setTier("medium")
        }
      } catch {
        setTier("medium")
      }
    }
    detect()
  }, [])

  return tier
}
