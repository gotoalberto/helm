"use client"

import type * as ToneType from "tone"

export type DroneLayer = {
  start: () => void
  stop: () => void
  setIntensity: (integrity: number) => void
}

export async function createDroneLayer(): Promise<DroneLayer> {
  const Tone = await import("tone")

  const osc1 = new Tone.Oscillator({ frequency: 55, type: "sawtooth" })
  const osc2 = new Tone.Oscillator({ frequency: 55.3, type: "sawtooth" })

  const filter = new Tone.Filter({ frequency: 200, type: "lowpass", rolloff: -24 })

  const filterLFO = new Tone.LFO({ frequency: 0.05, min: 80, max: 400 }).start()
  filterLFO.connect(filter.frequency)

  const reverb = new Tone.Reverb({ decay: 8, wet: 0.7 }).toDestination()
  const crusher = new Tone.BitCrusher({ bits: 6 }).connect(reverb)
  const gain = new Tone.Gain(0.15).connect(crusher)
  osc1.connect(gain)
  osc2.connect(gain)

  return {
    start: () => { osc1.start(); osc2.start() },
    stop: () => { osc1.stop(); osc2.stop() },
    setIntensity: (integrity: number) => {
      const freq = 55 + integrity * 20
      osc1.frequency.rampTo(freq, 2)
      osc2.frequency.rampTo(freq + 0.3, 2)
      filter.frequency.rampTo(80 + integrity * 200, 3)
    },
  }
}
