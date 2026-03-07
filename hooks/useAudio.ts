"use client"

import { useCallback, useRef } from "react"
import { musicEngine } from "@/lib/audio/musicEngine"
import { SFX, isAudioSupported } from "@/lib/audio/sfx"
import type { WallState } from "@/lib/citadel/wallIntegrity"

export function useAudio() {
  const initialized = useRef(false)

  const init = useCallback(async () => {
    if (initialized.current || !isAudioSupported()) return
    initialized.current = true
    await musicEngine.start()
  }, [])

  const updateWallState = useCallback((state: WallState, integrity: number) => {
    musicEngine.updateState(state, integrity)
  }, [])

  const playBreach = useCallback(() => {
    musicEngine.playBreachMusic()
  }, [])

  const playDeploy = useCallback(() => {
    musicEngine.playDeployMusic()
  }, [])

  return {
    init,
    sfx: SFX,
    updateWallState,
    playBreach,
    playDeploy,
  }
}
