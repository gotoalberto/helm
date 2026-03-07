"use client"

export type AlarmLayer = {
  start: () => void
  stop: () => void
  setActive: (active: boolean, integrity: number) => void
}

export async function createAlarmLayer(): Promise<AlarmLayer> {
  const Tone = await import("tone")

  const osc = new Tone.Oscillator({ frequency: 220, type: "sawtooth" })
  const lfo = new Tone.LFO({ frequency: 0.5, min: 180, max: 260 }).start()
  lfo.connect(osc.frequency)

  const distortion = new Tone.Distortion(0.8)
  const filter = new Tone.Filter({ frequency: 1200, type: "bandpass", Q: 3 })
  const gain = new Tone.Gain(0).toDestination()
  osc.chain(distortion, filter, gain)

  return {
    start: () => osc.start(),
    stop: () => osc.stop(),
    setActive: (active: boolean, integrity: number) => {
      if (active) {
        gain.gain.rampTo(0.08 * (1 - integrity), 1)
        lfo.frequency.value = 0.3 + (1 - integrity) * 0.7
      } else {
        gain.gain.rampTo(0, 2)
      }
    },
  }
}
