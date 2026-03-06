# CITADEL PROTOCOL — Audio Design Document
## Sonidos, Música y Banda Sonora del Juego
### Version 1.0

---

## Filosofía de Audio

**Todo el audio se genera proceduralmente en el browser.** No hay archivos de audio.
Cero KB de descarga de samples. Todo es síntesis en tiempo real usando Web Audio API.

Esto es posible y además tiene ventajas enormes para este juego:
- La música **reacciona en tiempo real** al estado de la muralla
- Los sonidos **mutan** cuando el precio se acerca
- El silencio **también es diseño**: cuando la muralla cae, todo se apaga durante 2 segundos
- **Sin derechos de autor**, sin licencias, sin assets externos

La estética sonora es **cyberpunk industrial**: drones oscuros, synths metálicos,
percusión electrónica, glitches digitales, alarmas de ciencia ficción.

---

## Stack de Audio

### Librerías

| Librería | Rol | Por qué |
|---|---|---|
| **[Tone.js](https://tonejs.github.io/)** | Síntesis musical, banda sonora generativa, acordes, arpeggios | Motor de composición con synths, efectos, secuenciador, scheduling preciso |
| **[Howler.js](https://howlerjs.com/)** | NO SE USA — todo es síntesis | (mencionado para contexto, pero preferimos síntesis pura) |
| **Web Audio API nativa** | SFX puntuales (explosiones, glitches, impactos) | Para sonidos que son más rápidos de programar directamente que con Tone.js |

### Por qué solo Tone.js + Web Audio API nativa

- **Tone.js** (198K weekly downloads, 14K GitHub stars) es el estándar para síntesis web.
  Tiene synths listos (MembraneSynth, MetalSynth, FMSynth, AMSynth, PolySynth),
  efectos (Reverb, Delay, Distortion, Chorus, Phaser, BitCrusher),
  y un Transport para sincronizar todo con BPM.
- **Web Audio API** nativa para SFX instantáneos (un oscillator + gain + close en 200ms)
  sin overhead de Tone.js para casos simples.

### Instalación

```bash
npm install tone
# Tone.js incluye TypeScript types nativamente
# Tamaño: ~120KB gzip ~40KB — carga lazy solo cuando el usuario interactúa
```

### Carga lazy (OBLIGATORIO — política del browser)

El Web Audio API requiere un gesto del usuario antes de reproducir audio.
```typescript
// lib/audio/audioEngine.ts
let initialized = false

export async function initAudio() {
  if (initialized) return
  await Tone.start()  // requiere haber sido llamado desde un click/touch
  initialized = true
  startAmbientMusic()
}

// Se llama en:
// - Click en "Connect Wallet"
// - Click en "JOIN THE CITADEL"
// - Click en cualquier botón principal
```

---

## PARTE 1: BANDA SONORA GENERATIVA

La música es un loop generativo infinito que nunca se repite exactamente.
Tres capas que se activan/desactivan y mutan según el estado del juego.

### 1.1 Capa Base — DRONE (siempre activa)

Un pad oscuro y profundo que siempre está presente.
Genera la sensación de estar en un mundo digital oscuro.

```typescript
// lib/audio/layers/droneLayer.ts
import * as Tone from 'tone'

export function createDroneLayer() {
  // Dos oscillators desafinados ligeramente entre sí (chorus natural)
  const osc1 = new Tone.Oscillator({ frequency: 55, type: 'sawtooth' })
  const osc2 = new Tone.Oscillator({ frequency: 55.3, type: 'sawtooth' })  // +0.3Hz detuning

  // Filtro paso-bajo que respira lentamente
  const filter = new Tone.Filter({
    frequency: 200,
    type: 'lowpass',
    rolloff: -24
  })

  // LFO que modula el filtro (respiración del drone)
  const filterLFO = new Tone.LFO({
    frequency: '0.05',  // 1 ciclo cada 20 segundos
    min: 80,
    max: 400
  }).start()
  filterLFO.connect(filter.frequency)

  // Reverb enorme (sensación de espacio infinito)
  const reverb = new Tone.Reverb({ decay: 8, wet: 0.7 }).toDestination()

  // BitCrusher para el efecto digital/glitchy
  const crusher = new Tone.BitCrusher({ bits: 6 }).connect(reverb)

  const gain = new Tone.Gain(0.15).connect(crusher)
  osc1.connect(gain)
  osc2.connect(gain)

  return {
    start: () => { osc1.start(); osc2.start() },
    stop: () => { osc1.stop(); osc2.stop() },
    // Muta la frecuencia base según el estado del juego
    setIntensity: (integrity: number) => {
      // A menor integridad, el drone baja de pitch (más grave = más tenso)
      const freq = 55 + integrity * 20  // 55Hz (fallen) → 75Hz (impenetrable)
      osc1.frequency.rampTo(freq, 2)
      osc2.frequency.rampTo(freq + 0.3, 2)
      // El filtro también baja (más oscuro)
      filter.frequency.rampTo(80 + integrity * 200, 3)
    }
  }
}
```

### 1.2 Capa Rítmica — INDUSTRIAL PERCUSSION (activa cuando hay muralla)

Percusión electrónica industrial. Kick metálico + hi-hat glitchy + snare digital.

```typescript
// lib/audio/layers/percussionLayer.ts
import * as Tone from 'tone'

export function createPercussionLayer() {
  // BPM base: 90 (lento, tenso)
  // En siege: aumenta a 120
  Tone.getTransport().bpm.value = 90

  // KICK — membrana + pitch drop (sonido industrial)
  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.08,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.1 }
  })
  const kickDist = new Tone.Distortion(0.4)
  const kickGain = new Tone.Gain(0.6).toDestination()
  kick.chain(kickDist, kickGain)

  // METALLIC HI-HAT
  const hihat = new Tone.MetalSynth({
    frequency: 800,
    envelope: { attack: 0.001, decay: 0.05, release: 0.05 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5
  })
  const hihatGain = new Tone.Gain(0.15).toDestination()
  hihat.connect(hihatGain)

  // SNARE DIGITAL
  const snare = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 }
  })
  const snareFilter = new Tone.Filter({ frequency: 2000, type: 'bandpass' })
  const snareGain = new Tone.Gain(0.25).toDestination()
  snare.chain(snareFilter, snareGain)

  // Patrón 4/4 básico
  // Kick: 1 y 3
  // Snare: 2 y 4
  // Hihat: todos los 8vos
  const pattern = new Tone.Sequence(
    (time, step) => {
      if (step % 4 === 0) kick.triggerAttackRelease('C1', '8n', time)
      if (step % 4 === 2) snare.triggerAttackRelease('8n', time)
      if (step % 2 === 0) hihat.triggerAttackRelease('8n', time, 0.3)
      if (step % 2 === 1) hihat.triggerAttackRelease('16n', time, 0.15)  // ghost
    },
    [0, 1, 2, 3, 4, 5, 6, 7],
    '8n'
  )

  return {
    start: () => { pattern.start(0); Tone.getTransport().start() },
    stop: () => pattern.stop(),
    // Aumenta BPM en siege (urgencia)
    setSiege: (isSiege: boolean) => {
      Tone.getTransport().bpm.rampTo(isSiege ? 120 : 90, 4)
    },
    // Silencia/activa la percusión
    setVolume: (vol: number, rampTime = 2) => {
      kickGain.gain.rampTo(vol * 0.6, rampTime)
      snareGain.gain.rampTo(vol * 0.25, rampTime)
      hihatGain.gain.rampTo(vol * 0.15, rampTime)
    }
  }
}
```

### 1.3 Capa Melódica — SYNTH ARPEGGIO (activa cuando muralla intacta/besieged)

Un arpegio lento y cyberpunk sobre escala menor. Recuerda a Blade Runner.

```typescript
// lib/audio/layers/arpeggioLayer.ts
import * as Tone from 'tone'

// Escala: E menor (Em) — oscura, épica
const EM_SCALE = ['E2', 'G2', 'B2', 'D3', 'E3', 'G3', 'B3']
// Variante más tensa para siege
const EM_PHRYGIAN = ['E2', 'F2', 'A2', 'B2', 'C3', 'E3', 'F3']

export function createArpeggioLayer() {
  // FM Synth — carácter metálico/electrónico
  const synth = new Tone.FMSynth({
    harmonicity: 3,
    modulationIndex: 10,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.5, sustain: 0.3, release: 1.5 },
    modulation: { type: 'square' },
    modulationEnvelope: { attack: 0.2, decay: 0.4, sustain: 0.1, release: 0.5 }
  })

  const delay = new Tone.PingPongDelay({ delayTime: '8n', feedback: 0.4, wet: 0.3 })
  const reverb = new Tone.Reverb({ decay: 3, wet: 0.4 })
  const gain = new Tone.Gain(0).toDestination()  // empieza en silencio (fade in)
  synth.chain(delay, reverb, gain)

  let currentScale = EM_SCALE
  let stepIndex = 0

  // Patrón de arpegio: cada nota del acorde en secuencia
  const arp = new Tone.Pattern(
    (time, note) => {
      synth.triggerAttackRelease(note, '4n', time, 0.4)
    },
    EM_SCALE,
    'upDown'
  )
  arp.interval = '4n'

  return {
    start: () => { arp.start('+0.1') },
    stop: () => arp.stop(),
    fadeIn: (duration = 4) => { gain.gain.rampTo(0.2, duration) },
    fadeOut: (duration = 3) => { gain.gain.rampTo(0, duration) },
    setSiege: (isSiege: boolean) => {
      // En siege: escala más tensa, tempo más rápido, más intensidad
      arp.values = isSiege ? EM_PHRYGIAN : EM_SCALE
      gain.gain.rampTo(isSiege ? 0.3 : 0.2, 2)
    }
  }
}
```

### 1.4 Capa de Tensión — ALARM DRONE (solo en critical/siege)

Solo se activa cuando la integridad < 45%. Un zumbido de alarma industrial.

```typescript
// lib/audio/layers/alarmLayer.ts
import * as Tone from 'tone'

export function createAlarmLayer() {
  // Oscilador de alarma — sube y baja de pitch (sirena)
  const osc = new Tone.Oscillator({ frequency: 220, type: 'sawtooth' })
  const lfo = new Tone.LFO({ frequency: 0.5, min: 180, max: 260 }).start()
  lfo.connect(osc.frequency)

  const distortion = new Tone.Distortion(0.8)
  const filter = new Tone.Filter({ frequency: 1200, type: 'bandpass', Q: 3 })
  const gain = new Tone.Gain(0).toDestination()
  osc.chain(distortion, filter, gain)

  return {
    start: () => osc.start(),
    stop: () => osc.stop(),
    // Activa/desactiva con fade
    setActive: (active: boolean, integrity: number) => {
      if (active) {
        gain.gain.rampTo(0.08 * (1 - integrity), 1)  // más fuerte cuanto menos integridad
        lfo.frequency.value = 0.3 + (1 - integrity) * 0.7  // más rápido en critical
      } else {
        gain.gain.rampTo(0, 2)
      }
    }
  }
}
```

### 1.5 Music Engine — el controlador central

```typescript
// lib/audio/musicEngine.ts
import * as Tone from 'tone'
import { createDroneLayer } from './layers/droneLayer'
import { createPercussionLayer } from './layers/percussionLayer'
import { createArpeggioLayer } from './layers/arpeggioLayer'
import { createAlarmLayer } from './layers/alarmLayer'
import type { WallState } from '@/lib/citadel/wallIntegrity'

class MusicEngine {
  private drone = createDroneLayer()
  private perc = createPercussionLayer()
  private arp = createArpeggioLayer()
  private alarm = createAlarmLayer()
  private started = false

  async start() {
    if (this.started) return
    await Tone.start()
    this.drone.start()
    this.perc.start()
    this.arp.start()
    this.alarm.start()
    this.started = true
  }

  // Llamado cada vez que cambia el estado de la muralla
  updateState(state: WallState, integrity: number) {
    const isSiege = state === 'besieged' || state === 'crumbling' || state === 'critical'

    // Drone: siempre activo, muta con integridad
    this.drone.setIntensity(integrity / 100)

    // Percusión
    if (state === 'none') {
      this.perc.setVolume(0, 3)  // fade out suave
    } else {
      this.perc.setVolume(1, 2)
      this.perc.setSiege(isSiege)
    }

    // Arpegio: activo cuando hay muralla, se apaga en fallen
    if (state === 'fallen' || state === 'none') {
      this.arp.fadeOut(3)
    } else if (state === 'impenetrable') {
      this.arp.fadeIn(4)
      this.arp.setSiege(false)
    } else {
      this.arp.fadeIn(2)
      this.arp.setSiege(isSiege)
    }

    // Alarma: solo en crumbling/critical
    this.alarm.setActive(state === 'crumbling' || state === 'critical', integrity / 100)
  }

  // Momento exacto del BREACH
  playBreachMusic() {
    // Todo se silencia bruscamente durante 1.5s
    this.perc.setVolume(0, 0.1)
    this.arp.fadeOut(0.3)
    this.alarm.setActive(false, 0)

    // Luego: drone se mantiene, más grave, más oscuro
    setTimeout(() => {
      this.drone.setIntensity(0)
      this.playBreachStinger()
    }, 1500)
  }

  private playBreachStinger() {
    // Un "stinger" de derrota: acorde menor descendente
    const synth = new Tone.PolySynth(Tone.Synth).toDestination()
    const reverb = new Tone.Reverb({ decay: 6, wet: 0.8 }).toDestination()
    synth.connect(reverb)
    synth.set({ envelope: { attack: 0.1, decay: 2, sustain: 0.3, release: 3 } })
    // Acorde Dm7b5 descendente (sonido de derrota)
    synth.triggerAttackRelease(['D3', 'F3', 'Ab3', 'C4'], '2n', Tone.now(), 0.5)
    synth.triggerAttackRelease(['D2', 'F2', 'Ab2', 'C3'], '2n', Tone.now() + 0.3, 0.3)
  }

  // Momento del DEPLOY de nueva muralla
  playDeployMusic() {
    // Stinger de victoria: arpegio ascendente brillante
    const synth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 1 }
    })
    const delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.3 }).toDestination()
    synth.connect(delay)

    // E mayor ascendente (hopeful, nuevo comienzo)
    const notes = ['E4', 'G#4', 'B4', 'E5', 'G#5', 'B5']
    notes.forEach((note, i) => {
      synth.triggerAttackRelease(note, '8n', Tone.now() + i * 0.15, 0.6 - i * 0.07)
    })

    // Retomar música tras 2s
    setTimeout(() => this.updateState('impenetrable', 100), 2000)
  }
}

export const musicEngine = new MusicEngine()
```

---

## PARTE 2: EFECTOS DE SONIDO (SFX)

Todos los SFX son síntesis pura via Web Audio API nativa.
Sin archivos. Sin samples. Todo generado en < 5 líneas de código.

### 2.1 Función helper base

```typescript
// lib/audio/sfx.ts

const ctx = () => new AudioContext()

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.3,
  pitchEnd?: number
) {
  const ac = new AudioContext()
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.connect(gain)
  gain.connect(ac.destination)

  osc.type = type
  osc.frequency.setValueAtTime(frequency, ac.currentTime)
  if (pitchEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(pitchEnd, ac.currentTime + duration)
  }

  gain.gain.setValueAtTime(volume, ac.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)

  osc.start(ac.currentTime)
  osc.stop(ac.currentTime + duration + 0.1)
  return ac
}

function playNoise(duration: number, filterFreq = 2000, volume = 0.2) {
  const ac = new AudioContext()
  const bufferSize = ac.sampleRate * duration
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

  const source = ac.createBufferSource()
  source.buffer = buffer

  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = filterFreq
  filter.Q.value = 2

  const gain = ac.createGain()
  gain.gain.setValueAtTime(volume, ac.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(ac.destination)
  source.start()
  return ac
}
```

### 2.2 Catálogo completo de SFX

```typescript
// lib/audio/sfx.ts (continuación)

export const SFX = {

  // ── MURALLA / WALL ────────────────────────────────────────────────

  // Cuando se despliega una nueva muralla (constructive, hopeful)
  wallDeploy: () => {
    // Sweep ascendente + impacto
    playTone(120, 0.5, 'sawtooth', 0.4, 800)
    setTimeout(() => playNoise(0.3, 3000, 0.3), 400)
    setTimeout(() => playTone(880, 0.8, 'triangle', 0.3, 440), 500)
  },

  // Impacto en la muralla (cuando un swap de venta pasa por el tick)
  wallImpact: () => {
    // Click metálico rápido
    playTone(200, 0.15, 'sawtooth', 0.2, 80)
    playNoise(0.08, 4000, 0.15)
  },

  // La muralla se fisura (bajar de threshold: besieged → crumbling)
  wallCrack: () => {
    // Crack + crujido
    playNoise(0.4, 1500, 0.4)
    playTone(100, 0.6, 'sawtooth', 0.3, 30)
    setTimeout(() => playNoise(0.2, 800, 0.2), 200)
  },

  // Estado crítico (<20%) — alarma digital
  wallCritical: () => {
    // Beep de alarma repetido
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        playTone(880, 0.12, 'square', 0.3)
        setTimeout(() => playTone(660, 0.12, 'square', 0.25), 150)
      }, i * 400)
    }
  },

  // BREACH — la muralla cae. El SFX más épico del juego.
  wallBreach: () => {
    // 1. EXPLOSION: burst de ruido
    playNoise(1.5, 500, 0.8)

    // 2. PITCH DROP: tono descendente profundo (0ms)
    playTone(220, 2, 'sawtooth', 0.6, 20)

    // 3. DISTORSION burst (50ms)
    setTimeout(() => playNoise(0.5, 200, 0.5), 50)

    // 4. Sub bass slam (100ms)
    playTone(60, 1.5, 'sine', 0.7, 20)

    // 5. High frequency shatter (200ms)
    setTimeout(() => playTone(3000, 0.8, 'square', 0.2, 100), 200)

    // 6. Silence... (el musicEngine corta todo durante 1.5s)
  },

  // ── GUARDIANS / ACCIONES ─────────────────────────────────────────

  // Guardian se une a la muralla
  guardianJoin: () => {
    // Confirmación positiva: tonos ascendentes
    const notes = [440, 554, 659]
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.3, 'triangle', 0.25), i * 80)
    })
  },

  // FIRST GUARDIAN badge unlocked (más épico)
  firstGuardianUnlock: () => {
    // Fanfarria corta: arpeggio + reverb largo
    const notes = [330, 415, 494, 659, 830]
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.6, 'triangle', 0.3 - i * 0.04), i * 100)
    })
    setTimeout(() => playTone(880, 1.5, 'sine', 0.2, 660), 600)
  },

  // Badge desbloqueado (cualquier badge)
  badgeUnlocked: () => {
    playTone(660, 0.2, 'triangle', 0.25)
    setTimeout(() => playTone(880, 0.4, 'triangle', 0.2), 120)
    setTimeout(() => playTone(1100, 0.6, 'triangle', 0.15), 240)
  },

  // Approve de token (transacción en curso)
  transactionPending: () => {
    // Pulso periódico mientras espera
    playTone(440, 0.15, 'sine', 0.15)
  },

  // Transacción confirmada on-chain
  transactionConfirmed: () => {
    playTone(550, 0.1, 'triangle', 0.3)
    setTimeout(() => playTone(660, 0.1, 'triangle', 0.25), 100)
    setTimeout(() => playTone(880, 0.3, 'triangle', 0.2), 200)
  },

  // Error / rechazado
  transactionFailed: () => {
    playTone(220, 0.4, 'sawtooth', 0.3, 110)
    setTimeout(() => playTone(165, 0.5, 'sawtooth', 0.25, 82), 300)
  },

  // ── UI ────────────────────────────────────────────────────────────

  // Hover en botón principal
  buttonHover: () => playTone(800, 0.05, 'sine', 0.08),

  // Click en botón
  buttonClick: () => {
    playTone(600, 0.08, 'square', 0.15)
    playNoise(0.05, 8000, 0.08)
  },

  // Abrir modal
  modalOpen: () => {
    playTone(300, 0.2, 'triangle', 0.1, 500)
    setTimeout(() => playTone(500, 0.15, 'triangle', 0.08), 100)
  },

  // Cerrar modal
  modalClose: () => playTone(500, 0.2, 'triangle', 0.1, 300),

  // Scroll (muy sutil, cada sección)
  sectionEnter: () => playTone(220, 0.1, 'sine', 0.05),

  // Wallet conectada
  walletConnected: () => {
    playTone(440, 0.15, 'triangle', 0.2)
    setTimeout(() => playTone(550, 0.15, 'triangle', 0.15), 150)
    setTimeout(() => playTone(660, 0.3, 'triangle', 0.1), 300)
  },

  // Copiar address al portapapeles
  copy: () => playTone(1200, 0.06, 'sine', 0.1),

  // ── ADMIN ─────────────────────────────────────────────────────────

  // Deploy wall desde admin
  adminDeploy: () => {
    playTone(150, 0.3, 'sawtooth', 0.4, 600)
    setTimeout(() => SFX.wallDeploy(), 300)
  },

  // Demolish wall desde admin
  adminDemolish: () => {
    playTone(300, 0.5, 'sawtooth', 0.3, 100)
    playNoise(0.4, 1000, 0.25)
  },

  // Login admin correcto
  adminLogin: () => {
    playTone(400, 0.2, 'square', 0.2)
    setTimeout(() => playTone(600, 0.3, 'triangle', 0.15), 200)
  },

  // Password incorrecta
  adminLoginFail: () => {
    playTone(200, 0.3, 'square', 0.3, 150)
    setTimeout(() => playNoise(0.2, 500, 0.2), 200)
  },

  // ── SIEGE ─────────────────────────────────────────────────────────

  // Precio entra en zona de siege (< 5% de la muralla)
  siegeStart: () => {
    playTone(55, 1.5, 'sawtooth', 0.4, 45)
    setTimeout(() => SFX.wallCritical(), 500)
  },

  // Precio se aleja (sale de siege mode)
  siegeEnd: () => {
    playTone(220, 0.8, 'triangle', 0.25, 440)
    setTimeout(() => playTone(330, 0.6, 'triangle', 0.15, 550), 300)
  }
}
```

### 2.3 Glitch digital SFX (efectos especiales)

Cuando ocurre el breach, además del SFX de impacto hay un efecto de
"glitch de datos" puro: ruido digital, distorsión extrema.

```typescript
// lib/audio/sfx.ts (continuación)

export function playGlitchEffect(duration = 0.8) {
  const ac = new AudioContext()

  // Buffer de ruido random
  const bufferSize = Math.floor(ac.sampleRate * duration)
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
  const data = buffer.getChannelData(0)

  // Glitch: bloques de silencio y saturación alternados
  let blockSize = Math.floor(ac.sampleRate * 0.02)  // bloques de 20ms
  for (let i = 0; i < bufferSize; i += blockSize) {
    const isGlitch = Math.random() > 0.5
    for (let j = i; j < Math.min(i + blockSize, bufferSize); j++) {
      data[j] = isGlitch ? (Math.random() * 2 - 1) * 1.5 : 0  // saturación o silencio
    }
  }

  const source = ac.createBufferSource()
  source.buffer = buffer

  const distortion = ac.createWaveShaper()
  // Curva de distorsión extrema
  const curve = new Float32Array(256)
  for (let i = 0; i < 256; i++) {
    const x = i * 2 / 256 - 1
    curve[i] = Math.tanh(x * 10)  // hard clip
  }
  distortion.curve = curve

  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
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
}
```

---

## PARTE 3: INTEGRACIÓN CON EL JUEGO

### 3.1 Hook centralizado — useAudio

```typescript
// hooks/useAudio.ts
import { useEffect, useRef, useCallback } from 'react'
import { musicEngine } from '@/lib/audio/musicEngine'
import { SFX } from '@/lib/audio/sfx'

export function useAudio() {
  const initialized = useRef(false)

  // Inicializar audio en el primer gesto del usuario
  const init = useCallback(async () => {
    if (initialized.current) return
    await musicEngine.start()
    initialized.current = true
  }, [])

  return {
    init,
    sfx: SFX,
    updateWallState: musicEngine.updateState.bind(musicEngine),
    playBreach: musicEngine.playBreachMusic.bind(musicEngine),
    playDeploy: musicEngine.playDeployMusic.bind(musicEngine),
  }
}
```

### 3.2 Integración con useCitadelWall

```typescript
// hooks/useCitadelWall.ts (modificado)
import { useAudio } from './useAudio'

export function useCitadelWall() {
  const { updateWallState, playBreach, playDeploy } = useAudio()
  const prevState = useRef<WallState | null>(null)

  const query = useQuery({
    queryKey: ['citadel-wall'],
    queryFn: fetchWall,
    refetchInterval: 30_000,
    onSuccess: (data) => {
      // Detectar cambios de estado y disparar audio
      if (prevState.current !== null) {
        if (prevState.current !== 'fallen' && data.state === 'fallen') {
          playBreach()  // ← BREACH detectado
        }
        if (prevState.current === 'fallen' && data.state === 'impenetrable') {
          playDeploy()  // ← Nueva muralla desplegada
        }
        if (prevState.current !== 'besieged' && data.is_siege) {
          SFX.siegeStart()
        }
      }
      updateWallState(data.state, data.integrity)
      prevState.current = data.state
    }
  })
  return query
}
```

### 3.3 Dónde se llama cada SFX

| Evento | SFX | Dónde se dispara |
|---|---|---|
| Hover en botones principales | `SFX.buttonHover()` | `onMouseEnter` en `.btn-primary` |
| Click en cualquier botón | `SFX.buttonClick()` | `onClick` global |
| Abrir modal | `SFX.modalOpen()` | Al mostrar cualquier modal |
| Wallet conectada | `SFX.walletConnected()` | `onConnect` de wagmi |
| Approve ZEUS | `SFX.transactionPending()` | Mientras la tx está pending |
| Join confirmado | `SFX.transactionConfirmed()` + `SFX.guardianJoin()` | On tx success |
| First Guardian | `SFX.firstGuardianUnlock()` | Cuando is_first_guardian=true |
| Badge cualquiera | `SFX.badgeUnlocked()` | Cuando se detecta badge nuevo |
| Siege detectado | `SFX.siegeStart()` | Al cambiar is_siege true |
| Impacto en muro | `SFX.wallImpact()` | Simulado cada ~10s si hay siege (random) |
| Bajar a crumbling | `SFX.wallCrack()` | Al detectar cambio a state='crumbling' |
| Bajar a critical | `SFX.wallCritical()` + alarma | Al detectar state='critical' |
| BREACH | `SFX.wallBreach()` + glitch | Al detectar state='fallen' |
| Nueva muralla | (parte del musicEngine.playDeployMusic) | Al detectar nueva muralla |
| Admin login | `SFX.adminLogin()` | On auth success |
| Admin deploy | `SFX.adminDeploy()` | On POST /api/citadel/wall success |
| Admin demolish | `SFX.adminDemolish()` | On DELETE success |
| Copiar address | `SFX.copy()` | OnClick en address truncada |

### 3.4 Control de volumen por el usuario

```typescript
// components/ui/AudioControls.tsx
// Botón flotante en esquina inferior izquierda

function AudioControls() {
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(0.7)

  return (
    <div className="audio-controls">
      <button onClick={() => setMuted(!muted)}>
        {muted ? <MutedIcon /> : <SoundIcon />}
      </button>
      {/* Slider de volumen (aparece al hover) */}
      <input
        type="range" min={0} max={1} step={0.05}
        value={volume}
        onChange={(e) => {
          setVolume(Number(e.target.value))
          Tone.getDestination().volume.rampTo(
            Tone.gainToDb(Number(e.target.value)), 0.1
          )
        }}
      />
    </div>
  )
}
```

Posición: `position: fixed, bottom: 24px, left: 24px, z-index: 100`
Estética: botón hex pequeño (32px), neon cyan, con glow pulsante si hay música activa.

---

## PARTE 4: ESTADOS MUSICALES — MAPA COMPLETO

```
ESTADO DEL JUEGO          MÚSICA                    SFX ESPECIALES
─────────────────────────────────────────────────────────────────────
none (sin muralla)    │ Drone solo, muy suave     │ —
                      │ Percusión OFF             │
                      │ Arpegio OFF               │
                      │ BPM: 60                   │
─────────────────────────────────────────────────────────────────────
impenetrable          │ Drone + Arpegio           │ wallDeploy (al entrar)
(integrity 90-100%)   │ Percusión suave           │
                      │ BPM: 90, tono Em          │
─────────────────────────────────────────────────────────────────────
besieged              │ Drone + Arpegio + más perc│ siegeStart (al entrar)
(integrity 70-89%)    │ BPM: 95, escala tensa     │ wallImpact (periódico)
─────────────────────────────────────────────────────────────────────
crumbling             │ Todo más intenso          │ wallCrack (al entrar)
(integrity 45-69%)    │ BPM: 110, alarma baja     │ wallImpact (frecuente)
                      │ Arpegio más acelerado     │
─────────────────────────────────────────────────────────────────────
critical              │ Percusión urgente         │ wallCritical (al entrar)
(integrity 20-44%)    │ BPM: 120, alarma alta     │ wallImpact (muy frecuente)
                      │ Arpegio al max            │ wallCrack (periódico)
─────────────────────────────────────────────────────────────────────
fallen (breach)       │ TODO SE SILENCIA 1.5s     │ wallBreach() (ÉPICO)
                      │ Luego: stinger de derrota │ playGlitchEffect()
                      │ Drone grave, solo         │
─────────────────────────────────────────────────────────────────────
deploy (nueva muralla)│ Stinger ascendente        │ wallDeploy (+ adminDeploy)
                      │ Transición a impenetrable │
─────────────────────────────────────────────────────────────────────
```

---

## PARTE 5: NOTAS TÉCNICAS IMPORTANTES

### 5.1 Política de autoplay del browser

**El audio solo puede empezar después de un gesto del usuario.**
Implementación:

```typescript
// En el primer click en CUALQUIER lugar de la página
document.addEventListener('click', async () => {
  await musicEngine.start()
}, { once: true })

// Adicionalmente: en el onClick de botones específicos
// para asegurar que funciona en todos los browsers
```

### 5.2 Performance

- Tone.js se carga **lazy** (dynamic import) solo tras el primer gesto
- Los SFX simples usan Web Audio API nativa (sin esperar a Tone.js)
- Cada SFX crea su propio AudioContext y lo cierra inmediatamente
- La música generativa usa un solo AudioContext persistente
- Overhead de CPU: ~2-5% en desktop, ~5-8% en mobile

### 5.3 Fallback si Web Audio no está disponible

```typescript
export function isAudioSupported(): boolean {
  return typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined'
}

// Si no hay soporte: todas las funciones de audio son no-ops silenciosos
```

### 5.4 Dependencia en package.json

```json
{
  "dependencies": {
    "tone": "^15.0.4"
  }
}
```

Tone.js 15.x es la versión más reciente (2024). ESM nativo, tree-shakeable.
Con tree-shaking, solo los synths que se usen entran en el bundle final.
Estimado bundle: ~45KB gzip con los synths que usamos.

---

## RESUMEN DEL SISTEMA DE AUDIO

| Aspecto | Decisión | Por qué |
|---|---|---|
| **Motor de música** | Tone.js 15 | Synths, effects, scheduling, el estándar de facto |
| **SFX** | Web Audio API nativa | Más rápido, sin overhead para sonidos simples |
| **Samples/archivos** | NINGUNO | Síntesis pura, 0 KB de audio descargado |
| **Carga** | Lazy tras primer gesto | Obligatorio por política de browsers |
| **Música** | Generativa, 4 capas | Se adapta al estado del juego en tiempo real |
| **Tonalidad** | E menor / E frigio | Oscura, tensa, cyberpunk (como Blade Runner) |
| **BPM** | 90 → 120 en siege | La urgencia se siente en el ritmo |
| **SFX únicos** | 20 sonidos distintos | Cada acción del juego tiene su feedback |
| **Control usuario** | Botón mute + volumen | En esquina inferior izquierda, siempre visible |

---

*CITADEL PROTOCOL — Audio Design Document v1.0*
*Stack: Tone.js + Web Audio API nativa. Sin samples. Síntesis pura.*
*Referencias: [Tone.js](https://tonejs.github.io/) · [Howler.js](https://howlerjs.com/) · [Web Audio API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)*
