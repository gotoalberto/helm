"use client"

import type { WallState } from "@/lib/citadel/wallIntegrity"
// WallState: "INTACT" | "SIEGE" | "CRITICAL" | "FALLEN" | "NO_WALL"
import type { DroneLayer } from "./layers/droneLayer"
import type { PercussionLayer } from "./layers/percussionLayer"
import type { ArpeggioLayer } from "./layers/arpeggioLayer"
import type { AlarmLayer } from "./layers/alarmLayer"

class MusicEngine {
  private drone: DroneLayer | null = null
  private perc: PercussionLayer | null = null
  private arp: ArpeggioLayer | null = null
  private alarm: AlarmLayer | null = null
  private started = false
  private muted = false
  private masterVolume = 0.7

  async start() {
    if (this.started) return
    const Tone = await import("tone")
    await Tone.start()

    const [
      { createDroneLayer },
      { createPercussionLayer },
      { createArpeggioLayer },
      { createAlarmLayer },
    ] = await Promise.all([
      import("./layers/droneLayer"),
      import("./layers/percussionLayer"),
      import("./layers/arpeggioLayer"),
      import("./layers/alarmLayer"),
    ])

    this.drone = await createDroneLayer()
    this.perc = await createPercussionLayer()
    this.arp = await createArpeggioLayer()
    this.alarm = await createAlarmLayer()

    this.drone.start()
    this.perc.start()
    this.arp.start()
    this.alarm.start()

    Tone.getDestination().volume.value = Tone.gainToDb(this.masterVolume)
    this.started = true
  }

  updateState(state: WallState, integrity: number) {
    if (!this.started) return
    const isSiege = state === "SIEGE" || state === "CRITICAL"

    this.drone?.setIntensity(integrity / 100)

    if (state === "NO_WALL") {
      this.perc?.setVolume(0, 3)
    } else {
      this.perc?.setVolume(1, 2)
      this.perc?.setSiege(isSiege)
    }

    if (state === "FALLEN" || state === "NO_WALL") {
      this.arp?.fadeOut(3)
    } else if (state === "INTACT") {
      this.arp?.fadeIn(4)
      this.arp?.setSiege(false)
    } else {
      this.arp?.fadeIn(2)
      this.arp?.setSiege(isSiege)
    }

    this.alarm?.setActive(state === "CRITICAL", integrity / 100)
  }

  playBreachMusic() {
    if (!this.started) return
    this.perc?.setVolume(0, 0.1)
    this.arp?.fadeOut(0.3)
    this.alarm?.setActive(false, 0)

    setTimeout(async () => {
      this.drone?.setIntensity(0)
      await this.playBreachStinger()
    }, 1500)
  }

  private async playBreachStinger() {
    const Tone = await import("tone")
    const synth = new Tone.PolySynth(Tone.Synth).toDestination()
    const reverb = new Tone.Reverb({ decay: 6, wet: 0.8 }).toDestination()
    synth.connect(reverb)
    synth.set({ envelope: { attack: 0.1, decay: 2, sustain: 0.3, release: 3 } })
    synth.triggerAttackRelease(["D3", "F3", "Ab3", "C4"], "2n", Tone.now(), 0.5)
    synth.triggerAttackRelease(["D2", "F2", "Ab2", "C3"], "2n", Tone.now() + 0.3, 0.3)
  }

  async playDeployMusic() {
    if (!this.started) return
    const Tone = await import("tone")
    const synth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 1 },
    })
    const delay = new Tone.FeedbackDelay({ delayTime: "8n", feedback: 0.3 }).toDestination()
    synth.connect(delay)

    const notes = ["E4", "G#4", "B4", "E5", "G#5", "B5"]
    notes.forEach((note, i) => {
      synth.triggerAttackRelease(note, "8n", Tone.now() + i * 0.15, 0.6 - i * 0.07)
    })

    setTimeout(() => this.updateState("INTACT", 100), 2000)
  }

  async setMuted(muted: boolean) {
    this.muted = muted
    const Tone = await import("tone")
    Tone.getDestination().mute = muted
  }

  async setVolume(vol: number) {
    this.masterVolume = vol
    const Tone = await import("tone")
    Tone.getDestination().volume.rampTo(Tone.gainToDb(vol), 0.1)
  }

  isStarted() {
    return this.started
  }
}

export const musicEngine = new MusicEngine()
