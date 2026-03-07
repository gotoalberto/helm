"use client"

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.3,
  pitchEnd?: number
) {
  if (typeof window === "undefined") return
  try {
    const ac = new AudioContext()
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.connect(gain)
    gain.connect(ac.destination)

    osc.type = type
    osc.frequency.setValueAtTime(frequency, ac.currentTime)
    if (pitchEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(pitchEnd, 1),
        ac.currentTime + duration
      )
    }

    gain.gain.setValueAtTime(volume, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)

    osc.start(ac.currentTime)
    osc.stop(ac.currentTime + duration + 0.05)
    osc.onended = () => ac.close()
  } catch {
    // Silently ignore if audio context not available
  }
}

function playNoise(duration: number, filterFreq = 2000, volume = 0.2) {
  if (typeof window === "undefined") return
  try {
    const ac = new AudioContext()
    const bufferSize = Math.floor(ac.sampleRate * duration)
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

    const source = ac.createBufferSource()
    source.buffer = buffer

    const filter = ac.createBiquadFilter()
    filter.type = "bandpass"
    filter.frequency.value = filterFreq
    filter.Q.value = 2

    const gain = ac.createGain()
    gain.gain.setValueAtTime(volume, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(ac.destination)
    source.start()
    source.onended = () => ac.close()
  } catch {
    // Silently ignore
  }
}

export function playGlitchEffect(duration = 0.8) {
  if (typeof window === "undefined") return
  try {
    const ac = new AudioContext()
    const bufferSize = Math.floor(ac.sampleRate * duration)
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
    const data = buffer.getChannelData(0)

    const blockSize = Math.floor(ac.sampleRate * 0.02)
    for (let i = 0; i < bufferSize; i += blockSize) {
      const isGlitch = Math.random() > 0.5
      for (let j = i; j < Math.min(i + blockSize, bufferSize); j++) {
        data[j] = isGlitch ? (Math.random() * 2 - 1) * 1.5 : 0
      }
    }

    const source = ac.createBufferSource()
    source.buffer = buffer

    const distortion = ac.createWaveShaper()
    const curve = new Float32Array(256)
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 256 - 1
      curve[i] = Math.tanh(x * 10)
    }
    distortion.curve = curve

    const filter = ac.createBiquadFilter()
    filter.type = "bandpass"
    filter.frequency.value = 800
    filter.Q.value = 0.5

    const gain = ac.createGain()
    gain.gain.setValueAtTime(0.3, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)

    source.connect(distortion)
    distortion.connect(filter)
    filter.connect(gain)
    gain.connect(ac.destination)
    source.start()
    source.onended = () => ac.close()
  } catch {
    // Silently ignore
  }
}

export const SFX = {
  // ── WALL ──────────────────────────────────────────────────────────
  wallDeploy: () => {
    playTone(120, 0.5, "sawtooth", 0.4, 800)
    setTimeout(() => playNoise(0.3, 3000, 0.3), 400)
    setTimeout(() => playTone(880, 0.8, "triangle", 0.3, 440), 500)
  },

  wallImpact: () => {
    playTone(200, 0.15, "sawtooth", 0.2, 80)
    playNoise(0.08, 4000, 0.15)
  },

  wallCrack: () => {
    playNoise(0.4, 1500, 0.4)
    playTone(100, 0.6, "sawtooth", 0.3, 30)
    setTimeout(() => playNoise(0.2, 800, 0.2), 200)
  },

  wallCritical: () => {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        playTone(880, 0.12, "square", 0.3)
        setTimeout(() => playTone(660, 0.12, "square", 0.25), 150)
      }, i * 400)
    }
  },

  wallBreach: () => {
    playNoise(1.5, 500, 0.8)
    playTone(220, 2, "sawtooth", 0.6, 20)
    setTimeout(() => playNoise(0.5, 200, 0.5), 50)
    playTone(60, 1.5, "sine", 0.7, 20)
    setTimeout(() => playTone(3000, 0.8, "square", 0.2, 100), 200)
  },

  // ── GUARDIANS ─────────────────────────────────────────────────────
  guardianJoin: () => {
    const notes = [440, 554, 659]
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.3, "triangle", 0.25), i * 80)
    })
  },

  firstGuardianUnlock: () => {
    const notes = [330, 415, 494, 659, 830]
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.6, "triangle", 0.3 - i * 0.04), i * 100)
    })
    setTimeout(() => playTone(880, 1.5, "sine", 0.2, 660), 600)
  },

  badgeUnlocked: () => {
    playTone(660, 0.2, "triangle", 0.25)
    setTimeout(() => playTone(880, 0.4, "triangle", 0.2), 120)
    setTimeout(() => playTone(1100, 0.6, "triangle", 0.15), 240)
  },

  transactionPending: () => {
    playTone(440, 0.15, "sine", 0.15)
  },

  transactionConfirmed: () => {
    playTone(550, 0.1, "triangle", 0.3)
    setTimeout(() => playTone(660, 0.1, "triangle", 0.25), 100)
    setTimeout(() => playTone(880, 0.3, "triangle", 0.2), 200)
  },

  transactionFailed: () => {
    playTone(220, 0.4, "sawtooth", 0.3, 110)
    setTimeout(() => playTone(165, 0.5, "sawtooth", 0.25, 82), 300)
  },

  // ── UI ────────────────────────────────────────────────────────────
  buttonHover: () => playTone(800, 0.05, "sine", 0.08),

  buttonClick: () => {
    playTone(600, 0.08, "square", 0.15)
    playNoise(0.05, 8000, 0.08)
  },

  modalOpen: () => {
    playTone(300, 0.2, "triangle", 0.1, 500)
    setTimeout(() => playTone(500, 0.15, "triangle", 0.08), 100)
  },

  modalClose: () => playTone(500, 0.2, "triangle", 0.1, 300),

  sectionEnter: () => playTone(220, 0.1, "sine", 0.05),

  walletConnected: () => {
    playTone(440, 0.15, "triangle", 0.2)
    setTimeout(() => playTone(550, 0.15, "triangle", 0.15), 150)
    setTimeout(() => playTone(660, 0.3, "triangle", 0.1), 300)
  },

  copy: () => playTone(1200, 0.06, "sine", 0.1),

  // ── ADMIN ─────────────────────────────────────────────────────────
  adminDeploy: () => {
    playTone(150, 0.3, "sawtooth", 0.4, 600)
    setTimeout(() => SFX.wallDeploy(), 300)
  },

  adminDemolish: () => {
    playTone(300, 0.5, "sawtooth", 0.3, 100)
    playNoise(0.4, 1000, 0.25)
  },

  adminLogin: () => {
    playTone(400, 0.2, "square", 0.2)
    setTimeout(() => playTone(600, 0.3, "triangle", 0.15), 200)
  },

  adminLoginFail: () => {
    playTone(200, 0.3, "square", 0.3, 150)
    setTimeout(() => playNoise(0.2, 500, 0.2), 200)
  },

  // ── SIEGE ─────────────────────────────────────────────────────────
  siegeStart: () => {
    playTone(55, 1.5, "sawtooth", 0.4, 45)
    setTimeout(() => SFX.wallCritical(), 500)
  },

  siegeEnd: () => {
    playTone(220, 0.8, "triangle", 0.25, 440)
    setTimeout(() => playTone(330, 0.6, "triangle", 0.15, 550), 300)
  },
}

export function isAudioSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    (typeof AudioContext !== "undefined" ||
      typeof (window as { webkitAudioContext?: unknown }).webkitAudioContext !== "undefined")
  )
}
