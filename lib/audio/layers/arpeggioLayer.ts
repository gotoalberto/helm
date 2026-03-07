"use client"

export type ArpeggioLayer = {
  start: () => void
  stop: () => void
  fadeIn: (duration?: number) => void
  fadeOut: (duration?: number) => void
  setSiege: (isSiege: boolean) => void
}

const EM_SCALE = ["E2", "G2", "B2", "D3", "E3", "G3", "B3"]
const EM_PHRYGIAN = ["E2", "F2", "A2", "B2", "C3", "E3", "F3"]

export async function createArpeggioLayer(): Promise<ArpeggioLayer> {
  const Tone = await import("tone")

  const synth = new Tone.FMSynth({
    harmonicity: 3,
    modulationIndex: 10,
    oscillator: { type: "sine" },
    envelope: { attack: 0.01, decay: 0.5, sustain: 0.3, release: 1.5 },
    modulation: { type: "square" },
    modulationEnvelope: { attack: 0.2, decay: 0.4, sustain: 0.1, release: 0.5 },
  })

  const delay = new Tone.PingPongDelay({ delayTime: "8n", feedback: 0.4, wet: 0.3 })
  const reverb = new Tone.Reverb({ decay: 3, wet: 0.4 })
  const gain = new Tone.Gain(0).toDestination()
  synth.chain(delay, reverb, gain)

  const arp = new Tone.Pattern(
    (time, note) => {
      synth.triggerAttackRelease(note as string, "4n", time, 0.4)
    },
    EM_SCALE,
    "upDown"
  )
  arp.interval = "4n"

  return {
    start: () => { arp.start("+0.1") },
    stop: () => arp.stop(),
    fadeIn: (duration = 4) => { gain.gain.rampTo(0.2, duration) },
    fadeOut: (duration = 3) => { gain.gain.rampTo(0, duration) },
    setSiege: (isSiege: boolean) => {
      arp.values = isSiege ? EM_PHRYGIAN : EM_SCALE
      gain.gain.rampTo(isSiege ? 0.3 : 0.2, 2)
    },
  }
}
