"use client"

export type PercussionLayer = {
  start: () => void
  stop: () => void
  setSiege: (isSiege: boolean) => void
  setVolume: (vol: number, rampTime?: number) => void
}

export async function createPercussionLayer(): Promise<PercussionLayer> {
  const Tone = await import("tone")

  Tone.getTransport().bpm.value = 90

  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.08,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.1 },
  })
  const kickDist = new Tone.Distortion(0.4)
  const kickGain = new Tone.Gain(0.6).toDestination()
  kick.chain(kickDist, kickGain)

  const hihat = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.05, release: 0.05 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
  })
  const hihatGain = new Tone.Gain(0.15).toDestination()
  hihat.connect(hihatGain)

  const snare = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 },
  })
  const snareFilter = new Tone.Filter({ frequency: 2000, type: "bandpass" })
  const snareGain = new Tone.Gain(0.25).toDestination()
  snare.chain(snareFilter, snareGain)

  const pattern = new Tone.Sequence(
    (time, step: number) => {
      if (step % 4 === 0) kick.triggerAttackRelease("C1", "8n", time)
      if (step % 4 === 2) snare.triggerAttackRelease("8n", time)
      if (step % 2 === 0) hihat.triggerAttackRelease("8n", time, 0.3)
      if (step % 2 === 1) hihat.triggerAttackRelease("16n", time, 0.15)
    },
    [0, 1, 2, 3, 4, 5, 6, 7],
    "8n"
  )

  return {
    start: () => { pattern.start(0); Tone.getTransport().start() },
    stop: () => pattern.stop(),
    setSiege: (isSiege: boolean) => {
      Tone.getTransport().bpm.rampTo(isSiege ? 120 : 90, 4)
    },
    setVolume: (vol: number, rampTime = 2) => {
      kickGain.gain.rampTo(vol * 0.6, rampTime)
      snareGain.gain.rampTo(vol * 0.25, rampTime)
      hihatGain.gain.rampTo(vol * 0.15, rampTime)
    },
  }
}
