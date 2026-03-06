# CITADEL PROTOCOL — MASTER PLAN
## Plan de Diseño y Desarrollo Completo
### Version 2.0 — Definitivo

---

> **Repositorio:** https://github.com/gotoalberto/helm
> **Deploy:** Vercel project `helm` (dominio existente en el proyecto)
> **Base:** Código de zeus-liquidity copiado íntegramente como punto de partida
> **BD:** Misma PostgreSQL que zeus-liquidity, schema separado `citadel`
> **API Keys:** Extraídas de Vercel del proyecto zeus-liquidity via CLI
> **Nueva env var:** `ADMIN_PASSWORD` (solo para /admin)

---

## ÍNDICE

- [PARTE I: SETUP Y INFRAESTRUCTURA](#parte-i-setup-y-infraestructura)
- [PARTE II: EL UNIVERSO Y LA NARRATIVA](#parte-ii-el-universo-y-la-narrativa)
- [PARTE III: MECÁNICA DEL JUEGO — DETALLE COMPLETO](#parte-iii-mecánica-del-juego--detalle-completo)
- [PARTE IV: DISEÑO VISUAL Y SISTEMA DE DISEÑO](#parte-iv-diseño-visual-y-sistema-de-diseño)
- [PARTE V: PANTALLAS — DISEÑO PIXEL A PIXEL](#parte-v-pantallas--diseño-pixel-a-pixel)
- [PARTE VI: ANIMACIONES Y 3D — ESPECIFICACIÓN TÉCNICA](#parte-vi-animaciones-y-3d--especificación-técnica)
- [PARTE VII: BASE DE DATOS — SCHEMA COMPLETO](#parte-vii-base-de-datos--schema-completo)
- [PARTE VIII: APIs — ESPECIFICACIÓN COMPLETA](#parte-viii-apis--especificación-completa)
- [PARTE IX: COMPONENTES — ÁRBOL COMPLETO](#parte-ix-componentes--árbol-completo)
- [PARTE X: PLAN DE DESARROLLO — FASES](#parte-x-plan-de-desarrollo--fases)
- [PARTE XI: ASSETS GRÁFICOS GENERADOS](#parte-xi-assets-gráficos-generados)

---

# PARTE I: SETUP Y INFRAESTRUCTURA

## 1.1 Extracción de variables de entorno desde Vercel

El proyecto `helm` reutiliza **exactamente las mismas API keys** que `zeus-liquidity`.
Se extraen con Vercel CLI:

```bash
# Extraer de zeus-liquidity (proyecto origen)
cd ~/git/zeus-liquidity
vercel env pull .env.zeus --environment=production

# Leer las keys y añadirlas al proyecto helm
vercel link  # (en ~/git/helm, vincular al proyecto helm en Vercel)
vercel env add NEXT_PUBLIC_COINGECKO_API_KEY production  # pegar valor de .env.zeus
vercel env add ALCHEMY_API_KEY production
vercel env add NEXT_PUBLIC_REOWN_PROJECT_ID production
vercel env add DATABASE_URL production                   # misma PostgreSQL
vercel env add NEXT_PUBLIC_CHAIN_ID production           # = 1

# Nueva: solo para helm
vercel env add ADMIN_PASSWORD production                 # contraseña del /admin
```

**Las keys nunca se hardcodean.** Todo via env vars. El `DATABASE_URL` apunta
a la misma instancia PostgreSQL que zeus-liquidity pero el código crea el schema
`citadel` separado al arrancar (no toca las tablas `public.*` existentes).

## 1.2 Creación del repo

```bash
# Clonar zeus-liquidity como base
cp -r ~/git/zeus-liquidity ~/git/helm

# Limpiar y reinicializar git
cd ~/git/helm
rm -rf .git
git init
git remote add origin https://github.com/gotoalberto/helm.git

# Limpiar artefactos de zeus-liquidity que no se usan
rm CONTEXT.md CITADEL_PLAN.md  # docs del proyecto anterior

# Primera instalación
npm install
# Añadir nuevas dependencias
npm install three @react-three/fiber @react-three/drei @react-three/postprocessing framer-motion
```

## 1.3 Variables de entorno — lista completa

| Variable | Origen | Descripción |
|---|---|---|
| `NEXT_PUBLIC_COINGECKO_API_KEY` | zeus-liquidity | Precios ZEUS (CoinGecko) |
| `ALCHEMY_API_KEY` | zeus-liquidity | RPC Ethereum (Alchemy) |
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | zeus-liquidity | WalletConnect (Reown) |
| `DATABASE_URL` | zeus-liquidity | Misma PostgreSQL, schema `citadel` |
| `NEXT_PUBLIC_CHAIN_ID` | zeus-liquidity | `1` (Ethereum mainnet) |
| `ADMIN_PASSWORD` | **NUEVA** | Contraseña del backoffice `/admin` |

## 1.4 Schema de BD — relación con zeus-liquidity

```
PostgreSQL (mismo servidor)
├── schema: public          ← zeus-liquidity (NO tocar)
│   ├── zeus_apr_cache
│   ├── zeus_positions_cache
│   ├── zeus_fee_collections
│   ├── zeus_user_positions_cache
│   └── zeus_position_fees_snapshot
│
└── schema: citadel         ← helm (nuevo, creado automáticamente al arrancar)
    ├── citadel.walls
    ├── citadel.battles
    ├── citadel.first_guardians
    └── citadel.guardian_battles
```

La función `ensureCitadelSchema()` en `lib/db.ts` crea el schema y tablas
con `CREATE SCHEMA IF NOT EXISTS` y `CREATE TABLE IF NOT EXISTS`.
Se llama al inicio de cada API route que necesite BD del citadel.

---

# PARTE II: EL UNIVERSO Y LA NARRATIVA

## 2.1 El Mundo

**Año 2187. Los mercados son campos de batalla.**

En el universo de CITADEL PROTOCOL, los activos digitales son ciudades-estado.
ZEUS es la última ciudad libre en un mundo donde los carteles de vendedores
— los **Bears** — controlan los mercados con ventas coordinadas y ataques
de precio sistemáticos.

La ciudad de ZEUS no tiene ejército convencional. Su única defensa son los
**Guardians**: holders que depositan su riqueza personal como muros de energía
concentrada — posiciones de liquidez en Uniswap V4 — en puntos estratégicos
del rango de precio. Cada swap de venta que pasa por un Guardian le paga fees.
Cada Guardian que aguanta es un héroe.

**La Citadel Wall** es la manifestación física de esa defensa: una barrera
de liquidez concentrada en un único tick de Uniswap V4, tan estrecha como
es posible (1 tick spacing = 60), maximizando la concentración de poder
defensivo y la eficiencia de fees.

## 2.2 Glosario completo del universo

| Término en juego | Realidad técnica | Por qué este nombre |
|---|---|---|
| **The Citadel** | La dApp completa | La ciudad-fortaleza que defendemos |
| **Citadel Wall** | Posición LP concentrada en 1 tick (tickSpacing=60) | El muro físico de energía |
| **Guardian** | Address con LP en la muralla activa | Soldado defensor |
| **Battle** | Ciclo de vida de una muralla (deploy → caída/demolición) | Cada muralla es una batalla |
| **Reinforce** | Añadir liquidez al rango de la muralla | Fortalecer el muro |
| **Siege** | Precio < 5% sobre la muralla | Los bears están atacando |
| **Breach** | currentTick < wall.tickLower | Los bears atravesaron el muro |
| **Wall Integrity** | `currentLiq / peakLiq * 100` | Vida del muro en porcentaje |
| **Fee Loot** | Fees de trading acumuladas | Botín de guerra |
| **War Room** | Leaderboard de Guardians activos | Sala de mando de la batalla |
| **First Guardian** | Primer LP en el tick de la muralla | El primero en responder |
| **Architect** | Guardian con mayor liquidez activa | El que construyó más |
| **Last Stand** | Uno de los últimos 3 en unirse antes de una caída | Los que aguantaron hasta el final |
| **Survivor** | Participó en una batalla que se mantuvo | Veterano victorioso |
| **Veteran** | 5+ batallas participadas | Soldado experimentado |
| **Fee Harvester** | Top 1 en fees históricas | El más rentable de todos |
| **Battle Chronicle** | Historial completo de batallas | Los anales de guerra |
| **Battle Report** | Resumen detallado de una batalla terminada | Parte de guerra |
| **Deploy Wall** | Admin crea nueva muralla en BD | Orden de construcción de la Citadel |
| **Demolish** | Admin retira muralla sin breach | Retirada estratégica |
| **MCAP Target** | Market cap objetivo de la muralla | El precio que defendemos (en MCAP USD) |

## 2.3 Por qué MCAP en vez de precio

Exactamente igual que zeus-liquidity, la muralla siempre se define en **Market Cap USD**,
no en precio de token ni en tick raw.

**Razón:** "$850,000 de market cap" es intuitivo. El tick -204,360 no lo es.
Además, el MCAP normaliza el precio respecto al supply total, lo que lo hace
una medida de valoración del proyecto más estable que el precio en ETH,
que fluctúa con el precio de ETH.

La conversión usa exactamente las mismas funciones de `lib/uniswap/mcap.ts`:
```
mcapUsd → zeusUsdPrice → zeusPerEth → priceRatio → tick (round to 60)
```

**En el admin:** el campo de input es siempre MCAP en USD.
**En la página principal:** todo se muestra en MCAP.
**Los ticks never se muestran al usuario** (solo al admin como info técnica).

---

# PARTE III: MECÁNICA DEL JUEGO — DETALLE COMPLETO

## 3.1 La Muralla — Especificación Técnica

Una muralla es siempre:
```
tickLower = mcapToTick(mcapTarget, ethPrice, totalSupply)  // redondeado a múltiplo de 60
tickUpper = tickLower + 60                                 // EXACTAMENTE 1 tick de ancho
```

Con tickSpacing=60 del pool ZEUS/ETH, esto es el rango mínimo posible.
El ancho real en MCAP de 1 tick es aproximadamente:
```
width_pct = (1.0001^60 - 1) * 100 ≈ 0.6%
```
Es decir, un rango de ~0.6% de ancho en precio. Extremadamente concentrado.

**Ventajas para el Guardian:**
- Máxima eficiencia de fees: toda la liquidez trabaja en ese precio exacto
- Efecto de buy-wall muy concentrado: mucho impacto por dólar
- APR altísimo si el precio oscila cerca del tick

**Riesgos para el Guardian:**
- Impermanent loss total si el precio cruza: posición queda 100% ZEUS
- Cero fees si el precio nunca entra en el rango

## 3.2 Cálculo de Integridad — Lógica Completa

```typescript
// lib/citadel/wallIntegrity.ts

interface IntegrityResult {
  integrity: number          // 0-100
  state: WallState
  currentLiquidity: bigint
  peakLiquidity: bigint
  isBreach: boolean
}

type WallState =
  | 'impenetrable'   // >= 90%
  | 'besieged'       // >= 70%
  | 'crumbling'      // >= 45%
  | 'critical'       // >= 20%
  | 'fallen'         // <  20% (o breach detectado)
  | 'none'           // no hay muralla activa

async function getWallIntegrity(wall: CitadelWall): Promise<IntegrityResult> {
  // 1. Obtener liquidez actual on-chain en ese tick range
  const currentLiq = await getLiquidityInRange(wall.tick_lower, wall.tick_upper)

  // 2. Actualizar peak_liquidity si el actual es mayor
  const peak = wall.peak_liquidity ? BigInt(wall.peak_liquidity) : 0n
  const newPeak = currentLiq > peak ? currentLiq : peak
  if (currentLiq > peak) {
    await db.query(
      'UPDATE citadel.walls SET peak_liquidity = $1 WHERE id = $2',
      [currentLiq.toString(), wall.id]
    )
  }

  // 3. Calcular integridad
  const integrity = newPeak === 0n
    ? 100
    : Math.round(Number((currentLiq * 100n) / newPeak))

  // 4. Determinar estado visual
  const state: WallState =
    integrity >= 90 ? 'impenetrable' :
    integrity >= 70 ? 'besieged' :
    integrity >= 45 ? 'crumbling' :
    integrity >= 20 ? 'critical' :
                      'fallen'

  // 5. Detectar breach
  const currentTick = await getCurrentPoolTick()  // de lib/uniswap/positions.ts
  const isBreach = currentTick < wall.tick_lower

  return { integrity, state, currentLiquidity: currentLiq, peakLiquidity: newPeak, isBreach }
}
```

**Imagen del muro según estado:**

| Estado | Rango | Imagen | Color dominante |
|--------|-------|--------|-----------------|
| `impenetrable` | 90-100% | `wall-100.png` | Cyan brillante |
| `besieged` | 70-89% | `wall-75.png` | Cyan apagado, fisuras |
| `crumbling` | 45-69% | `wall-50.png` | Naranja, fuego |
| `critical` | 20-44% | `wall-25.png` | Rojo, ruinas |
| `fallen` | 0-19% | `wall-0.png` | Negro/ceniza |

## 3.3 Detección de Breach — Flujo Completo

```
Polling desde el cliente: cada 30s llama a GET /api/citadel/wall

En el servidor (dentro del GET handler):
1. Lee muralla activa de BD
2. Llama a getCurrentPoolTick() — usa UNISWAP_V4_STATE_VIEW contract (ya existente)
3. Si currentTick < wall.tick_lower:
   a. UPDATE citadel.walls SET status='fallen', fallen_at=NOW()
   b. INSERT INTO citadel.battles (wall_id, result='fallen', guardian_count, ...)
   c. Calcular quiénes son los últimos 3 en citadel.guardian_battles por joined_at
   d. UPDATE citadel.guardian_battles SET is_last_stand=TRUE para esos 3
4. Retorna el estado actualizado (status='fallen')

En el cliente:
1. Detecta que la respuesta cambió a status='fallen'
2. Dispara la secuencia de animación de breach (3 segundos)
3. Muestra el Battle Report automáticamente
```

## 3.4 Ciclo de vida completo de una batalla

```
┌─────────────────────────────────────────────────────────────────┐
│  FASE 0: SIN MURALLA                                            │
│  status: none                                                    │
│  UI: "No active wall — Bears are gathering..."                  │
└────────────────────┬────────────────────────────────────────────┘
                     │ Admin hace POST /api/citadel/wall
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  FASE 1: MURALLA DESPLEGADA — RECRUITMENT                       │
│  status: active, integrity: 100%, state: impenetrable           │
│  UI: Muro intacto, "JOIN THE CITADEL"                           │
│  Duración: variable (días/semanas si el precio está lejos)      │
└────────────────────┬────────────────────────────────────────────┘
                     │ Guardians añaden liquidez
                     │ peak_liquidity sube
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  FASE 2: SIEGE — precio <= 5% sobre la muralla                  │
│  status: active, integrity: variable, state: besieged/crumbling │
│  UI: Alerta roja, ticker de swaps, borde pulsante               │
│  Fees: los Guardians empiezan a cobrar por cada swap            │
└──────────┬─────────────────────────────┬───────────────────────-┘
           │ breach detectado             │ precio rebota / admin demolish
           ▼                             ▼
┌──────────────────────┐   ┌─────────────────────────────────────┐
│  FASE 3A: FALLEN     │   │  FASE 3B: HELD/DEMOLISHED           │
│  status: fallen      │   │  status: demolished                 │
│  UI: ruinas, report  │   │  UI: victoria, "wall stood"         │
│  Badges: LAST_STAND  │   │  Badges: SURVIVOR asignado          │
└──────────┬───────────┘   └──────────────┬──────────────────────┘
           └──────────────┬───────────────┘
                          │ vuelve a fase 0
                          ▼
                    Siguiente batalla
```

## 3.5 Qué token aporta cada Guardian — Lógica

La composición de la posición depende de dónde está el precio respecto al tick:

```typescript
// lib/citadel/positionComposition.ts

type Composition = '100_zeus' | '100_eth' | 'mixed'

function getWallComposition(
  wallTickLower: number,
  wallTickUpper: number,
  currentPoolTick: number
): { composition: Composition; zeusRatio: number; ethRatio: number } {

  if (currentPoolTick >= wallTickUpper) {
    // Precio está por encima del rango → posición es 100% token1 = ZEUS
    return { composition: '100_zeus', zeusRatio: 1, ethRatio: 0 }
  }

  if (currentPoolTick < wallTickLower) {
    // Precio está por debajo del rango → posición es 100% token0 = ETH
    return { composition: '100_eth', zeusRatio: 0, ethRatio: 1 }
  }

  // Precio dentro del rango (extremadamente raro con 1 tick)
  // Ratio aprox: mitad/mitad por simplificación
  return { composition: 'mixed', zeusRatio: 0.5, ethRatio: 0.5 }
}
```

**Mensaje en UI según composición:**

- `100_zeus`: *"Your position will be 100% ZEUS. You are building a buy wall that absorbs sell pressure."*
- `100_eth`: *"Your position will be 100% ETH. The wall is above current price — you'll earn fees as price rises."*
- `mixed`: *"Price is at the wall now. Split position required."*

## 3.6 Sistema de Badges — Lógica Completa

### ARCHITECT (dinámico — se mueve)
```
Condición: ser el address con la posición individual más grande
           en la muralla activa en este momento.
Cómo se calcula:
  1. Obtener todas las posiciones en [wall.tick_lower, wall.tick_upper] via Alchemy
  2. Agrupar por owner (del NFT de posición)
  3. El owner con mayor liquidity tiene el badge
Se recalcula en cada llamada a GET /api/citadel/wall
Solo 1 address puede tenerlo a la vez.
```

### FIRST GUARDIAN (permanente — para siempre)
```
Condición: ser el primer address en citadel.first_guardians para cualquier wall_id.
Cómo se asigna:
  Cuando POST /api/citadel/guardian/join, si la tabla first_guardians
  no tiene entrada para ese wall_id → INSERT.
  Si ya existe → no se sobreescribe.
Un address puede tener FIRST GUARDIAN en múltiples batallas.
```

### FEE HARVESTER (dinámico — se mueve)
```
Condición: ser el address con mayor total de fees históricas acumuladas.
Cómo se calcula: usando el leaderboard existente de zeus-liquidity
  (zeus_position_fees_snapshot + zeus_fee_collections)
Solo 1 address puede tenerlo a la vez.
```

### VETERAN (permanente — se gana una vez)
```
Condición: haber participado en 5 o más batallas distintas.
Cómo se calcula:
  SELECT COUNT(DISTINCT wall_id) FROM citadel.guardian_battles WHERE address=$1 >= 5
Se gana permanentemente y no se pierde.
```

### SURVIVOR (permanente — acumulable)
```
Condición: haber participado en al menos 1 batalla con resultado 'held' o 'demolished'.
Cómo se calcula:
  JOIN citadel.battles WHERE result IN ('held','demolished')
```

### LAST STAND (permanente — acumulable)
```
Condición: en alguna batalla con resultado 'fallen', estar entre los últimos 3
           en haber añadido liquidez (joined_at más reciente).
Cómo se asigna:
  Cuando se detecta breach, se calculan los 3 últimos en citadel.guardian_battles
  por joined_at para ese wall_id, y se marcan is_last_stand=TRUE.
```

---

# PARTE IV: DISEÑO VISUAL Y SISTEMA DE DISEÑO

## 4.1 Paleta de colores completa

```css
:root {
  /* ── Fondos ────────────────────────────────── */
  --bg-void:         #03050f;   /* negro absoluto con tinte azul */
  --bg-primary:      #060b18;   /* fondo de página */
  --bg-secondary:    #080e1e;   /* secciones alternadas */
  --bg-panel:        #0a1228;   /* cards y panels */
  --bg-panel-hover:  #0d1530;
  --bg-glass:        rgba(0, 245, 255, 0.03);
  --bg-glass-hover:  rgba(0, 245, 255, 0.06);

  /* ── Neon principals ───────────────────────── */
  --neon-cyan:       #00f5ff;   /* color principal — muralla activa, intacta */
  --neon-cyan-dim:   #00b8c4;   /* cyan apagado — besieged */
  --neon-magenta:    #ff00aa;   /* bears, atacantes, peligro secundario */
  --neon-amber:      #ffb700;   /* fees, oro, rewards, botones CTA */
  --neon-green:      #00ff88;   /* victoria, held, success, fees positivas */
  --neon-red:        #ff2244;   /* breach, fallen, danger máximo */
  --neon-orange:     #ff6600;   /* crumbling, warning */

  /* ── Texto ─────────────────────────────────── */
  --text-primary:    #e8f4ff;
  --text-secondary:  #7a9cbf;
  --text-muted:      #3a5570;
  --text-cyan:       #00f5ff;
  --text-amber:      #ffb700;
  --text-red:        #ff4466;

  /* ── Borders ───────────────────────────────── */
  --border-default:  rgba(0, 245, 255, 0.08);
  --border-bright:   rgba(0, 245, 255, 0.18);
  --border-siege:    rgba(255, 34, 68, 0.4);
  --border-amber:    rgba(255, 183, 0, 0.3);

  /* ── Sombras / Glow ────────────────────────── */
  --glow-cyan:       0 0 8px #00f5ff, 0 0 20px rgba(0,245,255,0.3);
  --glow-amber:      0 0 8px #ffb700, 0 0 20px rgba(255,183,0,0.3);
  --glow-red:        0 0 8px #ff2244, 0 0 20px rgba(255,34,68,0.4);
  --glow-green:      0 0 8px #00ff88, 0 0 20px rgba(0,255,136,0.3);
}
```

## 4.2 Tipografía

```css
/* Google Fonts — añadir a layout.tsx */

/* Orbitron: Display / Títulos / Logo
   Uso: H1, H2, nombres de secciones, el logo CITADEL, números grandes
   Características: angular, cuadrado, muy futurista */
@import url('...Orbitron:wght@400;700;900...');
--font-display: 'Orbitron', monospace;

/* Rajdhani: Body text
   Uso: párrafos, labels, descripciones, nav
   Características: semi-condensed, legible, sci-fi sin ser extremo */
@import url('...Rajdhani:wght@400;500;600;700...');
--font-body: 'Rajdhani', sans-serif;

/* Share Tech Mono: Datos técnicos
   Uso: ticks, addresses, cantidades en USD, fees, cualquier número
   Características: monospace, técnico, terminal feel */
@import url('...Share+Tech+Mono...');
--font-mono: 'Share Tech Mono', monospace;
```

## 4.3 Grid y layout

```
Desktop (1440px max-width):
  Gutter:        24px
  Columns:       12
  Column width:  ~96px
  Max container: 1280px (con padding 24px c/lado)

Tablet (768px-1199px):
  Gutter:        16px
  Columns:       8

Mobile (<768px):
  Gutter:        16px
  Columns:       4
  Max container: 375px full width
```

## 4.4 Componentes base — Design Tokens

### Panel / Card
```css
.panel {
  background: var(--bg-panel);
  border: 1px solid var(--border-default);
  border-radius: 2px;              /* ANGULOSO — cyberpunk, no redondeado */
  padding: 24px;
  position: relative;
  overflow: hidden;
}

/* Acento de esquina superior izquierda */
.panel::before {
  content: '';
  position: absolute;
  top: 0; left: 0;
  width: 48px; height: 2px;
  background: var(--neon-cyan);
  box-shadow: var(--glow-cyan);
}

/* Acento de esquina inferior derecha */
.panel::after {
  content: '';
  position: absolute;
  bottom: 0; right: 0;
  width: 24px; height: 2px;
  background: var(--neon-cyan);
  opacity: 0.4;
}

.panel.siege {
  border-color: var(--border-siege);
  animation: siege-pulse 1.5s ease-in-out infinite;
}
```

### Botones
```css
/* Primary CTA — gold/amber */
.btn-primary {
  font-family: var(--font-display);
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: linear-gradient(135deg, #ffb700, #ff8c00);
  color: #000;
  border: none;
  padding: 12px 28px;
  border-radius: 2px;
  cursor: pointer;
  box-shadow: var(--glow-amber);
  transition: transform 0.15s, box-shadow 0.15s;
}
.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 16px #ffb700, 0 0 40px rgba(255,183,0,0.5);
}

/* Secondary — cyan outline */
.btn-secondary {
  background: transparent;
  color: var(--neon-cyan);
  border: 1px solid var(--border-bright);
  font-family: var(--font-display);
  padding: 11px 28px;
  border-radius: 2px;
  transition: background 0.2s, box-shadow 0.2s;
}
.btn-secondary:hover {
  background: var(--bg-glass-hover);
  box-shadow: var(--glow-cyan);
}

/* Danger — rojo */
.btn-danger {
  background: rgba(255,34,68,0.1);
  color: #ff4466;
  border: 1px solid rgba(255,34,68,0.3);
  font-family: var(--font-display);
  padding: 11px 28px;
  border-radius: 2px;
}
```

### Inputs
```css
.input-citadel {
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--border-default);
  border-radius: 2px;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 1.1rem;
  padding: 14px 16px;
  width: 100%;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.input-citadel:focus {
  outline: none;
  border-color: var(--neon-cyan);
  box-shadow: 0 0 0 1px var(--neon-cyan), inset 0 0 10px rgba(0,245,255,0.05);
}
.input-citadel::placeholder {
  color: var(--text-muted);
  font-family: var(--font-mono);
}
```

### Badge Hexagonal
```css
.badge-hex {
  width: 72px;
  height: 72px;
  clip-path: polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: transform 0.2s, filter 0.2s;
}
.badge-hex:hover {
  transform: scale(1.1);
  filter: brightness(1.3);
}
.badge-hex img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Mini versión para tablas */
.badge-hex-mini {
  width: 24px;
  height: 24px;
  clip-path: polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%);
}
```

---

# PARTE V: PANTALLAS — DISEÑO PIXEL A PIXEL

## 5.1 PÁGINA PRINCIPAL `/` — Layout Completo

### Sección 0: HEADER (sticky, siempre visible)

**Referencia visual:** `designs/ref-homepage-intact.png` (top bar)

```
HEIGHT: 60px (comprime a 48px al hacer scroll)
BACKGROUND: rgba(3,5,15,0.88) + backdrop-filter: blur(20px) saturate(180%)
BORDER-BOTTOM: 1px solid rgba(0,245,255,0.08)
TRANSITION: height 200ms ease

Layout interno (flex, space-between):
  LEFT:
    Logo: icono rayo ⚡ (SVG cyan, 20px) + "CITADEL" (Orbitron 700, 18px, cyan)
    Separador: | (1px vertical, opacity 0.2)
    Nav links: "Defend" | "Battle" | "Guardians" (Rajdhani 600, 14px, text-secondary)
    [hover: color -> cyan, transition 200ms]

  CENTER (solo desktop):
    ZEUS MCAP pill: "MCAP $847K" con punto verde pulsante
    [Si precio bajó en últimos 30s: texto rojo + flecha down]
    [Si precio subió: texto verde + flecha up]

  RIGHT:
    Wallet button: si no conectado → "CONNECT WALLET" (btn-secondary, 36px height)
    Si conectado:
      Avatar hexagonal pequeño (24px, usando identicon del address)
      Address truncada: "0x4a3b...f2c1"
      [Si tiene posición activa en muralla: borde cyan pulsante en el botón]
      [Si hay siege: borde rojo pulsante]

BARRA DE PROGRESO SCROLL:
  Debajo del header: línea de 2px de altura, 100% width
  Color: cyan → magenta (gradiente)
  Width: proporcional al scroll (0% en top, 100% en bottom)
  [CSS: position sticky, z-index 49]
```

### Sección 1: HERO

**Referencia visual:** `designs/ref-homepage-intact.png` (área central superior)
**Asset:** `public/hero-bg.png` + `public/citadel-logo.png`

```
HEIGHT: 100vh (primera vista completa)
OVERFLOW: hidden
POSITION: relative

CAPAS (de atrás a adelante):

  Layer 0 — hero-bg.png:
    position: absolute, inset: 0
    background-image: url('/hero-bg.png')
    background-size: cover
    background-position: center
    filter: brightness(0.35) saturate(1.2)
    [parallax: transform translateY(scrollY * 0.3) via JS]

  Layer 1 — Three.js Canvas (DataStorm):
    position: absolute, inset: 0
    z-index: 1
    [Escena: data rain 3D + grid flotante + bits flotantes]
    [GPU low: reemplazado por DataRain CSS component]

  Layer 2 — Scanlines CSS:
    position: fixed, inset: 0 (toda la página)
    z-index: 9998
    pointer-events: none

  Layer 3 — Contenido HTML:
    position: relative, z-index: 2
    display: flex, align-items: center
    padding: 0 max(5vw, 48px)
    max-width: 1280px, margin: 0 auto

    COLUMNA IZQUIERDA (55%):
      Pill badge: "● BATTLE #7 ACTIVE" (verde pulsante + Rajdhani 600)
      Logo: <img src="/citadel-logo.png" width="clamp(280px,40vw,480px)">
             [entrada: fadeInDown 0.8s + glitch al terminar]
      Tagline: "THE LAST LINE OF DEFENSE"
               Orbitron 400, clamp(1.2rem,2.5vw,1.8rem), text-secondary
               [typewriter effect: 80ms por carácter]
      MCAP display: "$847,230" Orbitron 900, clamp(3rem,5vw,4rem), cyan
                    [counter animation cuando cambia]
                    [debajo: "ZEUS MARKET CAP — LIVE" en text-muted Share Tech Mono]
      CTAs (flex, gap 12px):
        [DEFEND NOW ▶] — btn-primary grande
        [VIEW BATTLE] — btn-secondary

    COLUMNA DERECHA (45%, solo desktop):
      Stats panel (glass, 2px border cyan):
        ┌────────────────────────────────┐
        │ BATTLE STATUS                  │
        │ ────────────────────────────── │
        │ #7 ACTIVE           ● SIEGE    │
        │ ────────────────────────────── │
        │ TARGET    $850,000 MCAP        │
        │ INTEGRITY ████████░░ 73%       │
        │ GUARDIANS 4 defending          │
        │ TOTAL LIQ $14,400              │
        │ DISTANCE  0.5% from breach     │
        └────────────────────────────────┘
        [Si no hay muralla: "NO ACTIVE WALL"]

  SCROLL INDICATOR:
    bottom: 32px, centered
    Texto "SCROLL" Orbitron 400 10px text-muted
    Flecha animada bouncing ↓
```

### Sección 2: ACTIVE BATTLE (el corazón del juego)

**Referencia visual:** `designs/ref-homepage-intact.png`, `designs/ref-homepage-siege.png`, `designs/ref-homepage-fallen.png`

Esta sección cambia COMPLETAMENTE según el estado.

#### Estado A: IMPENETRABLE / BESIEGED (muralla activa, intacta o bajo asedio)

```
ID: "defend"
PADDING: 80px 0
BACKGROUND: var(--bg-secondary)
BORDER-TOP/BOTTOM: 1px solid var(--border-default)
[Si state=siege: border-color: var(--border-siege), animation: siege-pulse]

HEADER DE SECCIÓN:
  Badge: "BATTLE #7" (monospace, text-muted)
  Título: "THE CITADEL WALL" (Orbitron 700, 2.5rem, neon-cyan)
          [Si siege: "⚠ SIEGE INCOMING" en rojo, glitch animation]
  Subtítulo: "TARGET: $850,000 MCAP" (Share Tech Mono, amber)

LAYOUT PRINCIPAL (grid 2 columnas en desktop, 1 en mobile):

  COLUMNA IZQUIERDA — LA MURALLA:
    Container: aspect-ratio 4/3, position relative, border 1px cyan, border-radius 2px

    Three.js Canvas (CitadelWall3D component):
      - Full container fill
      - Escena 3D con los paneles de la muralla
      - Estado visual según integrity
      [GPU low: imagen estática wall-100/75/50/25/0.png]

    Overlay de estado (top-left):
      Pill: "● IMPENETRABLE" verde / "⚠ BESIEGED" naranja / "🔴 CRITICAL" rojo
      [Orbitron 700, 11px, uppercase]

    Health Bar (bottom del canvas):
      [ver diseño ref-health-bars.png]
      Track: 100% width, 8px height, fondo rgba(0,0,0,0.5)
      Fill: width=integrity%, gradiente según estado, glow animado
      Label izquierda: "WALL INTEGRITY"
      Label derecha: "87%" (Share Tech Mono, grande)

  COLUMNA DERECHA — STATS + WAR ROOM:

    STATS GRID (2x3):
      ┌─ TARGET MCAP ──┬─ INTEGRITY ────┐
      │ $850,000       │ 73%  CRUMBLING │
      ├─ DISTANCE ─────┼─ BATTLE AGE ───┤
      │ -0.5% / $4,200 │ 2h 34m         │
      ├─ GUARDIANS ────┼─ TOTAL LIQ ────┤
      │ 4 active       │ $14,400        │
      └────────────────┴────────────────┘
      [Cada stat: label en text-muted Rajdhani 600 11px uppercase
                  valor en Share Tech Mono, grande, con glow en color de estado]

    SEPARATOR: "— WAR ROOM —" (text-muted, centered, con líneas laterales)

    WAR ROOM TABLE:
      [ver diseño ref-war-room.png]
      Columnas: # | ADDRESS | LIQUIDITY | FEES | BADGE
      Max 5 filas visibles + "View all" si hay más
      [El address del usuario conectado: highlighted en cyan]
      Footer: "TOTAL: $14,400 · $985 fees · 4 guardians"

    CTA:
      [⚔ JOIN THE CITADEL] — btn-primary grande, full width
      [Mi posición si estoy en la muralla: "My position: $6,200 · $423 fees" en verde]
```

#### Estado B: CRUMBLING / CRITICAL (intenso)

```
[Todo igual que A pero:]
- Border: rojo pulsante intenso (1.5s cycle para crumbling, 0.5s para critical)
- Header: "⚠ SIEGE INCOMING" / "🔴 BREACH IMMINENT" con glitch text
- Three.js: debris cayendo, sparks, luces rojas
- Imagen 2D: shake animation (crumbling: suave, critical: fuerte)
- Stats DISTANCE: resaltado en rojo pulsante
- Ticker de actividad: scroll horizontal de swaps recientes
  "0x4a3b SOLD 12,000 ZEUS → $847  ·  0xf2c1 SOLD 8,400 ZEUS → $582  ·  ..."
  [background: rgba(255,34,68,0.05), border-top/bottom: 1px rojo]
- Flash rojo periódico (cada 8s en crumbling, cada 3s en critical):
  overlay rgba(255,0,0,0.04) durante 200ms
```

#### Estado C: FALLEN

```
[ver diseño ref-homepage-fallen.png]
- Fondo: aún más oscuro
- Imagen: wall-0.png con overlay "BREACHED" en rojo translúcido
- Título: "CITADEL FALLEN" en rojo, Orbitron 900, glitch continuo
- Ash particles cayendo (CSS)
- Battle Report panel automático (ver sección 5.4)
- Spinner: "AWAITING NEW DEPLOYMENT..." (cyan, Orbitron)
```

#### Estado D: NO ACTIVE WALL

```
- Ilustración de ciudad en calma (hero-bg.png más brillante)
- Título: "THE CITADEL STANDS BY" (Orbitron, text-muted)
- Texto: "No wall has been deployed. The bears are gathering in the shadows."
- Spinner sutil: "Stand by, Guardian..."
```

### Sección 3: JOIN THE CITADEL

**Referencia visual:** `designs/ref-join-form.png`

```
ID: "join"
LAYOUT: 2 columnas en desktop

COLUMNA IZQUIERDA — El cartel (solo desktop):
  [rally-poster.png, width 340px, con sutil float animation]
  Texto debajo: "Every ZEUS counts. Every Guardian matters."
  (Rajdhani 600, italic, text-secondary)

COLUMNA DERECHA — El formulario:
  Panel con border cyan

  ┌── WALL INTEL ───────────────────────────────────────┐
  │  [Imagen muro 80x60px]  BATTLE #7 · $850K TARGET    │
  │  73% integrity · 4 Guardians · 0.5% from price      │
  │  "Your position: 100% ZEUS (wall is below price)"   │
  └─────────────────────────────────────────────────────┘

  AMOUNT TO DEPLOY:
  Label: "ZEUS AMOUNT"
  Input: grande, Share Tech Mono, placeholder "1,000,000"
  Sub-label: "Balance: 4,382,000 ZEUS  ≈ $3,712"
  Botón MAX alineado a la derecha del input

  ┌── POSITION PREVIEW ─────────────────────────────────┐
  │  You will add:   1,000,000 ZEUS  ≈ $847             │
  │  Wall range:     $848,200 — $853,100 MCAP           │
  │  Width:          1 tick (minimum, max fee efficiency)│
  │  Estimated APR:  ~284% (if price stays in range 50%)│
  │  Fee tier:       0.3%                               │
  └─────────────────────────────────────────────────────┘

  BOTONES (en 2 pasos, el primero desaparece tras approve):
  [STEP 1 — APPROVE ZEUS]  → btn-secondary (si no hay allowance)
  [STEP 2 — JOIN THE CITADEL ⚔] → btn-primary grande

  Disclaimer: "⚠ Concentrated liquidity risk: your position may convert
  to 100% ETH if price crosses the wall range."
  (Rajdhani 400, 12px, text-muted)
```

### Sección 4: BATTLE CHRONICLE (historial resumido)

**Referencia visual:** `designs/ref-battles-page.png`

```
ID: "battle"
TÍTULO: "BATTLE CHRONICLES" (Orbitron 700)
Subtítulo: "Every wall. Every breach. Every victory."

GRID: 3 columnas desktop / 2 tablet / 1 mobile
Gap: 24px

CARD DE BATALLA (por cada battle):
  ┌──────────────────────────────────┐
  │ [imagen muro 100%: wall-X.png]   │ ← altura fija 160px, object-fit cover
  │ [overlay resultado]              │
  ├──────────────────────────────────┤
  │ BATTLE #6                        │ Orbitron 400, text-muted
  │ 💀 CITADEL FALLEN                │ rojo, grande
  │ ──────────────────────────────── │
  │ TARGET     $1,200,000 MCAP       │ Share Tech Mono
  │ DURATION   14h 22m               │
  │ GUARDIANS  3 defenders           │
  │ FEES PAID  $234                  │
  ├──────────────────────────────────┤
  │ [VIEW BATTLE REPORT →]           │ btn-secondary pequeño
  └──────────────────────────────────┘

  Colores del borde:
  - FALLEN: var(--neon-red) con glow
  - HELD/DEMOLISHED: var(--neon-green)
  - ACTIVE: var(--neon-cyan) con pulse animation

[VER TODOS LAS BATALLAS →] → link a /battles
```

### Sección 5: GUARDIAN HALL OF FAME

**Referencia visual:** `designs/ref-hall-of-fame.png`

```
ID: "guardians"
TÍTULO: "GUARDIAN HALL OF FAME" (Orbitron 700, amber/gold)
Subtítulo: "All-time defenders"

TABS: [ FEES EARNED ★ | BATTLES | PEAK POSITION ]
  [Active tab: amber underline + texto amber]
  [Inactive: text-muted]

TABLA:
  Rank #1: fila con fondo rgba(255,183,0,0.06), border amber, crown icon 👑
  Rank #2: fila con fondo rgba(200,200,220,0.04), border plata
  Rank #3: fila con fondo rgba(180,120,60,0.04), border bronce

  Columnas:
    # (rank)
    ADDRESS (con link a /[addr], truncada)
    FEES EARNED / BATTLES / PEAK (según tab activo)
    BADGES (hexágonos mini 24px)

  [Mi posición si estoy fuera de top 10: fila al final resaltada en cyan]
```

### Sección 6: PRICE CHART

**Referencia visual:** `designs/ref-price-chart.png`

```
Evolución del chart de zeus-liquidity (LiquidityDepthChart existente)
Nuevas capas añadidas:

  1. Línea horizontal roja discontinua en el tick de la muralla activa
     Label: "THE WALL — $850K" flotando a la derecha
     Fondo rojo muy tenue debajo de la línea (overlay de peligro)

  2. En la vista de profundidad (depth chart):
     El tick de la muralla aparece como una barra muy alta (si hay liquidez)
     Color: cyan con glow intenso
     Tooltip al hover: "Citadel Wall — $14,400 TVL — 4 Guardians"

  3. Badge animado en el chart: "⚔ ACTIVE WALL" pulsante
```

## 5.2 PÁGINA `/battles` — Historial completo

**Referencia visual:** `designs/ref-battles-page.png`

```
HEADER: igual que homepage
HERO MINIMAL: título "BATTLE CHRONICLES", stats globales (total battles, total fees distributed, total guardians ever)

FILTERS:
  [ ALL ] [ ACTIVE ] [ FALLEN ] [ HELD ]
  Sort: [ NEWEST ] [ OLDEST ] [ BIGGEST ]

GRID DE CARDS (como en homepage pero más dense, 3-4 cols)
  Cada card: click → abre BattleReportModal

BATTLE REPORT MODAL:
  [ver ref-battle-report-modal.png]
  Overlay oscuro con blur
  Panel con borde rojo (si fallen) o verde (si held)

  ┌─ BATTLE REPORT #6 ─────────────────────────────────────────┐
  │ [wall-0.png 280x180px]     RESULT: CITADEL FALLEN          │
  │                            TARGET: $1.2M MCAP              │
  │                            DURATION: 14h 22m               │
  │                            BREACH: Price fell to $1,196,200│
  │                            FEES DISTRIBUTED: $234          │
  ├────────────────────────────────────────────────────────────┤
  │ TIMELINE OF EVENTS                                         │
  │ T+00:00  Wall deployed at $1.2M                           │
  │ T+02:14  First Guardian (0xf2c1) joined — $2,600          │
  │ T+06:30  Siege began (price within 5% of wall)            │
  │ T+11:48  Integrity fell to 50% — CRUMBLING                │
  │ T+13:55  Integrity fell to 25% — CRITICAL                 │
  │ T+14:22  BREACH DETECTED — Battle ended                   │
  ├────────────────────────────────────────────────────────────┤
  │ DEFENDERS                                                  │
  │ 1. 0x4a3b...  $4,200 liq  $134 fees  [LAST STAND][VET]    │
  │ 2. 0xf2c1...  $2,600 liq   $83 fees  [FIRST GUARDIAN]     │
  │ 3. 0x9de2...  $1,800 liq   $57 fees                       │
  └────────────────────────────────────────────────────────────┘
```

## 5.3 PÁGINA `/[address]` — Guardian Profile

**Referencia visual:** `designs/ref-guardian-profile.png`

```
LAYOUT: 2 columnas en desktop

COLUMNA IZQUIERDA:
  Avatar: hero-guardian.png circular 120px, borde neon del color de su badge más alto
  Address: truncada + botón Etherscan
  Rank: "#3 ALL TIME" si está en top 10 (amber)
  [Si es el usuario conectado: "You" badge]

  BADGES (grid 3x2, hex 72px):
    [badge-architect.png]     ARCHITECT     (con glow si es dinámico y activo ahora)
    [badge-first-guardian.png] FIRST GUARDIAN
    [badge-fee-harvester.png] FEE HARVESTER
    [badge-veteran.png]       VETERAN
    [placeholder oscuro]      SURVIVOR       (opaco si no tiene)
    [placeholder oscuro]      LAST STAND     (opaco si no tiene)
    [Hover en cualquier badge: tooltip con descripción del criterio]

COLUMNA DERECHA:
  COMBAT STATS (grid 2x3):
    BATTLES:            12
    BATTLES SURVIVED:   8
    TOTAL FEES:         $2,847.32
    PEAK POSITION:      $6,200 (Battle #7)
    TOTAL LIQ DEPLOYED: $34,200 all time
    CURRENT ACTIVE:     $6,200 in Battle #7

  ACTIVE POSITIONS:
    [Si tiene posición en muralla activa]
    Panel: "BATTLE #7 · $6,200 · Earning $2.34/h · [ACTIVE ●]"
    [Si usuario conectado: botón "Collect Fees"]

  BATTLE HISTORY:
    Tabla cronológica de participaciones:
    # | BATTLE | LIQ | RESULT | FEES | BADGES GANADOS
    7 | $850K  | $6,200 | ● ACTIVE | $423 | [A]
    6 | $1.2M  | $3,100 | 💀 FALLEN | $187 | [LS]
    5 | $900K  | $4,800 | 🛡 HELD   | $312 | [S]
```

## 5.4 PÁGINA `/admin` — Citadel Command

**Referencia visual:** `designs/ref-admin-panel.png`, `designs/ref-admin-deploy-flow.png`

```
AUTH GATE:
  Si no autenticado: pantalla de login
  ┌─────────────────────────────────────┐
  │  ⚡ CITADEL COMMAND                  │
  │  RESTRICTED ACCESS                  │
  │  ─────────────────────────────────  │
  │  PASSWORD:  [__________________]    │
  │  [AUTHENTICATE]                     │
  │                                     │
  │  [fondo: admin-bg.png con overlay]  │
  └─────────────────────────────────────┘
  Auth: sessionStorage.setItem('admin_token', sha256(password))
  Cada request: header x-admin-password: <password>

LAYOUT AUTENTICADO:
  Header: "⚡ CITADEL COMMAND" | [MAINNET ●] | [LOGOUT]
  Subheader: market intel strip (ZEUS: $847K, ETH: $3,241, 24h: -3.2%)

  ── SECCIÓN 1: DEPLOY NEW WALL ──────────────────────────────

  Label: "TARGET MARKET CAP (USD)"
  Input grande: "$ 850,000" (Share Tech Mono, 2rem)
  [Debajo del input en tiempo real al escribir:]

  PREVIEW PANEL:
    Tick Lower:  -204,360
    Tick Upper:  -204,300  (+60, 1 tick spacing)
    MCAP range:  $848,200 — $853,100 (~$5K width, 0.6%)
    ETH price:   0.000000261 ETH/ZEUS
    Distance:    -0.3% below current price ⚠
    [Si > 20% away: warning "Wall very far from current price"]
    [Si > 50% away: error "Wall too far. Are you sure?"]

  MINI DEPTH CHART:
    Reutiliza el LiquidityDepthChart existente en versión mini (300px height)
    Con la zona de la muralla marcada en rojo
    El tick objetivo señalado con línea discontinua roja
    [ver ref-price-chart.png concepto]

  BOTÓN: [⚡ DEPLOY CITADEL WALL] → btn grande amber
  [Si hay muralla activa: warning "This will demolish Wall #7 ($850K)"]
  [Confirmación modal antes de ejecutar]

  ── SECCIÓN 2: ACTIVE WALL ──────────────────────────────────

  Panel:
    WALL #7  ·  $850K MCAP  ·  Since: 2h 34m ago
    ████████████░░░░░░  73% integrity — CRUMBLING
    4 Guardians  ·  Peak: 2,847,392  ·  Current: 2,081,616
    currentTick: -203,940  (wall at -204,360, distance: +420 ticks)
    STATUS: BESIEGED — price approaching wall

    [DEMOLISH WALL] → btn-danger con confirmación modal

  Si no hay muralla activa:
    "No active wall deployed."

  ── SECCIÓN 3: BATTLE HISTORY ────────────────────────────────

  Tabla con todas las batallas:
  # | MCAP | RESULT | GUARDIANS | DURATION | FEES | DATE
  7 | $850K | ● ACTIVE | 4 | 2h 34m | - | now
  6 | $1.2M | 💀 FALLEN | 3 | 14h 22m | $234 | 3d ago
  5 | $900K | 🛡 HELD   | 7 | 3d 2h  | $1,240 | 5d ago

  Click en fila: expand inline el battle report
```

---

# PARTE VI: ANIMACIONES Y 3D — ESPECIFICACIÓN TÉCNICA

## 6.1 Stack de animaciones

| Tecnología | Usos |
|---|---|
| **Three.js + @react-three/fiber** | Muralla 3D, DataStorm hero, Bears attack |
| **@react-three/postprocessing** | Bloom, ChromaticAberration, Glitch |
| **framer-motion** | Page transitions, layout animations, scroll reveals |
| **CSS Animations / @keyframes** | Scanlines, glitch text, health bar, pulse, shake |
| **Canvas 2D** | Fallback de particles si no hay WebGL |
| **requestAnimationFrame** | Counter animations, custom effects |

## 6.2 Three.js — CitadelWall3D

**Archivo:** `components/citadel/CitadelWall3D.tsx`

La escena 3D es el elemento visual más importante.
Ocupa el área izquierda de la sección Active Battle.

### Geometría de la muralla

```
12 paneles rectangulares (BoxGeometry 2 × 3 × 0.3)
Dispuestos en grid 4 columnas × 3 filas
Separación entre paneles: 0.1 unidades (juntas)
Material: ShaderMaterial custom (ver shader en ANIMATIONS_AND_3D.md)

Adicionalmente:
- Base ground plane: PlaneGeometry, textura de grid
- Marco exterior: LineSegments (bordes del muro completo)
- Energy shield: IcosahedronGeometry detail=1, wireframe
```

### Sistema de luces

```
// Luz ambiental base (muy baja)
<ambientLight intensity={0.1} color="#060b18" />

// Luz principal desde el frente (cyan, proporcional a integrity)
<pointLight position={[0, 3, 6]} color="#00f5ff" intensity={integrity * 3} distance={20} />

// Luz secundaria desde atrás (azul oscuro)
<pointLight position={[0, 2, -6]} color="#0033ff" intensity={0.8} />

// Luz de ataque (roja, solo cuando siege/crumbling/critical)
<pointLight
  position={[-4 + sin(t)*2, 1, 3]}  // posición dinámica
  color="#ff2244"
  intensity={(1-integrity) * 4}
/>

// Rim light (magenta, siempre)
<pointLight position={[6, 4, 2]} color="#ff00aa" intensity={0.5} />
```

### Post-processing

```tsx
<EffectComposer>
  {/* Bloom: hace brillar los neons. Intensidad proporcional a integrity */}
  <Bloom
    luminanceThreshold={0.3}
    luminanceSmoothing={0.5}
    intensity={0.5 + integrity * 1.5}
    radius={0.8}
  />

  {/* ChromaticAberration: se activa en siege */}
  <ChromaticAberration
    offset={new Vector2(
      (1-integrity) * 0.004,
      (1-integrity) * 0.002
    )}
  />

  {/* Glitch: ráfagas en critical/fallen */}
  {integrity < 0.3 && (
    <Glitch
      delay={new Vector2(3, 6)}
      duration={new Vector2(0.3, 0.6)}
      strength={new Vector2(0.1, 0.3)}
    />
  )}

  {/* Vignette: siempre, más intenso en crítico */}
  <Vignette
    offset={0.3}
    darkness={0.5 + (1-integrity) * 0.5}
  />
</EffectComposer>
```

### Animación de paneles por estado

```typescript
// useFrame hook en cada WallPanel component
useFrame((state) => {
  const t = state.clock.getElapsedTime()
  const jitterSeed = index * 137.5  // cada panel diferente

  if (integrity >= 0.9) {
    // IMPENETRABLE: micro-vibración de energía, casi imperceptible
    mesh.rotation.z = Math.sin(t * 0.5 + jitterSeed) * 0.002
  }

  if (integrity < 0.7) {
    // BESIEGED: ligero desplazamiento de paneles dañados
    const damage = (0.7 - integrity) / 0.7
    if (index % 3 === 0) {  // cada tercer panel
      mesh.rotation.z = Math.sin(t * 1.5 + jitterSeed) * 0.04 * damage
      mesh.position.x += Math.sin(t * 2 + jitterSeed) * 0.005 * damage
    }
  }

  if (integrity < 0.45) {
    // CRUMBLING: paneles cayéndose
    const fall = (0.45 - integrity) / 0.45
    if (index % 2 === 0) {
      mesh.rotation.x = Math.sin(t * 0.8 + jitterSeed) * 0.1 * fall
      mesh.position.y -= 0.01 * fall  // caída gradual
    }
  }

  if (integrity < 0.2) {
    // CRITICAL: cámara tiembla
    camera.position.x = Math.sin(t * 15) * 0.05
    camera.position.y = Math.cos(t * 13) * 0.03
  }
})
```

## 6.3 Three.js — DataStorm (Hero background)

**Archivo:** `components/citadel/DataStorm.tsx`

```tsx
// 200 columnas de texto "cayendo" (instanced)
// Cada columna: 15-20 caracteres hex que caen de arriba a abajo
// Velocidades variadas (2-6 unidades/s)
// Colores: #00f5ff al 15-40% opacity
// Primeros 3 chars de cada columna más brillantes (cabeza de la columna)

// 300 particles flotantes
// PointsMaterial, size 0.03, color #00f5ff
// Movimiento browniano (Perlin noise)
// Las cercanas a la posición del mouse se repelen (mousemove → raycaster)

// Grid plane
// 20x20 unidades, 40x40 divisiones
// Color: rgba(0,245,255,0.05)
// Animación: float up/down 0.3 unidades, 8s cycle
```

## 6.4 Animaciones CSS críticas

### Scanlines (global)
```css
/* En index.css, afecta toda la app */
body::before {
  content: '';
  position: fixed; inset: 0; z-index: 9999; pointer-events: none;
  background: repeating-linear-gradient(
    0deg, transparent 0px, transparent 3px,
    rgba(0,245,255,0.012) 3px, rgba(0,245,255,0.012) 4px
  );
}
```

### Glitch Text (títulos)
```css
/* Aplicado a .text-glitch */
/* Dos pseudo-elementos con clip-path animado en cyan y magenta */
/* Dispara solo en: carga, breach, deploy */
/* Frecuencia en idle: 1 glitch cada 8-12 segundos */
```

### Siege Pulse (borde de panel)
```css
@keyframes siege-pulse {
  0%, 100% { box-shadow: 0 0 0 1px rgba(255,34,68,0.3), 0 0 10px rgba(255,34,68,0.1); }
  50%       { box-shadow: 0 0 0 2px rgba(255,34,68,0.7), 0 0 25px rgba(255,34,68,0.3),
                          inset 0 0 20px rgba(255,34,68,0.05); }
}
```

### Wall Shake (crumbling/critical)
```css
/* Aplicado al contenedor de la imagen del muro */
/* crumbling: 0.6s, amplitude 2px, rotation 0.2deg */
/* critical: 0.3s, amplitude 4px, rotation 0.4deg, continuo */
```

### Data Rain (fallback CSS)
```css
/* 40 columnas de caracteres hex cayendo */
/* Generadas por DataRain.tsx component */
/* Cada columna: duración 3-8s, delay negativo random */
/* Characters actualizados via JS setInterval cada 150ms */
```

### Health Bar
```css
/* Gradient + scan light + flicker según estado */
/* Transición de color en 0.5s cuando cambia estado */
/* Scan: luz blanca de 40px que recorre la barra en 2s */
```

## 6.5 Secuencias de Animación de Eventos

### BREACH (caída de muralla) — 3,200ms

```
0ms      → El servidor retorna status='fallen' en el poll de 30s
           → ReactQuery detecta el cambio de estado

50ms     → Glitch INTENSO: el panel de Active Battle hace clip-path glitch
           (500ms, muy agresivo, chromatic aberration máxima)

300ms    → Flash rojo global: <div position:fixed inset:0 z-index:9997
           background:rgba(255,0,0,0.25) pointer-events:none>
           Dura 200ms, fade out 300ms

500ms    → En Three.js:
           → Explosión de partículas rojas desde el centro de la muralla
           → Los paneles del muro se dispersan con velocidades random
           → La cámara hace un violento shake durante 800ms

700ms    → Wall image (2D fallback):
           → scaleY anima de 1 → 0.05 en 200ms (el muro se "aplasta")
           → Crossfade a wall-0.png (opacity 0→1 en 400ms)
           → Overlay: "BREACHED" en rojo translúcido

1000ms   → Toast especial: "CITADEL FALLEN — Battle #7" con skull, dura 8s

1200ms   → Ash particles CSS empiezan a caer (fade in 600ms)

1500ms   → Battle Report aparece:
           → Title "CITADEL FALLEN" con glitch animation entra desde arriba
           → El panel de battle report hace slideInUp
           → Las líneas del report aparecen una a una (50ms delay cada línea)
           → Badges de LAST_STAND aparecen con badge-reveal animation

2500ms   → "AWAITING NEW DEPLOYMENT..." aparece con fade in + spinner

3200ms   → Animación completamente estable. El usuario ve las ruinas + report.
```

### DEPLOY (nueva muralla) — 2,500ms

```
0ms      → POST /api/citadel/wall retorna 200

100ms    → Flash cyan global: rgba(0,245,255,0.15) durante 300ms

300ms    → En Three.js (si la escena estaba en modo ruins/none):
           → Los escombros/vacío se disuelven (fade out 400ms)
           → Los paneles del nuevo muro ENTRAN de abajo a arriba
             con delays escalonados (50ms entre cada panel)

400ms    → Toast: "NEW CITADEL WALL DEPLOYED — Battle #8 · $800K" con cyan glow

600ms    → El título de la sección cambia: glitch + "BATTLE #8 — ACTIVE"

800ms    → Health bar se llena de 0% a 100% en 800ms (ease-out)

1200ms   → Energy shield (icosahedron) aparece con spin-in:
           scale 0→1 + rotation 720° en 600ms

1500ms   → Particle streams de energía cyan empiezan a ascender

2000ms   → Stats panel aparece con slideInRight

2500ms   → Escena completamente estable. Glitch positivo final en el título.
```

### GUARDIAN JOIN — 800ms

```
0ms      → POST /api/citadel/guardian/join retorna

100ms    → En Three.js: energy beam cyan sube por el lado de la muralla
           (línea que asciende de abajo a arriba en 600ms)

200ms    → War Room: nueva fila aparece con:
           background highlight cyan que dura 2s, luego fade a normal

300ms    → Toast standard: "Guardian Registered! You are now defending Battle #7"

Si is_first_guardian:
400ms    → Toast especial épico:
           badge-first-guardian.png con badge-reveal animation
           "⚡ FIRST GUARDIAN — You were the first to defend this wall!"
           Dura 6s
```

---

# PARTE VII: BASE DE DATOS — SCHEMA COMPLETO

## 7.1 Creación del schema

```sql
-- Se ejecuta en ensureCitadelSchema() al inicio de cada API citadel
CREATE SCHEMA IF NOT EXISTS citadel;
```

## 7.2 Tablas con todos los campos

```sql
-- ── MURALLAS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS citadel.walls (
  id              SERIAL PRIMARY KEY,
  tick_lower      INTEGER NOT NULL,
  tick_upper      INTEGER NOT NULL,    -- SIEMPRE tick_lower + 60
  mcap_usd        NUMERIC(20,2) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'fallen', 'demolished')),
  peak_liquidity  TEXT,                -- bigint como string (puede ser > MAX_INT)
  fallen_at       TIMESTAMPTZ,
  demolished_at   TIMESTAMPTZ,
  notes           TEXT                 -- notas del admin (opcional)
);

CREATE INDEX IF NOT EXISTS idx_citadel_walls_status
  ON citadel.walls(status);

-- ── BATALLAS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS citadel.battles (
  id              SERIAL PRIMARY KEY,
  wall_id         INTEGER NOT NULL REFERENCES citadel.walls(id),
  result          TEXT NOT NULL
                  CHECK (result IN ('fallen', 'demolished', 'held')),
  peak_liquidity  TEXT,
  guardian_count  INTEGER NOT NULL DEFAULT 0,
  total_fees_usd  NUMERIC(20,6) DEFAULT 0,
  breach_mcap_usd NUMERIC(20,2),       -- MCAP en el momento del breach (si fallen)
  breach_tick     INTEGER,             -- tick actual en el breach
  ended_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citadel_battles_wall
  ON citadel.battles(wall_id);
CREATE INDEX IF NOT EXISTS idx_citadel_battles_result
  ON citadel.battles(result);

-- ── PRIMER GUARDIAN POR MURALLA ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS citadel.first_guardians (
  wall_id         INTEGER PRIMARY KEY REFERENCES citadel.walls(id),
  address         TEXT NOT NULL,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citadel_fg_address
  ON citadel.first_guardians(address);

-- ── PARTICIPACIÓN DE GUARDIANS POR BATALLA ───────────────────────────
CREATE TABLE IF NOT EXISTS citadel.guardian_battles (
  id              SERIAL PRIMARY KEY,
  address         TEXT NOT NULL,
  wall_id         INTEGER NOT NULL REFERENCES citadel.walls(id),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_last_stand   BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(address, wall_id)             -- un guardian, una entrada por muralla
);

CREATE INDEX IF NOT EXISTS idx_citadel_gb_address
  ON citadel.guardian_battles(address);
CREATE INDEX IF NOT EXISTS idx_citadel_gb_wall
  ON citadel.guardian_battles(wall_id);
CREATE INDEX IF NOT EXISTS idx_citadel_gb_joined
  ON citadel.guardian_battles(wall_id, joined_at DESC);
```

## 7.3 Queries más importantes

```sql
-- Muralla activa actual
SELECT * FROM citadel.walls WHERE status = 'active' ORDER BY created_at DESC LIMIT 1;

-- Guardianes de una muralla, ordenados por join time
SELECT * FROM citadel.guardian_battles
WHERE wall_id = $1
ORDER BY joined_at ASC;

-- Stats de un guardian
SELECT
  COUNT(DISTINCT gb.wall_id) as battles_count,
  COUNT(DISTINCT gb.wall_id) FILTER (WHERE b.result IN ('held','demolished')) as battles_survived,
  BOOL_OR(fg.address IS NOT NULL) as has_first_guardian,
  BOOL_OR(gb.is_last_stand) as has_last_stand,
  COUNT(DISTINCT gb.wall_id) FILTER (WHERE b.result IN ('held','demolished')) > 0 as has_survivor
FROM citadel.guardian_battles gb
LEFT JOIN citadel.battles b ON b.wall_id = gb.wall_id
LEFT JOIN citadel.first_guardians fg ON fg.wall_id = gb.wall_id AND fg.address = gb.address
WHERE gb.address = $1;

-- Últimos 3 en unirse a una muralla (para LAST_STAND)
SELECT address FROM citadel.guardian_battles
WHERE wall_id = $1
ORDER BY joined_at DESC
LIMIT 3;
```

---

# PARTE VIII: APIs — ESPECIFICACIÓN COMPLETA

## GET /api/citadel/wall

```typescript
// Response completa
{
  wall: {
    id: number
    tick_lower: number
    tick_upper: number
    mcap_usd: number
    created_at: string
    status: 'active' | 'fallen' | 'demolished'
    peak_liquidity: string | null
    fallen_at: string | null
  } | null,
  integrity: number,              // 0-100
  state: WallState,               // 'impenetrable'|'besieged'|'crumbling'|'critical'|'fallen'|'none'
  wall_image: string,             // '/wall-100.png'|'/wall-75.png'|etc.
  current_tick: number,
  current_mcap: number,           // MCAP actual del pool (calculado del tick actual)
  distance_pct: number,           // % entre precio actual y muralla (negativo = por debajo)
  distance_usd: number,           // diferencia en USD de MCAP
  guardian_count: number,
  total_liquidity_usd: number,
  is_siege: boolean,              // distance_pct <= 5%
  guardians: Guardian[],          // lista para el War Room
  architect_address: string | null  // address con mayor liquidez activa
}

// Lógica de detección de breach en el handler:
// 1. Lee muralla activa
// 2. Llama getCurrentPoolTick() (ya existe en zeus-liquidity)
// 3. Si currentTick < wall.tick_lower && wall.status === 'active':
//    → UPDATE wall status='fallen'
//    → INSERT battle result='fallen'
//    → Calcular LAST_STAND: los 3 últimos en guardian_battles
//    → UPDATE is_last_stand=TRUE para esos 3
// 4. Retorna estado actualizado
```

## POST /api/citadel/wall

```typescript
// Auth: header x-admin-password debe coincidir con ADMIN_PASSWORD env var

// Request body:
{ mcap_usd: number }

// Lógica:
// 1. Verificar auth → 401 si falla
// 2. Obtener ETH price y ZEUS totalSupply (ya existente en zeus-liquidity)
// 3. tick_lower = mcapToTick(mcap_usd, ethPrice, totalSupply)
// 4. tick_upper = tick_lower + 60
// 5. Si hay muralla activa → UPDATE status='demolished', INSERT battle result='demolished'
// 6. INSERT INTO citadel.walls (tick_lower, tick_upper, mcap_usd)
// 7. Retornar la nueva wall

// Response:
{ wall: CitadelWall, demolished_previous: boolean }
```

## DELETE /api/citadel/wall/[id]

```typescript
// Auth: header x-admin-password

// Lógica:
// 1. Verificar auth
// 2. Verificar que la wall existe y status='active'
// 3. UPDATE status='demolished', demolished_at=NOW()
// 4. INSERT INTO citadel.battles (wall_id, result='demolished', ...)

// Response:
{ success: true, battle_id: number }
```

## GET /api/citadel/battles

```typescript
// Query params: ?limit=20&offset=0&result=fallen|held|demolished|all

// Response:
{
  battles: Array<{
    id: number
    wall_id: number
    result: 'fallen' | 'demolished' | 'held'
    peak_liquidity: string
    guardian_count: number
    total_fees_usd: number
    breach_mcap_usd: number | null
    ended_at: string
    duration_ms: number   // calculado: ended_at - wall.created_at
    wall: {
      tick_lower: number
      tick_upper: number
      mcap_usd: number
      created_at: string
    }
    defenders: Array<{
      address: string
      joined_at: string
      is_last_stand: boolean
      is_first_guardian: boolean
    }>
  }>,
  total: number
}
```

## GET /api/citadel/guardian/[addr]

```typescript
// Response:
{
  address: string,

  // Stats de citadel (nuevas)
  battles_count: number,
  battles_survived: number,
  battles_fallen: number,
  guardian_battles: Array<{
    wall_id: number
    mcap_usd: number
    joined_at: string
    is_last_stand: boolean
    is_first_guardian: boolean
    battle_result: 'fallen' | 'demolished' | 'held' | null  // null si activa
  }>,

  // Badges
  badges: {
    architect: boolean,      // dinámico
    first_guardian: boolean, // permanente
    fee_harvester: boolean,  // dinámico
    veteran: boolean,        // permanente (>= 5 battles)
    survivor: boolean,       // permanente
    last_stand: boolean,     // permanente
  },

  // Stats de zeus-liquidity (reutilizadas)
  fees_total_usd: number,
  fees_pending_usd: number,
  peak_position_usd: number,
  positions: ZeusPosition[]
}
```

## POST /api/citadel/guardian/join

```typescript
// Request:
{ address: string, wall_id: number, tx_hash: string }

// Lógica:
// 1. Verificar que wall existe y status='active'
// 2. INSERT INTO citadel.guardian_battles (address, wall_id) ON CONFLICT DO NOTHING
// 3. Si es el primero en ese wall_id:
//    INSERT INTO citadel.first_guardians (wall_id, address) ON CONFLICT DO NOTHING
// 4. Retornar

// Response:
{
  registered: boolean,
  is_first_guardian: boolean,
  guardian_count: number  // total en esta muralla ahora
}
```

---

# PARTE IX: COMPONENTES — ÁRBOL COMPLETO

## 9.1 Nuevos componentes

```
components/
├── citadel/
│   ├── ActiveBattle.tsx          ← Sección central: 4 estados (A/B/C/D)
│   ├── CitadelWall3D.tsx         ← Escena Three.js de la muralla
│   ├── DataStorm.tsx             ← Escena Three.js del hero background
│   ├── DataRain.tsx              ← Fallback CSS data rain
│   ├── WallHealthBar.tsx         ← Barra de integridad animada
│   ├── WallImage.tsx             ← Imagen 2D del muro según estado (fallback)
│   ├── SiegePulse.tsx            ← Wrapper con borde rojo pulsante
│   ├── WarRoom.tsx               ← Tabla de guardians activos
│   ├── JoinCitadelForm.tsx       ← Form de unirse a la muralla
│   ├── BattleHistory.tsx         ← Grid de cards de batallas (resumido)
│   ├── BattleCard.tsx            ← Card individual de batalla
│   ├── BattleReportModal.tsx     ← Modal con el reporte completo
│   ├── GuardianBadges.tsx        ← Display de badges hexagonales
│   ├── BadgeTooltip.tsx          ← Tooltip con descripción del badge
│   └── GuardianHall.tsx          ← Leaderboard all-time con tabs
│
├── layout/
│   ├── Header.tsx                ← Modificado: MCAP pill + scroll effects
│   └── ScrollProgress.tsx        ← Barra de progreso de scroll
│
└── ui/
    └── AnimatedCounter.tsx        ← Número con counter animation

hooks/
├── useCitadelWall.ts             ← useQuery para wall status, polling 30s
├── useCitadelBattles.ts          ← useQuery para historial de batallas
├── useGuardianProfile.ts         ← useQuery para perfil + badges
├── useWallComposition.ts         ← Calcula composición ETH/ZEUS según tick
└── useGPUTier.ts                 ← Detecta capacidad GPU para fallbacks

lib/
├── citadel/
│   ├── wallIntegrity.ts          ← getWallIntegrity(), getWallState()
│   ├── wallImage.ts              ← stateToImage(), integrityToState()
│   └── badgeCalculator.ts        ← calculateBadges(address)
└── db.ts                         ← MODIFICADO: añade ensureCitadelSchema()

app/
├── page.tsx                      ← REESCRITO: nuevo layout cyberpunk
├── admin/
│   └── page.tsx                  ← NUEVO: backoffice con auth
├── battles/
│   └── page.tsx                  ← NUEVO: historial completo
├── [address]/
│   └── page.tsx                  ← MODIFICADO: añade badges + citadel stats
└── api/
    └── citadel/
        ├── wall/
        │   ├── route.ts          ← GET + POST
        │   └── [id]/
        │       └── route.ts      ← DELETE
        ├── battles/
        │   └── route.ts          ← GET
        └── guardian/
            ├── [addr]/
            │   └── route.ts      ← GET profile + badges
            └── join/
                └── route.ts      ← POST
```

## 9.2 Componentes existentes modificados

```
app/globals.css                   ← Nueva paleta completa, fuentes, animaciones
app/layout.tsx                    ← Nuevas fuentes (Orbitron, Rajdhani, Share Tech Mono)
lib/db.ts                         ← Añade ensureCitadelSchema()
components/liquidity/
  LiquidityDepthChart.tsx         ← Añade línea/zona de la muralla activa
components/positions/
  PositionsList.tsx                ← Indica si una posición es la muralla activa
components/ui/
  FeeLeaderboard.tsx               ← Añade badges mini al lado de cada address
```

---

# PARTE X: PLAN DE DESARROLLO — FASES

## FASE 0: Setup (día 1)

```
[ ] Crear repo gotoalberto/helm en GitHub (CLI o web)
[ ] Copiar zeus-liquidity como base: cp -r zeus-liquidity helm
[ ] cd helm && git init && git remote add origin ...
[ ] npm install
[ ] npm install three @react-three/fiber @react-three/drei @react-three/postprocessing framer-motion
[ ] Vincular proyecto Vercel: vercel link (seleccionar proyecto helm)
[ ] Extraer env vars de zeus-liquidity:
    vercel env pull .env.local --project zeus-liquidity (o equivalente)
[ ] Añadir todas las env vars al proyecto helm en Vercel via CLI
[ ] Añadir ADMIN_PASSWORD
[ ] Copiar todos los assets de zeus-liquidity/public/* al nuevo proyecto
[ ] Copiar designs/* al nuevo proyecto
[ ] Verificar: npm run dev arranca sin errores
[ ] Verificar: npm test (17 tests de mcap pasan)
```

## FASE 1: BD y APIs base (días 2-3)

```
[ ] Añadir ensureCitadelSchema() a lib/db.ts con las 4 tablas
[ ] Test manual: arrancar dev, verificar que el schema se crea en PostgreSQL
[ ] Implementar GET /api/citadel/wall
    [ ] Leer muralla activa
    [ ] Calcular integridad
    [ ] Detectar breach automáticamente
    [ ] Retornar wall_image basado en estado
[ ] Implementar POST /api/citadel/wall (con auth)
    [ ] Verificar ADMIN_PASSWORD
    [ ] Usar mcapToTick existente
    [ ] Demoler anterior si existe
[ ] Implementar DELETE /api/citadel/wall/[id] (con auth)
[ ] Implementar GET /api/citadel/battles
[ ] Implementar POST /api/citadel/guardian/join
[ ] Implementar GET /api/citadel/guardian/[addr]
    [ ] Cálculo de todos los badges
[ ] Tests con curl/Postman de todos los endpoints
```

## FASE 2: Diseño base — CSS y globals (días 3-4)

```
[ ] Actualizar app/globals.css:
    [ ] Nueva paleta completa de variables CSS
    [ ] Nuevas fuentes (Orbitron, Rajdhani, Share Tech Mono)
    [ ] Componentes base: .panel, .btn-primary, .btn-secondary, .input-citadel
    [ ] .badge-hex (hexagonal clip-path)
    [ ] Scanlines global
    [ ] Animaciones: @keyframes para glitch, siege-pulse, wall-shake, neon-pulse
    [ ] Data rain CSS
    [ ] Health bar styles
[ ] Actualizar app/layout.tsx:
    [ ] Importar nuevas Google Fonts
    [ ] Actualizar metadata (título, descripción)
```

## FASE 3: Header y estructura de página (día 4)

```
[ ] Reescribir Header.tsx:
    [ ] Nueva estética (Logo ⚡ CITADEL en Orbitron)
    [ ] MCAP pill en centro
    [ ] Wallet button estilizado
    [ ] Scroll height transition
[ ] ScrollProgress.tsx (barra de progreso bajo el header)
[ ] Estructura base de app/page.tsx (secciones con IDs)
[ ] Verificar scroll navigation funciona
```

## FASE 4: Active Battle Section (días 5-7)

```
[ ] WallHealthBar.tsx
    [ ] Barra animada con gradiente dinámico
    [ ] Scan light animación
    [ ] Flicker según estado
[ ] WallImage.tsx (fallback 2D)
    [ ] Selecciona imagen según integrity
    [ ] Animaciones: shake-critical, ash-particles
[ ] hooks/useCitadelWall.ts
    [ ] useQuery con polling 30s
    [ ] Detecta cambios de estado para disparar animaciones
[ ] ActiveBattle.tsx
    [ ] 4 estados: A (intact), B (siege), C (fallen), D (none)
    [ ] Stats grid con animated counters
    [ ] Ticker de actividad en siege mode
    [ ] Battle Report en fallen
[ ] SiegePulse.tsx (wrapper con borde pulsante)
[ ] AnimatedCounter.tsx hook + component
```

## FASE 5: Three.js — Muralla 3D (días 8-10)

```
[ ] Instalar y configurar @react-three/fiber
[ ] WallPanel.tsx (geometría de un panel)
    [ ] ShaderMaterial custom con energy lines
    [ ] Animaciones por integrity
[ ] CitadelWall3D.tsx
    [ ] Escena completa con 12 paneles
    [ ] Sistema de luces dinámico
    [ ] EnergyShield (icosahedron wireframe)
    [ ] Particle streams (energía ascendente)
    [ ] Debris particles (crumbling/critical)
[ ] Postprocessing: Bloom, ChromaticAberration, Glitch, Vignette
[ ] useGPUTier.ts + fallback a WallImage.tsx
[ ] Integrar en ActiveBattle.tsx
```

## FASE 6: Three.js — Hero DataStorm (días 10-11)

```
[ ] DataStorm.tsx
    [ ] Columnas de texto hex cayendo (instanced)
    [ ] Floating particles con movimiento browniano
    [ ] Grid plane flotante
    [ ] Interacción con mouse (repulsión de partículas)
[ ] DataRain.tsx (fallback CSS puro)
[ ] Integrar en Hero section de page.tsx
```

## FASE 7: War Room y Join Form (días 11-12)

```
[ ] WarRoom.tsx
    [ ] Tabla con guardians de la muralla activa
    [ ] Badges mini hexagonales
    [ ] Highlight del usuario conectado
    [ ] Animación de entrada de filas
[ ] hooks/useWallComposition.ts
    [ ] Calcula si 100% ZEUS, 100% ETH, o mixed
[ ] JoinCitadelForm.tsx
    [ ] Wall Intel panel (mini imagen + stats)
    [ ] Input ZEUS con MAX button
    [ ] Preview panel con posición estimada
    [ ] Two-step: Approve → Join
    [ ] Animación de éxito + badge reveal si FIRST GUARDIAN
    [ ] Integrar con PositionManager (reutilizar AddLiquidityForm existente)
```

## FASE 8: Battle History y leaderboards (días 13-14)

```
[ ] BattleCard.tsx
[ ] BattleHistory.tsx (grid resumido en homepage)
[ ] BattleReportModal.tsx (modal completo con timeline)
[ ] app/battles/page.tsx (página completa)
[ ] GuardianHall.tsx (hall of fame con 3 tabs)
[ ] hooks/useCitadelBattles.ts
```

## FASE 9: Guardian Profile y Badges (días 15-16)

```
[ ] GuardianBadges.tsx
    [ ] 6 badges hexagonales
    [ ] Opacidad reducida si no tiene el badge
    [ ] Tooltip con descripción al hover
    [ ] badge-reveal animation para badges nuevos
    [ ] Crown/sparkle en badges dinámicos activos
[ ] BadgeTooltip.tsx
[ ] hooks/useGuardianProfile.ts
[ ] Actualizar app/[address]/page.tsx
    [ ] Columna izquierda: avatar + badges
    [ ] Columna derecha: stats + historial de batallas
```

## FASE 10: Admin Backoffice (días 17-18)

```
[ ] app/admin/page.tsx
    [ ] Auth gate: formulario de password
    [ ] sessionStorage para token
    [ ] Deploy section con input MCAP + preview en tiempo real
    [ ] Mini depth chart con zona marcada
    [ ] Active wall status
    [ ] Demolish button con confirmación
    [ ] Battle history tabla
[ ] Modal de confirmación de deploy
[ ] Modal de confirmación de demolish
[ ] Integrar con APIs citadel
```

## FASE 11: Animaciones de eventos (días 19-20)

```
[ ] Secuencia BREACH (3,200ms):
    [ ] Flash rojo global
    [ ] Glitch intenso en panel
    [ ] Three.js: explosión + paneles dispersos
    [ ] Crossfade a wall-0.png
    [ ] Ash particles
    [ ] Battle Report reveal
[ ] Secuencia DEPLOY (2,500ms):
    [ ] Flash cyan
    [ ] Three.js: construcción de paneles
    [ ] Health bar fill
    [ ] Shield spin-in
[ ] Secuencia JOIN (800ms):
    [ ] Energy beam en Three.js
    [ ] War Room row highlight
    [ ] Toast normal / toast épico FIRST GUARDIAN
[ ] Page transitions con framer-motion
[ ] Scroll reveal con IntersectionObserver
```

## FASE 12: Price Chart con Wall (día 21)

```
[ ] Actualizar LiquidityDepthChart.tsx:
    [ ] Línea horizontal en el tick de la muralla
    [ ] Label "THE WALL — $850K"
    [ ] Zona roja debajo de la línea
    [ ] En depth view: spike cyan en el tick de la muralla
    [ ] Tooltip: "Citadel Wall — $14,400 TVL"
```

## FASE 13: Polish y mobile (días 22-23)

```
[ ] Responsive completo: hero, active battle, war room, forms
[ ] Toast system cyberpunk (custom sobre sonner)
[ ] prefers-reduced-motion: desactivar animaciones
[ ] Loading skeletons cyberpunk
[ ] Error states cyberpunk
[ ] Empty states cyberpunk
[ ] Favicon y meta tags actualizados
```

## FASE 14: Deploy y verificación (días 24-25)

```
[ ] Build de producción: npm run build (sin errores TypeScript)
[ ] Tests: npm test (17 tests mcap + nuevos si se añaden)
[ ] Push a GitHub: git push origin main
[ ] Vercel auto-deploy
[ ] Playwright: screenshots de todas las pantallas
[ ] Verificar:
    [ ] Homepage carga (muralla activa si existe)
    [ ] Admin funciona (/admin con ADMIN_PASSWORD)
    [ ] Deploy de muralla funciona
    [ ] Join flow funciona (con wallet de prueba)
    [ ] Battles page carga
    [ ] Guardian profile carga
    [ ] Three.js no crashea
    [ ] Mobile: todas las pantallas usables
[ ] Añadir ADMIN_PASSWORD en Vercel production env
```

---

# PARTE XI: ASSETS GRÁFICOS GENERADOS

Todos los assets están en `~/git/zeus-liquidity/public/` y se copiarán a `~/git/helm/public/`.

## Assets de juego (muralla)

| Archivo | Descripción | Estado |
|---|---|---|
| `wall-100.png` | Muro intacto, cyan brillante, shields activos | ✅ |
| `wall-75.png` | Muro besieged, fisuras, chispas | ✅ |
| `wall-50.png` | Muro crumbling, fuego, alarmas rojas | ✅ |
| `wall-25.png` | Muro critical, escombros, ruinas | ✅ |
| `wall-0.png` | Muro fallen, ruinas totales, cielo rojo | ✅ |

## Assets de identidad

| Archivo | Descripción | Estado |
|---|---|---|
| `citadel-logo.png` | Logo CITADEL PROTOCOL / DEFEND THE PRICE | ✅ |
| `hero-bg.png` | Fondo hero: la Citadel en la ciudad | ✅ |
| `hero-guardian.png` | Personaje Guardian con armadura | ✅ |
| `villain-bears.png` | Los bears atacando | ✅ |
| `rally-poster.png` | Cartel de reclutamiento | ✅ |
| `admin-bg.png` | Fondo sala de comando | ✅ |

## Assets de badges

| Archivo | Badge | Criterio | Estado |
|---|---|---|---|
| `badge-architect.png` | ARCHITECT | Mayor LP activo | ✅ |
| `badge-first-guardian.png` | FIRST GUARDIAN | Primero en la muralla | ✅ |
| `badge-fee-harvester.png` | FEE HARVESTER | Top 1 fees históricas | ✅ |
| `badge-veteran.png` | VETERAN | 5+ batallas | ✅ |
| `badge-survivor.png` | SURVIVOR | Muralla aguantó | ⬜ pendiente |
| `badge-last-stand.png` | LAST STAND | Último en reforzar antes de caída | ⬜ pendiente |

## Diseños de referencia (en `/designs/`)

| Archivo | Descripción | Estado |
|---|---|---|
| `ref-homepage-intact.png` | Homepage con muralla intacta | ✅ |
| `ref-homepage-siege.png` | Homepage en siege mode | ✅ |
| `ref-homepage-fallen.png` | Homepage caída | ✅ |
| `ref-join-form.png` | Formulario de join | ✅ |
| `ref-guardian-profile.png` | Perfil de Guardian | ✅ |
| `ref-battles-page.png` | Página de batallas | ✅ |
| `ref-admin-panel.png` | Panel de admin | ✅ |
| `ref-mobile.png` | Vista mobile | ✅ |
| `ref-war-room.png` | War Room leaderboard | ✅ |
| `ref-battle-report-modal.png` | Modal battle report | ✅ |
| `ref-health-bars.png` | Health bars diseño | ✅ |
| `ref-hall-of-fame.png` | Hall of Fame | ✅ |
| `ref-3d-wall-scene.png` | Escena Three.js | ✅ |
| `ref-price-chart.png` | Chart con muralla | ✅ |
| `ref-toasts.png` | Sistema de toasts | ✅ |
| `ref-admin-deploy-flow.png` | Flujo deploy admin | ✅ |

---

## RESUMEN EJECUTIVO

**Qué es:** CITADEL PROTOCOL es una dApp de juego DeFi con estética cyberpunk
construida sobre zeus-liquidity. Los usuarios proveen liquidez concentrada (1 tick)
en Uniswap V4 para "defender" el precio de ZEUS en un MCAP objetivo definido por el admin.

**Stack técnico:** Next.js 16, TypeScript, Tailwind v4, wagmi v3 + viem,
Three.js + @react-three/fiber, framer-motion, PostgreSQL (schema `citadel`),
Alchemy RPC, CoinGecko API, Vercel deploy.

**Mismas API keys:** Extraídas de Vercel del proyecto zeus-liquidity.
Misma PostgreSQL, schema separado `citadel`.
Nueva env var: solo `ADMIN_PASSWORD`.

**Lo más importante visualmente:**
- Muralla 3D en Three.js con shader GLSL custom que se deteriora en tiempo real
- 5 estados visuales de la muralla con transiciones épicas
- Secuencia de breach de 3.2 segundos (flash, colapso, ruinas, report)
- DataStorm WebGL en el hero
- Scanlines, glitch text, neon pulses, health bar animada
- Paleta: negro (#03050f) + neon cyan (#00f5ff) + amber (#ffb700) + rojo (#ff2244)
- Fuentes: Orbitron + Rajdhani + Share Tech Mono

**Lo más importante mecánicamente:**
- El admin define la muralla en MCAP (se convierte a tick internamente, nunca visible al usuario)
- La "vida" de la muralla = liquidez actual / pico máximo histórico de liquidez
- La caída se detecta automáticamente: currentTick < wall.tickLower
- 6 badges basados en comportamiento real on-chain
- La muralla siempre es de 1 tick de ancho (tickSpacing=60 = 0.6% de ancho de precio)

---

*CITADEL PROTOCOL — MASTER PLAN v2.0*
*Fecha: Marzo 2026*
