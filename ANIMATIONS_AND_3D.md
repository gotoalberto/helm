# CITADEL PROTOCOL — Animaciones, Efectos Visuales y 3D
# Guia tecnica completa de experiencia visual

---

## TABLA DE CONTENIDOS

1. [Filosofia Visual](#1-filosofia-visual)
2. [WebGL — Escena 3D Central](#2-webgl--escena-3d-central)
3. [Animaciones CSS — Sistema Completo](#3-animaciones-css--sistema-completo)
4. [Efectos por Seccion](#4-efectos-por-seccion)
5. [Animaciones de Estado de la Muralla](#5-animaciones-de-estado-de-la-muralla)
6. [Efectos de Evento (Breach, Join, Deploy)](#6-efectos-de-evento-breach-join-deploy)
7. [Particulas y Sistemas de Particulas](#7-particulas-y-sistemas-de-particulas)
8. [Transiciones entre Paginas](#8-transiciones-entre-paginas)
9. [Performance y Fallbacks](#9-performance-y-fallbacks)
10. [Librerias y Dependencias](#10-librerias-y-dependencias)

---

## 1. FILOSOFIA VISUAL

**Regla de oro:** Cada animacion tiene que tener un proposito narrativo.
No hay decoracion vacia. Cada efecto visual cuenta algo del estado del juego:

- **Cyan brillante y fluido** = la muralla esta intacta, el poder fluye
- **Cyan parpadeante y roto** = la muralla esta bajo ataque
- **Rojo y shake** = danger critico, la muralla esta cayendo
- **Ceniza y estatico** = la muralla ha caido, derrota
- **Oro y destello** = fees ganadas, victoria, recompensa

**Capas de animacion (de menos a mas costoso):**
```
Layer 1: CSS transforms/opacity     -> siempre activo, 0 costo GPU
Layer 2: CSS filters y gradientes   -> activo, costo bajo
Layer 3: Canvas 2D / particles      -> activo si no WebGL
Layer 4: Three.js / WebGL           -> activo si GPU disponible
```

---

## 2. WEBGL — ESCENA 3D CENTRAL

### 2.1 La Muralla 3D (componente estrella)

**Libreria:** Three.js (via `@react-three/fiber` + `@react-three/drei`)

**Concepto:** La imagen 2D de la muralla se reemplaza por una escena 3D interactiva
donde el usuario puede ver la muralla desde un angulo ligeramente isometrico.
La camara hace un leve auto-orbit (muy lento) para dar sensacion de profundidad.

**Geometria base de la muralla:**
```
- Una serie de paneles rectangulares (BoxGeometry) apilados
- Materiales: MeshStandardMaterial con emissive map
- Textura de circuito (procedurial via shader)
- Cada panel tiene su propia animacion de "energia" fluyendo
```

**Shader de energia en los paneles (GLSL):**
```glsl
// Fragment shader para el efecto de lineas de energia cyan
uniform float uTime;
uniform float uIntegrity;  // 0.0 - 1.0
uniform vec3 uColor;

varying vec2 vUv;

float grid(vec2 uv, float res) {
  vec2 grid = fract(uv * res);
  return step(0.95, max(grid.x, grid.y));
}

void main() {
  // Grid base
  float g = grid(vUv, 8.0);

  // Lineas de energia que fluyen hacia arriba
  float energy = sin(vUv.y * 20.0 - uTime * 3.0) * 0.5 + 0.5;
  energy *= sin(vUv.x * 15.0 + uTime * 1.5) * 0.5 + 0.5;
  energy = pow(energy, 4.0);

  // Color base segun integridad
  vec3 color = mix(vec3(1.0, 0.1, 0.1), vec3(0.0, 0.96, 1.0), uIntegrity);

  // Combinar
  float brightness = g * 0.3 + energy * 0.7 * uIntegrity;
  gl_FragColor = vec4(color * brightness, brightness * 0.8 + 0.1);
}
```

**Estados 3D de la muralla segun integridad:**

```typescript
// IMPENETRABLE (integrity >= 90%)
// - Todos los paneles intactos en posicion
// - Energia cyan fluyendo suavemente
// - Escudo holograma girando encima (IcosahedronGeometry wireframe)
// - Particulas de energia ascendiendo por los laterales

// BESIEGED (70-89%)
// - 2-3 paneles ligeramente desplazados (pequenas rotaciones random)
// - Energia cyan con parpadeos ocasionales
// - Algunas particulas de "chispa" (SparkParticles)
// - Escudo con glitches (opacity parpadea)

// CRUMBLING (45-69%)
// - 5-6 paneles con fracturas (PlaneGeometry con ShapeGeometry de grietas)
// - Energia naranja/roja mezclada con cyan
// - Debris de escombros cayendo (particulas con gravedad)
// - Humo (ShaderMaterial custom, volumetrico fake)

// CRITICAL (20-44%)
// - Mitad de los paneles caidos o muy inclinados
// - Luz roja dominante, cyan casi ausente
// - Mucho debris
// - Camara tiembla (camera.position jitter)
// - Explosiones pequenas periodicas (sprite flash)

// FALLEN (0-19%)
// - Solo escombros en el suelo (paneles con rotaciones extremas)
// - Sin energia, sin cyan
// - Luz de emergencia roja y fria
// - Humo denso
// - Lluvia de ceniza (particles blancas/grises cayendo)
```

**Codigo base del componente React Three Fiber:**
```tsx
// components/citadel/CitadelWall3D.tsx
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { useRef } from 'react'

function WallPanel({ position, integrity, index }) {
  const meshRef = useRef()
  // Animacion de panel segun integrity
  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    if (integrity < 0.7) {
      // Shake sutil en paneles danados
      meshRef.current.rotation.z = Math.sin(t * 2 + index) * 0.02 * (1 - integrity)
      meshRef.current.position.y = position[1] + Math.sin(t * 3 + index) * 0.02
    }
  })
  return <mesh ref={meshRef} position={position}>...</mesh>
}

function EnergyShield({ integrity }) {
  const shieldRef = useRef()
  useFrame((state) => {
    shieldRef.current.rotation.y += 0.005
    shieldRef.current.rotation.x = Math.sin(state.clock.getElapsedTime()) * 0.1
    // Glitch de opacidad cuando integrity < 0.7
    if (integrity < 0.7) {
      const glitch = Math.random() > 0.98 ? 0 : 1
      shieldRef.current.material.opacity = integrity * 0.5 * glitch
    }
  })
  return (
    <mesh ref={shieldRef}>
      <icosahedronGeometry args={[1.5, 1]} />
      <meshBasicMaterial wireframe color="#00f5ff" opacity={integrity * 0.5} transparent />
    </mesh>
  )
}

export function CitadelWall3D({ integrity, state }) {
  return (
    <Canvas camera={{ position: [0, 2, 8], fov: 45 }}>
      <ambientLight intensity={0.2} />
      <pointLight position={[0, 5, 5]} color="#00f5ff" intensity={integrity * 2} />
      <pointLight position={[-5, 0, 2]} color="#ff00aa" intensity={(1-integrity) * 1.5} />
      {/* Paneles de la muralla */}
      {WALL_PANELS.map((p, i) => <WallPanel key={i} {...p} integrity={integrity} index={i} />)}
      {/* Escudo holograma (solo si integrity > 0.5) */}
      {integrity > 0.5 && <EnergyShield integrity={integrity} />}
      {/* Particulas */}
      <EnergyParticles integrity={integrity} />
      <DebrisParticles integrity={integrity} />
      {/* Post-processing */}
      <EffectComposer>
        <Bloom luminanceThreshold={0.3} intensity={integrity * 1.5} />
        <ChromaticAberration offset={[(1-integrity)*0.003, (1-integrity)*0.003]} />
      </EffectComposer>
    </Canvas>
  )
}
```

**Post-processing con @react-three/postprocessing:**
- `Bloom`: hace que las luces neon brillen y se "desbordan" — mas intenso cuanto mas intacta esta la muralla
- `ChromaticAberration`: aberracion cromatica (desplazamiento RGB) — se activa cuando la muralla esta bajo ataque
- `Scanline` (custom): lineas de scanline sobre el render 3D para integrar con el resto de la UI
- `Glitch` (postprocessing effect): cuando integrity < 0.3, glitches visuales aleatorios cada pocos segundos

### 2.2 Fondo WebGL del Hero — Data Storm

**Concepto:** El fondo del hero no es solo la imagen `hero-bg.png`.
Sobre ella hay una escena Three.js de fondo con:

**Columnas de datos cayendo (3D Data Rain):**
```
- 200 instancias de Text (via troika-three-text o InstancedMesh)
- Caracteres hex (0-9, A-F) en columnas
- Caen de arriba a abajo en diferentes velocidades
- Color: cyan #00f5ff al 40% opacity
- Se repiten cuando llegan al fondo
```

**Particles de "bits" flotantes:**
```
- 500 particulas pequenas (PointsMaterial)
- Movimiento browniano suave
- Color cyan con variaciones
- Las cercanas al cursor se "repelen" levemente
```

**Grid horizontal flotante:**
```
- PlaneGeometry con GridHelper
- Flota ligeramente animado con sin/cos
- Color cyan muy tenue (10% opacity)
- Da sensacion de estar en un espacio digital infinito
```

### 2.3 Bears Attack — Animacion de Ataque

Cuando `distance_pct < 5%` (siege mode), aparece en la escena 3D:

**Concepto:** Figuras oscuras (silhouettes) avanzando desde el fondo hacia la muralla.

```
- 20-30 instancias de CapsuleGeometry (figuras humanas abstractas)
- Color negro con borde rojo glow (emissive rojo)
- Avanzan desde Z=-20 hasta Z=0 en loop infinito
- Velocity proporcional al damage (mas rapidos cuanto mas daño hacen)
- Al "colisionar" con la muralla: explosion de particulas rojas
- En estado FALLEN: las figuras pasan al otro lado, victoria para los bears
```

---

## 3. ANIMACIONES CSS — SISTEMA COMPLETO

### 3.1 Scanlines (toda la pagina)

```css
/* En el :root del html, overlay fijo */
body::after {
  content: '';
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0px,
    transparent 3px,
    rgba(0, 245, 255, 0.012) 3px,
    rgba(0, 245, 255, 0.012) 4px
  );
  pointer-events: none;
  z-index: 9998;
}
```

### 3.2 Glitch Text (titulo hero)

```css
.glitch-text {
  position: relative;
}

.glitch-text::before,
.glitch-text::after {
  content: attr(data-text);  /* data-text="CITADEL PROTOCOL" */
  position: absolute;
  top: 0; left: 0;
  width: 100%;
  height: 100%;
}

.glitch-text::before {
  color: #ff00aa;
  animation: glitch-1 4s infinite;
  clip-path: polygon(0 0, 100% 0, 100% 35%, 0 35%);
  transform: translate(-3px, 0);
}

.glitch-text::after {
  color: #00f5ff;
  animation: glitch-2 4s infinite;
  clip-path: polygon(0 65%, 100% 65%, 100% 100%, 0 100%);
  transform: translate(3px, 0);
}

@keyframes glitch-1 {
  0%, 90%, 100% { transform: translate(-3px, 0); opacity: 0; }
  91%           { transform: translate(-3px, 0); opacity: 0.8; }
  92%           { transform: translate(3px, -2px); opacity: 0.8; }
  93%           { transform: translate(-5px, 1px); opacity: 0; }
  94%           { transform: translate(-3px, 0); opacity: 0.8; }
  95%           { transform: translate(0, 0); opacity: 0; }
}

@keyframes glitch-2 {
  0%, 93%, 100% { transform: translate(3px, 0); opacity: 0; }
  94%           { transform: translate(3px, 0); opacity: 0.8; }
  95%           { transform: translate(-3px, 2px); opacity: 0.8; }
  96%           { transform: translate(5px, -1px); opacity: 0; }
  97%           { transform: translate(3px, 0); opacity: 0.8; }
  98%           { transform: translate(0, 0); opacity: 0; }
}
```

Se dispara tambien manualmente (via JS) cuando ocurren eventos: breach, join, deploy.

### 3.3 Neon Pulse (elementos activos)

```css
/* Para la muralla activa intacta */
@keyframes neon-pulse-cyan {
  0%, 100% {
    box-shadow: 0 0 5px #00f5ff, 0 0 10px #00f5ff, 0 0 20px rgba(0,245,255,0.3);
  }
  50% {
    box-shadow: 0 0 10px #00f5ff, 0 0 25px #00f5ff, 0 0 50px rgba(0,245,255,0.5);
  }
}

/* Para el siege mode (rojo) */
@keyframes neon-pulse-red {
  0%, 100% {
    box-shadow: 0 0 5px #ff2244, 0 0 10px #ff2244, inset 0 0 10px rgba(255,34,68,0.1);
  }
  50% {
    box-shadow: 0 0 15px #ff2244, 0 0 35px #ff2244, inset 0 0 20px rgba(255,34,68,0.2);
  }
}

.panel-active    { animation: neon-pulse-cyan 3s ease-in-out infinite; }
.panel-siege     { animation: neon-pulse-red 1.5s ease-in-out infinite; }
.panel-critical  { animation: neon-pulse-red 0.8s ease-in-out infinite; }
```

### 3.4 Wall Shake (estado critical)

```css
@keyframes wall-shake-critical {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  8%  { transform: translate(-2px, -1px) rotate(-0.2deg); }
  16% { transform: translate(2px, 1px) rotate(0.2deg); }
  24% { transform: translate(-1px, 2px) rotate(-0.15deg); }
  32% { transform: translate(2px, -2px) rotate(0.15deg); }
  40% { transform: translate(-3px, 0px) rotate(-0.3deg); }
  48% { transform: translate(1px, 1px) rotate(0.1deg); }
  56% { transform: translate(-1px, -2px) rotate(-0.1deg); }
  64% { transform: translate(3px, 0px) rotate(0.3deg); }
  72% { transform: translate(-2px, 2px) rotate(-0.2deg); }
  80% { transform: translate(2px, -1px) rotate(0.2deg); }
  88% { transform: translate(-1px, 1px) rotate(-0.1deg); }
}

/* La imagen del muro 2D cuando integrity < 25% */
.wall-image-critical {
  animation: wall-shake-critical 0.6s ease-in-out infinite;
}
```

### 3.5 Data Rain CSS (fallback sin WebGL)

```css
.data-rain {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.data-rain-column {
  position: absolute;
  top: -100%;
  width: 14px;
  color: #00f5ff;
  font-family: 'Share Tech Mono', monospace;
  font-size: 12px;
  line-height: 14px;
  opacity: 0.35;
  animation: rain-fall linear infinite;
  text-shadow: 0 0 4px #00f5ff;
}

@keyframes rain-fall {
  0%   { transform: translateY(-100%); }
  100% { transform: translateY(200vh); }
}

/* 40 columnas, generadas con JS, diferentes duraciones (3s-8s) y delays */
/* El JS genera los caracteres hex y los inserta como texto */
```

```typescript
// components/citadel/DataRain.tsx
const CHARS = '0123456789ABCDEF'
const COLS = 40

function DataRain() {
  return (
    <div className="data-rain">
      {Array.from({length: COLS}, (_, i) => (
        <div
          key={i}
          className="data-rain-column"
          style={{
            left: `${(i / COLS) * 100}%`,
            animationDuration: `${3 + Math.random() * 5}s`,
            animationDelay: `${-Math.random() * 8}s`,
            opacity: 0.1 + Math.random() * 0.3,
          }}
        >
          {Array.from({length: 20}, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('\n')}
        </div>
      ))}
    </div>
  )
}
```

### 3.6 Health Bar Animada

```css
.health-bar-track {
  width: 100%;
  height: 8px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(0,245,255,0.15);
  border-radius: 0;  /* anguloso, cyberpunk */
  overflow: hidden;
  position: relative;
}

.health-bar-fill {
  height: 100%;
  transition: width 1s ease-in-out, background-color 0.5s;
  position: relative;
}

/* Gradiente segun integridad (via CSS variable --integrity: 0-100) */
.health-bar-fill[data-state="impenetrable"] {
  background: linear-gradient(90deg, #00f5ff, #00ffcc);
  box-shadow: 0 0 8px #00f5ff, 0 0 20px rgba(0,245,255,0.4);
}
.health-bar-fill[data-state="besieged"] {
  background: linear-gradient(90deg, #00c8cc, #00f5ff);
  animation: bar-flicker 2s ease-in-out infinite;
}
.health-bar-fill[data-state="crumbling"] {
  background: linear-gradient(90deg, #ff8800, #ffcc00);
  animation: bar-flicker 1s ease-in-out infinite;
}
.health-bar-fill[data-state="critical"] {
  background: linear-gradient(90deg, #ff2244, #ff6600);
  animation: bar-flicker 0.4s ease-in-out infinite;
}
.health-bar-fill[data-state="fallen"] {
  background: rgba(100,100,100,0.3);
}

/* Barra de scan que corre por encima */
.health-bar-fill::after {
  content: '';
  position: absolute;
  top: 0; bottom: 0;
  width: 40px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  animation: bar-scan 2s linear infinite;
}

@keyframes bar-scan {
  0%   { left: -40px; }
  100% { left: 100%; }
}

@keyframes bar-flicker {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.75; }
}
```

### 3.7 Counter / Numero animado (MCAP, fees, etc.)

```typescript
// hook useAnimatedCounter
function useAnimatedCounter(target: number, duration = 800) {
  const [current, setCurrent] = useState(target)
  const prev = useRef(target)

  useEffect(() => {
    if (prev.current === target) return
    const start = prev.current
    const startTime = performance.now()
    const animate = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)  // ease-out cubic
      setCurrent(start + (target - start) * eased)
      if (t < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
    prev.current = target
  }, [target, duration])

  return current
}

// Uso: <span>{formatMcap(useAnimatedCounter(currentMcap))}</span>
// Cuando el MCAP cambia, el numero cuenta suavemente hasta el nuevo valor
```

### 3.8 Badge reveal animation

Cuando se gana un badge nuevo (tras join, tras breach):

```css
@keyframes badge-reveal {
  0%   { transform: scale(0) rotate(-180deg); opacity: 0; filter: blur(20px); }
  50%  { transform: scale(1.3) rotate(10deg); opacity: 0.8; filter: blur(2px); }
  70%  { transform: scale(0.9) rotate(-5deg); opacity: 1; filter: blur(0); }
  85%  { transform: scale(1.05) rotate(2deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; filter: blur(0); }
}

.badge-new {
  animation: badge-reveal 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}
```

### 3.9 Toast de eventos especiales

Los toasts normales (sonner) se usan para confirmaciones standard.
Para eventos especiales del juego se usan custom toasts con animaciones:

```tsx
// FIRST GUARDIAN toast
<div className="toast-epic">
  <img src="/badge-first-guardian.png" className="badge-new" />
  <div>
    <p className="toast-title">FIRST GUARDIAN</p>
    <p className="toast-subtitle">You are the first to reinforce Battle #8</p>
  </div>
</div>

// Animacion del toast en si: entra desde la derecha con efecto de "static"
@keyframes toast-enter {
  0%   { transform: translateX(120%) skewX(-5deg); opacity: 0; filter: brightness(3); }
  30%  { transform: translateX(-5%) skewX(2deg); opacity: 1; filter: brightness(1.5); }
  60%  { transform: translateX(2%) skewX(-1deg); filter: brightness(1); }
  100% { transform: translateX(0) skewX(0deg); opacity: 1; filter: brightness(1); }
}
```

---

## 4. EFECTOS POR SECCION

### 4.1 Header (sticky)

```
Efecto base:
- Fondo: rgba(3,5,15,0.85) + backdrop-filter: blur(20px) + saturate(180%)
- Border-bottom: 1px solid rgba(0,245,255,0.1)

Animaciones:
- Al hacer scroll hacia abajo: el header "comprime" ligeramente (height: 60px -> 48px en 200ms)
- Aparece una linea de progreso cyan debajo del header proporcional al scroll de la pagina
- El logo tiene un neon-pulse muy suave (3s infinite, amplitude baja)

Interacciones:
- Boton wallet conectado: borde cyan pulsante suave si hay muralla activa
- Boton wallet: si la batalla esta en siege, el borde parpadea en rojo
```

### 4.2 Hero Section

```
Capas (de atras a adelante):

Layer 0 (estatico): hero-bg.png como background-image con background-attachment: fixed (parallax)
Layer 1 (WebGL): Three.js canvas con data storm + grid flotante
Layer 2 (CSS): DataRain component (fallback o adicional)
Layer 3 (CSS): Scanlines overlay
Layer 4 (HTML): Contenido textual con animaciones CSS

Animaciones del contenido:
- Logo: fadeInDown 0.8s en carga, luego glitch ocasional
- Tagline: typewriter effect — los caracteres aparecen uno a uno al cargar (100ms por char)
- MCAP pill: numero con counter animation, parpadeo verde/rojo al subir/bajar
- Stats bar: slideInUp 0.6s con delay 0.3s
- Botones: fadeInUp 0.5s con delay 0.6s
```

### 4.3 Active Battle Section

```
Transicion de entrada (cuando la pagina carga):
- El panel entra desde abajo: translateY(40px) -> 0, opacity 0 -> 1, 0.6s

Estado IMPENETRABLE:
- La escena 3D rota lentamente (auto-orbit 0.2deg/s)
- Particulas de energia ascienden por los bordes del canvas
- Borde del panel: neon-pulse-cyan suave
- Stats: numeros con ligero shimmer effect

Estado BESIEGED:
- Escena 3D: camara hace leve "breathe" (zoom in/out muy sutil)
- Borde del panel: neon-pulse-red 1.5s
- Ticker de actividad: scrolls texto de swaps detectados
- Stats: "DISTANCE" parpadeando en naranja

Estado CRUMBLING:
- Escena 3D: shader empieza a mostrar naranjas y rojos, debris cae
- Borde del panel: neon-pulse-red 0.8s + box-shadow intenso
- Wall image 2D (fallback): ligero shake
- "CRUMBLING ⚠" texto con glitch ocasional

Estado CRITICAL:
- Escena 3D: camara tiembla, mucho debris, luces rojas
- Borde del panel: neon-pulse-red 0.3s (muy rapido, urgente)
- Wall image 2D: wall-shake-critical animation continua
- "CRITICAL ⚠" texto con glitch frecuente
- Flash rojo cada 3s (el fondo del panel hace flash rojo rapido)
- Texto "BREACH IMMINENT" aparece/desaparece con blink animation

Estado FALLEN:
- Escena 3D: fade out de la muralla, fade in de ruinas
- Flash rojo brillante durante 500ms al momento de la caida
- Glitch intenso en todo el panel durante 800ms
- Imagen 2D: wall-0.png con overlay rojo + texto "BREACHED"
- Particulas de escombros cayendo (CSS animation)
- El texto del Battle Report aparece con un fade in de 1s
```

### 4.4 War Room

```
Entrada de las filas:
- Cada fila entra con slideInRight con delays escalonados (0ms, 80ms, 160ms...)

Actualizacion (cuando un Guardian nuevo entra):
- La nueva fila aparece con badge-reveal animation de fondo cyan
- Las filas existentes se reordenan con transicion de height

El Guardian conectado:
- Su fila tiene borde cyan suave y fondo ligeramente mas brillante
- Tiny "YOU" badge pulsante al lado del address

Fees en tiempo real:
- Los numeros de fees cambian con counter animation cuando se actualizan
- Un pequeño "+" en verde aparece brevemente junto al numero al incrementar
```

### 4.5 Join Form

```
Estado idle (no conectado):
- El formulario tiene un overlay sutil con "CONNECT WALLET TO DEPLOY"
- El fondo tiene un patrón de grid animado que pulsa lentamente

Al conectar wallet:
- Overlay se retira con fade out 0.4s
- Los campos aparecen con slideInUp escalonado

Al escribir cantidad:
- Preview section se actualiza con fade (opacity 0.4 -> 1)
- El numero de USD tiene counter animation
- La barra de "tu contribucion" en el War Room se previsualiza

Al hacer click en JOIN:
- Boton tiene loading state: spinner + "Deploying..."
- Si es aprobacion: texto "Approving ZEUS..."
- Si es mint: texto "Building the Wall..."
- Al exito: el boton se convierte en checkmark verde durante 2s
- Luego: scroll automatico suave al War Room donde aparece el usuario
```

---

## 5. ANIMACIONES DE ESTADO DE LA MURALLA

### 5.1 Transicion INTACTA -> BESIEGED

```
Trigger: distance_pct baja de 5%

Secuencia (800ms total):
1. 0ms:    flash sutil de color naranja en el borde del panel
2. 100ms:  aparece texto "⚠ SIEGE INCOMING" desde arriba (slideInDown)
3. 200ms:  el borde del panel cambia de cyan a naranja (transition 0.3s)
4. 400ms:  neon-pulse-red empieza
5. 500ms:  en la escena 3D: las bears empiezan a aparecer
6. 600ms:  el ticker de actividad aparece en la parte inferior
7. 800ms:  estado completamente establecido
```

### 5.2 Transicion de Integridad (cada update de 30s)

```
Trigger: integridad baja de un threshold

Si cruza 70% (besieged -> crumbling):
- La imagen del muro hace un "impact shake" de 300ms
- Flash naranja rapido
- La health bar cambia de color (cyan -> naranja) con transition 0.5s
- Texto del estado cambia con fade: "BESIEGED" -> "CRUMBLING"
- En 3D: se activan los shaders de grietas, debris empieza a caer

Si cruza 45% (crumbling -> critical):
- Impact shake mas intenso (500ms)
- Flash rojo
- Se activa la animacion de shake continuo de la imagen
- En 3D: camara empieza a temblar levemente

Si cruza 20% (critical -> fallen threshold):
- Shake maxima intensidad
- El borde del panel hace un ultimo flash
- Preparacion para el evento de breach
```

### 5.3 El Momento del Breach (caida de la muralla)

```
Trigger: API detecta currentTick < wall.tickLower

Secuencia de animacion (3000ms total):

0ms:
- GLITCH INTENSO: el contenido del panel entero tiene glitch durante 500ms
  (CSS: clip-path animado, chromatic aberration, desplazamiento de colores)
- En Three.js: explosion de particulas rojas desde el centro de la muralla

300ms:
- La imagen de la muralla hace un "collapse" rapido:
  scaleY 1 -> 0.1 en 200ms, luego crossfade a wall-0.png

500ms:
- Flash rojo que llena toda la pantalla: overlay rgba(255,0,0,0.3) durante 200ms

700ms:
- Overlay rojo desaparece
- wall-0.png aparece con fade in 400ms
- Se superpone texto "CITADEL FALLEN" con un glitch-text animation

1000ms:
- Las figuras de bears en 3D "atraviesan" los escombros (pasan al otro lado)
- Particulas de ceniza empiezan a caer (CSS)

1500ms:
- Battle Report empieza a aparecer con fade in escalonado por lineas
- Cada linea del report: slideInLeft con 50ms de delay entre lineas

2500ms:
- Aparece "AWAITING NEW DEPLOYMENT..." con un spinner cyan
- La musica/sonido (si lo añadimos) seria un tono descendente distorsionado

3000ms:
- Animacion completamente establecida
- El panel queda en estado "fallen" con cenizas cayendo infinitamente
```

### 5.4 El Momento del Deploy (nueva muralla)

```
Trigger: Admin hace POST /api/citadel/wall

Secuencia (2000ms):

0ms:
- Si habia un estado "waiting": el spinner desaparece con fade out

200ms:
- Flash cyan que llena la pantalla: overlay rgba(0,245,255,0.2) durante 300ms
- Sonido (opcional): tono ascendente cyber

300ms:
- La escena 3D empieza a "construirse": los paneles de la muralla entran desde
  abajo uno a uno con delay escalonado (50ms entre cada panel)
- Efecto: como si el muro se estuviera construyendo en tiempo real

700ms:
- La health bar se llena desde 0% a 100% en 800ms (ease-out)

1200ms:
- El escudo holograma aparece con un spin-in (scale 0 -> 1 + rotation)

1500ms:
- Las stats del panel aparecen con fade in escalonado

2000ms:
- Glitch positivo final: el titulo "BATTLE #X — ACTIVE" hace un breve glitch
  y se estabiliza. Estado totalmente establecido.
- Texto "NEW GUARDIAN NEEDED" aparece si no hay guardians todavia
```

---

## 6. EFECTOS DE EVENTO (BREACH, JOIN, DEPLOY)

### 6.1 Guardian Join

```
Cuando POST /api/citadel/guardian/join devuelve { registered: true }:

1. Toast entrada con slide desde derecha:
   "Guardian registered! You are defending Battle #7"

2. Si is_first_guardian: toast especial con badge animation
   "⚡ FIRST GUARDIAN — You were first to reinforce this wall!"
   Badge badge-first-guardian.png aparece en el toast con badge-reveal animation

3. En el War Room: nueva fila aparece con highlight cyan (2s) luego se normaliza

4. La muralla en la escena 3D: nuevo "energy beam" aparece por 2s
   (linea de cyan que va desde abajo hasta arriba, representando la nueva liquidez)
```

### 6.2 Fees Update (cuando el usuario actualiza sus fees pendientes)

```
- El numero de fees en War Room hace count up animation desde el valor anterior
- Pequeno "+$X.XX" en verde aparece junto al numero y se desvanece en 2s
- En el perfil: mismo efecto
```

---

## 7. PARTICULAS Y SISTEMAS DE PARTICULAS

### 7.1 Energy Particles (muralla intacta)

```
Tipo: PointsMaterial en Three.js
Cantidad: 200 particulas
Comportamiento:
- Ascienden por los laterales de la muralla
- Al llegar arriba: desaparecen (opacity -> 0) y reaparecen abajo
- Color: cyan #00f5ff con variacion de brillo
- Tamano: 1-3px
- Velocidad: lenta y suave
```

### 7.2 Spark Particles (muralla besieged/crumbling)

```
Tipo: PointsMaterial con sprites de chispa
Cantidad: 50-100 particulas dinamicas
Comportamiento:
- Emitidas desde puntos de impacto en la muralla (posiciones random prefijadas)
- Vuelo parabolico con gravedad: vy inicial positiva, decae con gravedad
- Color: naranja #ff8800 a blanco
- Life: 0.5-1.5s por particula
- Se crean en "bursts" (no continuamente)
```

### 7.3 Debris Particles (crumbling/critical)

```
Tipo: MeshGeometry (pequenos cubos irregulares)
Cantidad: 30-60 objetos
Comportamiento:
- Caen con gravedad desde puntos de fractura en la muralla
- Rotacion aleatoria mientras caen
- Color: gris oscuro + borde naranja/rojo
- Desaparecen al salir del view frustum
- Se regeneran continuamente
```

### 7.4 Ash Particles (fallen)

```
Tipo: CSS animation (puro, sin Three.js)
Cantidad: 50 elementos div
Comportamiento:
- Puntos blancos/grises, muy pequenos (2-3px)
- Caen suavemente con movimiento lateral oscilatorio (sin + cos)
- Opacidad variable (0.1 - 0.4)
- Cubren el area del panel
```

```css
.ash {
  position: absolute;
  width: 2px; height: 2px;
  background: rgba(200,200,200,0.3);
  border-radius: 50%;
  animation: ash-fall linear infinite;
}

@keyframes ash-fall {
  0%   { transform: translate(0, -20px); opacity: 0; }
  10%  { opacity: 0.4; }
  90%  { opacity: 0.2; }
  100% { transform: translate(var(--drift), 300px); opacity: 0; }
}
/* --drift es un valor random entre -30px y 30px generado con JS */
```

### 7.5 Data Bits (hero background, CSS)

```
Ya descrito en seccion 3.5 (DataRain).
Adicional: cuando el usuario mueve el mouse por el hero,
los bits cercanos al cursor se "repelen" levemente.
Implementado via mousemove event + CSS custom properties en cada elemento.
```

---

## 8. TRANSICIONES ENTRE PAGINAS

### 8.1 Page transition (Next.js App Router)

Con `framer-motion` y `AnimatePresence`:

```tsx
// app/template.tsx (wrapper de transicion)
export default function Template({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, filter: 'brightness(0) blur(4px)' }}
      animate={{ opacity: 1, filter: 'brightness(1) blur(0px)' }}
      exit={{ opacity: 0, filter: 'brightness(2) blur(4px)' }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  )
}
```

Adicionalmente: al navegar, hay un flash rapido de scanlines que "barren" la pantalla
(linea de 4px que va de arriba a abajo en 200ms, color cyan).

### 8.2 Scroll animations (Intersection Observer)

Las secciones de la pagina principal aparecen al hacer scroll:

```typescript
// hook useScrollReveal
function useScrollReveal(threshold = 0.15) {
  const ref = useRef()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return { ref, visible }
}
```

```css
.reveal-up {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.reveal-up.visible {
  opacity: 1;
  transform: translateY(0);
}
```

---

## 9. PERFORMANCE Y FALLBACKS

### 9.1 Deteccion de capacidad

```typescript
// lib/detectGPU.ts
function getGPUTier(): 'high' | 'medium' | 'low' {
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
  if (!gl) return 'low'

  const ext = gl.getExtension('WEBGL_debug_renderer_info')
  if (!ext) return 'medium'

  const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
  // Mobile GPUs / old hardware
  if (/Mali|Adreno|PowerVR|Intel HD|Intel UHD 600/.test(renderer)) return 'low'
  return 'high'
}

// En el componente:
const tier = useGPUTier()

// HIGH: Three.js completo + postprocessing + bloom + particles + data storm
// MEDIUM: Three.js basico (sin postprocessing) + particles reducidas
// LOW: Solo CSS (no Three.js), imagenes estaticas con animaciones CSS
```

### 9.2 Reduccion de movimiento

```css
@media (prefers-reduced-motion: reduce) {
  .glitch-text::before,
  .glitch-text::after { animation: none; }
  .data-rain-column { animation: none; opacity: 0.15; }
  .wall-shake-critical { animation: none; }
  .neon-pulse-red { animation: none; }
  /* Three.js: desactivar auto-orbit y particulas de debris */
}
```

### 9.3 Lazy loading de Three.js

```tsx
// Three.js es ~600KB. Se carga solo cuando el componente es visible.
const CitadelWall3D = dynamic(
  () => import('@/components/citadel/CitadelWall3D'),
  {
    ssr: false,
    loading: () => <WallImage2D integrity={integrity} state={state} />
  }
)
```

---

## 10. LIBRERIAS Y DEPENDENCIAS

### Nuevas dependencias a anadir al package.json

```json
{
  "three": "^0.169.0",
  "@react-three/fiber": "^8.17.0",
  "@react-three/drei": "^9.115.0",
  "@react-three/postprocessing": "^2.16.3",
  "framer-motion": "^11.11.0",
  "leva": "^0.9.35"
}
```

**Three.js** (~600KB gzip: ~170KB): el motor 3D
**@react-three/fiber**: bindings de React para Three.js (declarativo)
**@react-three/drei**: utilidades (Environment, OrbitControls, Text, etc.)
**@react-three/postprocessing**: efectos de post-proceso (Bloom, Glitch, ChromaticAberration)
**framer-motion**: animaciones de layout y page transitions
**leva**: panel de debug para parametros de Three.js (solo en development)

### Fuentes de Google Fonts (anadidas a layout.tsx)

```
Orbitron:wght@400;700;900      -> titulos, display
Rajdhani:wght@400;500;600;700  -> body
Share+Tech+Mono                -> numeros, ticks, datos tecnicos
```

---

## RESUMEN VISUAL — QUE VE EL USUARIO

```
AL CARGAR LA PAGINA:
  1. Fondo negro absoluto (--bg-void)
  2. Fade in general (0.3s)
  3. Scanlines aparecen
  4. Logo hace glitch de entrada (0.5s)
  5. Tagline se escribe como typewriter
  6. Data rain empieza a caer (CSS)
  7. Three.js canvas carga en background: grid flotante + bits
  8. Active battle section aparece con slide up
  9. Si batalla activa: la muralla 3D se "construye" (paneles entran uno a uno)
 10. La pagina queda viva: particulas, pulsos, contadores actualizandose

INTERACTUANDO:
  - El cursor tiene un halo cyan muy sutil (3px, blur 4px)
  - Los hover en cards: borde cyan aparece + leve lift (translateY -2px)
  - Los hover en botones: neon-pulse se activa
  - Al escribir en inputs: el borde cyan pulsa

DURANTE UN SIEGE:
  - El borde del panel rojo pulsante capta la atencion
  - Las bears avanzan en 3D
  - El contador de distancia baja en tiempo real
  - La tension es palpable

AL CAER LA MURALLA (si el usuario esta en la pagina):
  - Un evento espectacular de 3 segundos que hace que el usuario sienta la derrota
  - Y luego quiere sumarse a la siguiente muralla para vengarse
```

---

*CITADEL PROTOCOL — Animaciones y 3D v1.0*
*Librerias: Three.js + @react-three/fiber + @react-three/postprocessing + framer-motion*
