# CITADEL PROTOCOL — Game Design Document (GDD)
# Version 1.0 — Full Detail

---

## TABLA DE CONTENIDOS

1. [Concepto y Universo](#1-concepto-y-universo)
2. [Vocabulario del Juego](#2-vocabulario-del-juego)
3. [La Mecanica Central: La Muralla](#3-la-mecanica-central-la-muralla)
4. [El Backoffice — Citadel Command](#4-el-backoffice--citadel-command)
5. [La Pagina Principal — Estado de la Batalla](#5-la-pagina-principal--estado-de-la-batalla)
6. [Unirse a la Muralla — Join the Citadel](#6-unirse-a-la-muralla--join-the-citadel)
7. [Perfiles de Guardian](#7-perfiles-de-guardian)
8. [Historial de Batallas](#8-historial-de-batallas)
9. [Sistema de Badges](#9-sistema-de-badges)
10. [Leaderboards y Rankings](#10-leaderboards-y-rankings)
11. [Flujos de Usuario Completos](#11-flujos-de-usuario-completos)
12. [Diseno Visual — Guia de Estilo](#12-diseno-visual--guia-de-estilo)
13. [Bocetos de Pantallas](#13-bocetos-de-pantallas)
14. [Arquitectura Tecnica](#14-arquitectura-tecnica)
15. [Base de Datos — Schema Completo](#15-base-de-datos--schema-completo)
16. [APIs — Especificacion Completa](#16-apis--especificacion-completa)
17. [Componentes UI — Lista Completa](#17-componentes-ui--lista-completa)

---

## 1. CONCEPTO Y UNIVERSO

### El Mundo

En el universo de CITADEL PROTOCOL, los mercados de criptomonedas son campos de batalla digitales.
El precio de ZEUS no es solo un numero — es el territorio de una ciudad-fortaleza: **La Citadel**.

Los **bears** (vendedores, shorters, atacantes) son facciones oscuras que empujan el precio hacia abajo,
tratando de destruir la Citadel y devastar la ciudad que vive dentro de ella.

Los **Guardians** son los holders que no solo aguantan — actuan. Ponen ETH y ZEUS como liquidez
concentrada en un tick especifico, construyendo murallas fisicas de energia que absorben cada ataque.
Cada swap que pasa por su posicion es una horda rebotada. Cada fee cobrada es botin de guerra.

### Tono
- Cyberpunk oscuro: negros profundos, neon cyan y magenta, lluvia digital, scanlines
- Vocabulario militar: batallas, murallas, guardianes, asedios, caidas
- Epico pero accesible: cualquier holder puede ser Guardian con cualquier cantidad
- Datos reales: todo lo que se muestra en pantalla es on-chain, no hay gamification falsa

### La Pregunta Central del Juego
> "Hay una muralla a $850K de MCAP. Los bears la estan atacando.
>  Tu liquidez esta alli? Cuanto tiempo aguantara?"

---

## 2. VOCABULARIO DEL JUEGO

| Termino del juego | Significado tecnico real |
|---|---|
| **Citadel** | La dApp / el protocolo en general |
| **Citadel Wall / La Muralla** | Una posicion de liquidez concentrada en 1 tick (minTickSpacing=60) definida por el admin |
| **Guardian** | Un address que ha provisto liquidez en la muralla activa |
| **Battle / Batalla** | El periodo de vida de una muralla, desde que se despliega hasta que cae o se desmantela |
| **Deploying the Wall** | Admin configura tick+mcap y lo guarda en BD como muralla activa |
| **Reinforcing / Reforzar** | Un guardian añade liquidez al rango de la muralla activa |
| **Breach / Brecha** | El precio del pool cruza el tick de la muralla hacia abajo (currentTick < wall.tick) |
| **Wall Integrity / Integridad** | % de liquidez original que queda: liquidity_actual / peak_liquidity |
| **Fallen** | La muralla fue atravesada por el precio (currentTick < wall.tick) |
| **Demolished** | El admin retiro la muralla manualmente (no fue atravesada) |
| **Fee Loot / Botin** | Las fees de trading que una posicion ha acumulado |
| **War Room** | El leaderboard de guardians activos en la muralla actual |
| **Battle Report** | Resumen de una batalla terminada |
| **First Guardian** | El primer address en añadir liquidez a una muralla concreta |
| **Last Stand** | Ser uno de los ultimos 3 en reforzar antes de una caida |

---

## 3. LA MECANICA CENTRAL: LA MURALLA

### 3.1 Que es exactamente una muralla

Una muralla es una posicion de liquidez concentrada de **1 tick de ancho** en Uniswap V4.

En terminos tecnicos:
- `tickLower = wall_tick` (el tick definido por el admin, redondeado a multiplo de 60)
- `tickUpper = wall_tick + 60` (exactamente 1 tick de ancho, el minimo posible)
- El rango en MCAP es extremadamente estrecho: ~0.006% de ancho
- Esto maximiza las fees por unidad de liquidez cuando el precio esta ahi
- Y crea una "pared" muy concentrada que absorbe venta en ese precio exacto

### 3.2 Por que MCAP en vez de precio

Igual que en zeus-liquidity, el precio en ETH es contraintuitivo.
Un tick -204360 no significa nada para nadie.
Pero "$850,000 de MCAP" si significa algo: es donde el proyecto vale 850K dolares en total.

La muralla se define siempre en terminos de MCAP:
- Admin dice: "Quiero muralla a $850K MCAP"
- El sistema convierte: mcapToTick(850000, ethPrice, totalSupply) = tick X
- Ese tick X es donde se despliega la posicion

### 3.3 Como funciona la "vida" de la muralla

La vida de la muralla se calcula comparando la liquidez actual en ese rango con el maximo historico:

```
peak_liquidity = maximo de liquidez visto en ese tick desde que se creo la muralla
current_liquidity = liquidez actual en ese tick (on-chain, del pool)
integrity = current_liquidity / peak_liquidity * 100
```

**¿Por que la liquidez baja?**
Cuando el precio entra en el rango de la muralla y hay swaps de venta (ETH -> ZEUS):
- Los vendedores venden ZEUS y reciben ETH
- La posicion absorbe esa venta: pierde ETH, gana ZEUS
- La liquidez en el tick se consume (los LPs que retiran antes de que suba bajan el total)
- Cuando el precio cruza tickLower, todos los LPs han sido convertidos a 100% ZEUS

**Estados visuales:**
```
integrity >= 90%  ->  IMPENETRABLE  [neon cyan brillante, shields activos]
integrity >= 70%  ->  BESIEGED      [cyan apagado, primeras fisuras]
integrity >= 45%  ->  CRUMBLING     [naranja/rojo, fuego, paneles caidos]
integrity >= 20%  ->  CRITICAL      [rojo pulsante, ruinas, alarmas]
integrity <  20%  ->  FALLEN        [negro/ceniza, sin energia, derrota]
```

### 3.4 Cuando se considera "caida" una muralla

**Caida automatica:** El sistema detecta que `currentPoolTick < wall.tickLower`.
Esto significa que el precio ha bajado por debajo de la muralla — ha sido atravesada.

**Demolicion manual:** El admin puede retirar la muralla desde el backoffice.
Esto registra la batalla con resultado "demolished" (no es una derrota).

### 3.5 El ciclo de una batalla completo

```
FASE 1: DEPLOYMENT
  Admin define MCAP objetivo -> sistema convierte a tick -> muralla se registra en BD
  Estado: "active"
  La muralla aparece en la pagina principal

FASE 2: RECRUITMENT
  Guardians ven la muralla activa
  Conectan wallet, ponen ETH y/o ZEUS en el rango exacto de la muralla
  Cada join se registra en citadel.guardian_battles
  El primero en unirse recibe badge FIRST GUARDIAN
  El que mas liquidez pone en ese momento tiene badge ARCHITECT

FASE 3: THE SIEGE
  Los bears atacan: el precio baja hacia la muralla
  Los swaps de venta pasan por el rango de la muralla
  La liquidez se consume progresivamente
  La imagen del muro cambia segun integridad
  Los guardians ganan fees por cada swap que pasa (botin de guerra)

FASE 4A: VICTORY (muralla aguanta)
  El precio rebota o se estabiliza por encima del tick
  La muralla sigue activa
  Guardians pueden retirar su posicion con fees acumuladas
  O mantenerla esperando mas fees

FASE 4B: BREACH (muralla cae)
  currentTick baja por debajo de wall.tickLower
  Sistema registra la batalla como "fallen"
  Battle Report se genera: quien participo, cuanto duraron, fees ganadas
  Badges se asignan (LAST STAND, SURVIVOR segun corresponda)
  Pagina principal muestra pantalla de "CITADEL FALLEN"
  Admin puede desplegar nueva muralla

FASE 5: RECOVERY
  Admin despliega nueva muralla (puede ser mas abajo, o esperar rebote)
  El ciclo vuelve a empezar
```

### 3.6 Los incentivos reales del jugador

1. **Fees de trading**: Rango muy estrecho = fees muy concentradas. Si el precio oscila
   cerca del tick, cada swing genera fees. Es un negocio real.

2. **Contexto de precio bajo**: Si crees que el precio no va a bajar de X MCAP,
   poner liquidez ahi es una apuesta: ganas fees si tienes razon,
   y te quedas con ZEUS a ese precio si el mercado baja (que es donde querias comprar).

3. **Gamification**: badges, leaderboard, narrativa epica. El juego hace que
   defender el precio sea divertido y social.

4. **Informacion**: ver la muralla en el chart de liquidez te dice donde esta
   la resistencia real del mercado.

---

## 4. EL BACKOFFICE — CITADEL COMMAND

### 4.1 Acceso

URL: `/admin`
Proteccion: formulario de password. La password se guarda en `sessionStorage` del browser.
Cada request al API incluye header `x-admin-password: <password>`.
El API compara con `process.env.ADMIN_PASSWORD`.
Si falla 3 veces: bloqueo de 5 minutos (en memoria del servidor).

### 4.2 Layout del Backoffice

```
╔══════════════════════════════════════════════════════════════════════╗
║  [⚡ CITADEL COMMAND]                        [LOGOUT]  [MAINNET ●]  ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  ┌─── MARKET INTEL ──────────────────────────────────────────────┐  ║
║  │  ZEUS MCAP: $847,230    ETH: $3,241    24h: -3.2%  [LIVE ●]  │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                      ║
║  ┌─── DEPLOY NEW CITADEL WALL ───────────────────────────────────┐  ║
║  │                                                               │  ║
║  │  Target Market Cap (USD):                                     │  ║
║  │  ┌─────────────────────────────┐                             │  ║
║  │  │  $ 850,000                  │  <- input con formato       │  ║
║  │  └─────────────────────────────┘                             │  ║
║  │                                                               │  ║
║  │  Preview:                                                     │  ║
║  │  ┌─────────────────────────────────────────────────────────┐ │  ║
║  │  │  Tick Lower:   -204,360                                 │ │  ║
║  │  │  Tick Upper:   -204,300  (+60, minimo)                  │ │  ║
║  │  │  MCAP range:   $848,200 — $853,100  (~$5K de ancho)     │ │  ║
║  │  │  Precio ETH:   0.000000261 ETH/ZEUS                     │ │  ║
║  │  │  Distancia:    -0.3% del precio actual                  │ │  ║
║  │  │                                                         │ │  ║
║  │  │  ZONA: [ ■■■■■■■■■■■■░░░░░░░░░░ ] <-- en chart         │ │  ║
║  │  │  (mini chart de profundidad con zona marcada en rojo)   │ │  ║
║  │  └─────────────────────────────────────────────────────────┘ │  ║
║  │                                                               │  ║
║  │  [  ⚠ DEPLOY CITADEL WALL  ]  <- boton rojo/amber           │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                      ║
║  ┌─── ACTIVE WALL ───────────────────────────────────────────────┐  ║
║  │  WALL #7  ·  Target: $850K MCAP  ·  Since: 2h 34m ago       │  ║
║  │                                                               │  ║
║  │  ████████████████░░░░░░  73% integrity                       │  ║
║  │  4 Guardians  ·  Peak liq: 2,847,392  ·  Current: 2,081,616 │  ║
║  │                                                               │  ║
║  │  currentTick: -203,940  (wall at -204,360, distance: +420)  │  ║
║  │  STATUS: BESIEGED — price approaching wall                    │  ║
║  │                                                               │  ║
║  │  [  DEMOLISH WALL  ]  <- boton gris con confirmacion         │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                      ║
║  ┌─── BATTLE HISTORY ────────────────────────────────────────────┐  ║
║  │  #  │ MCAP Target │ Result   │ Guardians │ Duration │ Date   │  ║
║  ├─────┼─────────────┼──────────┼───────────┼──────────┼────────┤  ║
║  │  6  │   $1.2M     │ 💀 FALLEN │     3     │  14h 22m │ 3d ago │  ║
║  │  5  │   $900K     │ 🛡 HELD   │     7     │  3d 2h   │ 5d ago │  ║
║  │  4  │   $750K     │ 💀 FALLEN │     2     │  6h 11m  │ 8d ago │  ║
║  │  3  │   $1.5M     │ 🔧 DEMO  │     1     │  2h 03m  │ 12d ago│  ║
║  └───────────────────────────────────────────────────────────────┘  ║
╚══════════════════════════════════════════════════════════════════════╝
```

### 4.3 Flujo de crear muralla — paso a paso

1. Admin escribe MCAP objetivo (ej: 850000)
2. En tiempo real: preview del tick resultante, rango en MCAP, precio en ETH
3. Mini-chart de profundidad muestra donde quedaria la muralla respecto al precio actual
4. Si hay muralla activa: warning "Ya existe una muralla activa. Al desplegar esta, la anterior se demolera automaticamente"
5. Admin hace click en "DEPLOY CITADEL WALL"
6. Confirmacion modal: "Desplegar muralla a $850K MCAP? Esta accion es irreversible hasta que el admin la desmantele o caiga"
7. POST /api/citadel/wall -> guarda en BD
8. La pagina principal se actualiza instantaneamente

### 4.4 Flujo de demoler muralla

1. Admin hace click en "DEMOLISH WALL"
2. Modal de confirmacion: "Demoler muralla #7 ($850K)? Los guardians podran retirar su liquidez. La batalla se registrara como DEMOLISHED."
3. DELETE /api/citadel/wall/7 -> estado pasa a "demolished", se registra batalla
4. La pagina principal muestra estado "No active wall"

---

## 5. LA PAGINA PRINCIPAL — ESTADO DE LA BATALLA

### 5.1 Estructura general de la pagina

```
[ HEADER sticky ]
[ HERO — identidad del juego ]
[ ACTIVE BATTLE — la seccion mas importante, siempre visible ]
[ WAR ROOM — leaderboard de guardians activos ]
[ JOIN THE CITADEL — form para unirse ]
[ BATTLE HISTORY — historial ]
[ GUARDIAN HALL — leaderboard global ]
[ FOOTER ]
```

### 5.2 HEADER

```
╔═══════════════════════════════════════════════════════════════╗
║ [⚡ CITADEL]  Defend  Battle  Guardians  [0x1a2b...3c4d ▼]  ║
╚═══════════════════════════════════════════════════════════════╝
```

- Logo: rayo + "CITADEL" en Orbitron, neon cyan
- Nav: Defend (scroll a active wall), Battle (historial), Guardians (leaderboard)
- Wallet button: si conectado muestra address truncada + icono de escudo si es Guardian
- Scanline sutil en el header

### 5.3 HERO SECTION

```
╔════════════════════════════════════════════════════════════════════╗
║  [fondo: hero-bg.png con overlay oscuro + lluvia de datos CSS]    ║
║                                                                    ║
║  [logo: citadel-logo.png]                                         ║
║                                                                    ║
║  "THE LAST LINE OF DEFENSE"                                       ║
║                                                                    ║
║  ZEUS MCAP: [ $847,230 ]  (actualiza cada 30s, parpadea al cambio)║
║                                                                    ║
║  [ DEFEND NOW ]   [ VIEW BATTLE ]                                 ║
║                                                                    ║
║  ┌──────────────────────────────────────────────────────────────┐ ║
║  │  ⚡ 4 Guardians active  ·  $12,400 total liquidity           │ ║
║  │  ·  Next wall: $850K    ·  Distance: -0.3% from current     │ ║
║  └──────────────────────────────────────────────────────────────┘ ║
╚════════════════════════════════════════════════════════════════════╝
```

Animaciones del hero:
- Fondo: imagen `hero-bg.png` con parallax leve al scroll
- Lluvia de datos: caracteres hex cayendo (como matrix rain) en CSS
- MCAP: numero con animacion de "contador" cuando cambia
- Pill de stats: borde cyan pulsante
- Scanline overlay: lineas horizontales semitransparentes que se deslizan
- Glitch effect en el titulo al cargar (se "rompe" por 200ms y se estabiliza)

### 5.4 ACTIVE BATTLE SECTION — el corazon del juego

Esta seccion tiene 3 sub-estados completamente diferentes:

#### ESTADO A: Muralla activa, precio lejos (> 5% arriba)

```
╔═══════════════════════════════════════════════════════════════════╗
║  THE CITADEL WALL                          [ BATTLE #7 ]         ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  ┌─── WALL IMAGE ──────────────────┐  ┌─── WALL STATS ────────┐ ║
║  │                                 │  │                        │ ║
║  │   [wall-100.png]                │  │  TARGET MCAP           │ ║
║  │   imagen 400x300px              │  │  $850,000              │ ║
║  │   brillante, shields activos    │  │                        │ ║
║  │   particulas de energia CSS     │  │  WALL INTEGRITY        │ ║
║  │                                 │  │  ████████████ 100%     │ ║
║  │                                 │  │  IMPENETRABLE          │ ║
║  │                                 │  │                        │ ║
║  └─────────────────────────────────┘  │  DISTANCE FROM PRICE   │ ║
║                                       │  -5.2% ($44,700)       │ ║
║                                       │                         │ ║
║                                       │  GUARDIANS             │ ║
║                                       │  4 active              │ ║
║                                       │                         │ ║
║                                       │  TOTAL LIQUIDITY       │ ║
║                                       │  $12,400               │ ║
║                                       │                         │ ║
║                                       │  BATTLE AGE            │ ║
║                                       │  2h 34m                │ ║
║                                       └────────────────────────┘ ║
║                                                                   ║
║  [ ⚔ JOIN THE CITADEL WALL ]                                     ║
╚═══════════════════════════════════════════════════════════════════╝
```

#### ESTADO B: Muralla activa, bajo asedio (precio <= 5% arriba)

```
╔═══════════════════════════════════════════════════════════════════╗
║  ⚠ SIEGE INCOMING                          [ BATTLE #7 ]        ║
║  [ barra roja pulsante en el borde del panel ]                   ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  ┌─── WALL IMAGE ──────────────────┐  ┌─── LIVE COMBAT ───────┐ ║
║  │                                 │  │                        │ ║
║  │   [wall-75.png o wall-50.png    │  │  TARGET MCAP           │ ║
║  │    segun integridad]            │  │  $850,000              │ ║
║  │   animacion de shake sutil      │  │                        │ ║
║  │   chispas volando (CSS)         │  │  WALL INTEGRITY        │ ║
║  │   glitch effect ocasional       │  │  ██████░░░░░░ 58%      │ ║
║  │                                 │  │  CRUMBLING ⚠          │ ║
║  └─────────────────────────────────┘  │                        │ ║
║                                       │  PRICE VS WALL         │ ║
║                                       │  Current: $854,200     │ ║
║                                       │  Wall at: $850,000     │ ║
║  TICKER DE ACTIVIDAD:                 │  Gap: -$4,200 (-0.5%)  │ ║
║  ┌──────────────────────────────────┐ │                        │ ║
║  │ <<< 0x4a3b sold 12,000 ZEUS ··· │ │  LAST SWAP             │ ║
║  │     0xf2c1 sold 8,400 ZEUS  ··· │ │  3s ago                │ ║
║  └──────────────────────────────────┘ └────────────────────────┘ ║
║                                                                   ║
║  [ ⚔ REINFORCE NOW — The wall needs you! ]                      ║
╚═══════════════════════════════════════════════════════════════════╝
```

Cuando esta en siege: borde del panel anima en rojo pulsante, imagen hace shake suave

#### ESTADO C: Muralla caida

```
╔═══════════════════════════════════════════════════════════════════╗
║  💀 CITADEL FALLEN                                               ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  ┌─── WALL IMAGE ──────────────────────────────────────────────┐ ║
║  │   [wall-0.png — ruinas totales]                              │ ║
║  │   overlay rojo con texto "BREACHED"                          │ ║
║  │   particulas de escombros cayendo (CSS)                      │ ║
║  └──────────────────────────────────────────────────────────────┘ ║
║                                                                   ║
║  ┌─── BATTLE REPORT #7 ────────────────────────────────────────┐ ║
║  │                                                              │ ║
║  │  WALL:      $850,000 MCAP  (Tick -204,360)                  │ ║
║  │  DURATION:  6 hours, 22 minutes                             │ ║
║  │  BREACH:    Price fell to $848,900                          │ ║
║  │  GUARDIANS: 4 defenders                                     │ ║
║  │  PEAK LIQ:  $12,400                                         │ ║
║  │  FEES PAID: $847 distributed to guardians                   │ ║
║  │                                                              │ ║
║  │  TOP DEFENDERS:                                             │ ║
║  │  1. 0x4a3b...  $6,200 liq  ·  $423 fees  [ARCHITECT]       │ ║
║  │  2. 0xf2c1...  $3,800 liq  ·  $259 fees                    │ ║
║  │  3. 0x9de2...  $2,400 liq  ·  $165 fees  [FIRST GUARDIAN]  │ ║
║  │                                                              │ ║
║  └──────────────────────────────────────────────────────────────┘ ║
║                                                                   ║
║  [ AWAITING NEW WALL DEPLOYMENT... ]  (spinner animado)          ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

#### ESTADO D: Sin muralla activa

```
╔═══════════════════════════════════════════════════════════════════╗
║  NO ACTIVE CITADEL WALL                                          ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  [imagen de ciudad en calma, sin muralla, cielo tranquilo]       ║
║                                                                   ║
║  "The bears are gathering in the shadows.                        ║
║   No wall has been deployed yet.                                 ║
║   Stand by, Guardian."                                           ║
║                                                                   ║
║  [ spinner / animacion de espera ]                               ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

### 5.5 WAR ROOM — Guardians de la muralla activa

```
╔═══════════════════════════════════════════════════════════════════╗
║  WAR ROOM — ACTIVE GUARDIANS                    [ BATTLE #7 ]   ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  #    ADDRESS            LIQUIDITY    FEES EARNED    BADGES      ║
║  ──────────────────────────────────────────────────────────────  ║
║  1    0x4a3b...  ★        $6,200       $423.12       [A][V]      ║
║  2    0xf2c1...            $3,800       $259.80                  ║
║  3    0x9de2...  ⚡first   $2,400       $165.34       [FG]       ║
║  4    0x7bb3...            $2,000       $137.22       [V]        ║
║                                                                   ║
║  TOTAL  4 guardians       $14,400       $985.48                  ║
║                                                                   ║
║  [A] = Architect   [FG] = First Guardian   [V] = Veteran        ║
╚═══════════════════════════════════════════════════════════════════╝
```

- ★ = el Guardian con mayor liquidez en esta batalla (Architect badge)
- ⚡first = el primer Guardian en unirse a esta muralla
- Badges muestran iconos pequeños (hex badge 24x24px)
- Si el address conectado aparece aqui, su fila se resalta en cyan

---

## 6. UNIRSE A LA MURALLA — JOIN THE CITADEL

### 6.1 Logica de que token aportar

La muralla esta en 1 tick muy especifico. Dependiendo de donde este el precio actual
respecto a ese tick, el usuario puede aportar:

```
SI currentPrice > wall.tickUpper:
  -> El rango esta BELOW del precio actual
  -> 100% ZEUS (el usuario aporta solo ZEUS)
  -> Razon: en Uniswap V4, si el rango esta por debajo del precio actual,
     la posicion es 100% token1 (ZEUS)
  -> Mensaje: "Your position will be 100% ZEUS. When bears push the price
     into this range, your ZEUS will be swapped to ETH absorbing the selling pressure."

SI currentPrice < wall.tickLower:
  -> El rango esta ABOVE del precio actual
  -> 100% ETH (el usuario aporta solo ETH)
  -> Mensaje: "Your position will be 100% ETH. When bulls push price into
     this range, your ETH will be swapped to ZEUS."

SI wall.tickLower <= currentPrice <= wall.tickUpper:
  -> El precio esta DENTRO del rango (muy raro con 1 tick)
  -> Proporcion de ETH y ZEUS segun la formula de V4
  -> El sistema calcula automaticamente la proporcion
```

En la practica, dado que la muralla es siempre 1 tick y el precio oscila,
casi siempre sera:
- **La mayoria del tiempo: 100% ZEUS** (muralla por debajo del precio actual)
- Solo si la muralla esta por encima del precio: 100% ETH

### 6.2 Diseno del formulario

```
╔═══════════════════════════════════════════════════════════════════╗
║  JOIN THE CITADEL WALL                                           ║
║  Reinforce the wall at $850,000 MCAP                            ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  ┌─── WALL INTEL ─────────────────────────────────────────────┐ ║
║  │  [mini imagen de la muralla segun estado, 80x60px]         │ ║
║  │  Target: $850,000 MCAP  ·  Tick: -204,360                  │ ║
║  │  Integrity: 73%  ·  4 Guardians defending                  │ ║
║  │  Your position: 100% ZEUS (wall below current price)       │ ║
║  └────────────────────────────────────────────────────────────┘ ║
║                                                                   ║
║  AMOUNT TO DEPLOY                                                ║
║  ┌──────────────────────────────────────────────┐              ║
║  │  ZEUS:  [ 1,000,000          ]  [MAX]        │              ║
║  │         Balance: 4,382,000 ZEUS              │              ║
║  │         ≈ $847.23                            │              ║
║  └──────────────────────────────────────────────┘              ║
║                                                                   ║
║  ┌─── POSITION PREVIEW ───────────────────────────────────────┐ ║
║  │  You will add:  1,000,000 ZEUS (~$847)                     │ ║
║  │  Range:         $848,200 — $853,100 MCAP                   │ ║
║  │  Width:         1 tick  (minimum, maximum fee efficiency)  │ ║
║  │  Est. APR:      ~284%  (if price stays in range 50% time)  │ ║
║  │  Fee tier:      0.3%                                       │ ║
║  └────────────────────────────────────────────────────────────┘ ║
║                                                                   ║
║  [  APPROVE ZEUS  ]  <- paso 1 si no hay allowance suficiente   ║
║  [  JOIN THE CITADEL  ]  <- paso 2, llama a mint()              ║
║                                                                   ║
║  ⚠ By joining, you accept the risks of concentrated liquidity  ║
║    Your ZEUS may be converted to ETH if the price enters range  ║
╚═══════════════════════════════════════════════════════════════════╝
```

### 6.3 Animaciones del form

- Al hacer click en "JOIN THE CITADEL": animacion de "deploying" con rayos y particulas
- Progress: "Approving... → Deploying... → Guardian registered!"
- Toast de exito: "You are now a Guardian of Battle #7!"
- Si es el primero: toast especial con badge de FIRST GUARDIAN animado entrando desde arriba

### 6.4 Que ocurre detras del formulario al hacer join

1. Usuario conecta wallet
2. Aprueba ZEUS token si es necesario (ERC20.approve)
3. Llama a PositionManager.mint() con los parametros de la muralla
4. El tx se mina on-chain
5. El frontend detecta el tx exitoso y llama a POST /api/citadel/guardian/join
6. El API registra en citadel.guardian_battles
7. Si es el primero: registra en citadel.first_guardians
8. La pagina se refresca: el guardian aparece en el War Room

---

## 7. PERFILES DE GUARDIAN

### 7.1 URL: /[address]

Pagina publica para cualquier address. Si el usuario conectado visita su propio perfil,
ve informacion adicional (fees pendientes, botones de accion).

### 7.2 Diseno del perfil

```
╔═══════════════════════════════════════════════════════════════════╗
║  GUARDIAN PROFILE                                                ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  ┌─── IDENTITY ───────────────────────────────────────────────┐ ║
║  │  [hero-guardian.png  80x80px circular con borde neon]      │ ║
║  │                                                            │ ║
║  │  0x4a3b...f2c1                                             │ ║
║  │  [Etherscan ↗]                                             │ ║
║  │                                                            │ ║
║  │  RANK: #3 ALL TIME                                         │ ║
║  │  ██████████ Guardian Level 4 (Veteran)                     │ ║
║  └────────────────────────────────────────────────────────────┘ ║
║                                                                   ║
║  ┌─── BADGES ─────────────────────────────────────────────────┐ ║
║  │  [badge-architect.png]  [badge-veteran.png]  [badge-??]    │ ║
║  │   ARCHITECT              VETERAN             ???           │ ║
║  │   (hover: descripcion del badge)                           │ ║
║  └────────────────────────────────────────────────────────────┘ ║
║                                                                   ║
║  ┌─── COMBAT STATS ───────────────────────────────────────────┐ ║
║  │  Battles Participated:    12                               │ ║
║  │  Battles Survived:         8 (walls held while active)     │ ║
║  │  Total Fees Earned:      $2,847.32                         │ ║
║  │  Peak Position Size:     $6,200 (Battle #7)               │ ║
║  │  Total Liquidity Deployed: $34,200 (all time)             │ ║
║  └────────────────────────────────────────────────────────────┘ ║
║                                                                   ║
║  ┌─── ACTIVE POSITIONS ───────────────────────────────────────┐ ║
║  │  [si tiene posicion en la muralla activa]                  │ ║
║  │  BATTLE #7  ·  $6,200  ·  Earning $2.34/h  [ACTIVE ●]     │ ║
║  └────────────────────────────────────────────────────────────┘ ║
║                                                                   ║
║  ┌─── BATTLE HISTORY ─────────────────────────────────────────┐ ║
║  │  #7  $850K  $6,200  ●  ACTIVE     $423 earned so far       │ ║
║  │  #6  $1.2M  $3,100  💀 FALLEN     $187 earned              │ ║
║  │  #5  $900K  $4,800  🛡 HELD       $312 earned              │ ║
║  │  #4  $750K  $1,200  💀 FALLEN     $67 earned               │ ║
║  └────────────────────────────────────────────────────────────┘ ║
╚═══════════════════════════════════════════════════════════════════╝
```

---

## 8. HISTORIAL DE BATALLAS

### 8.1 URL: /battles

```
╔═══════════════════════════════════════════════════════════════════╗
║  BATTLE CHRONICLES                                               ║
║  Every wall. Every breach. Every victory.                       ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  ┌─── BATTLE #7 — ACTIVE ●  ─────────────────────────────────┐ ║
║  │  [wall-75.png 200x120px]   Target: $850K MCAP             │ ║
║  │  73% integrity              Duration: 2h 34m (ongoing)    │ ║
║  │  4 Guardians                Total Liq: $14,400            │ ║
║  │  [JOIN NOW]                                                │ ║
║  └────────────────────────────────────────────────────────────┘ ║
║                                                                   ║
║  ┌─── BATTLE #6 — 💀 FALLEN  ─────────────────────────────────┐ ║
║  │  [wall-0.png 200x120px]    Target: $1.2M MCAP             │ ║
║  │  BREACHED at $1,196,200    Duration: 14h 22m              │ ║
║  │  3 Guardians               Total Fees: $234               │ ║
║  │  [VIEW REPORT]                                             │ ║
║  └────────────────────────────────────────────────────────────┘ ║
║                                                                   ║
║  ┌─── BATTLE #5 — 🛡 HELD  ──────────────────────────────────┐ ║
║  │  [wall-100.png 200x120px]  Target: $900K MCAP             │ ║
║  │  WALL STOOD — demolished   Duration: 3d 2h               │ ║
║  │  7 Guardians               Total Fees: $1,240             │ ║
║  │  [VIEW REPORT]                                             │ ║
║  └────────────────────────────────────────────────────────────┘ ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

### 8.2 Battle Report Modal (al hacer click en VIEW REPORT)

```
╔═══════════════════════════════════════════════════════════════════╗
║  BATTLE REPORT #6                              [X close]         ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  [battle-report.png como fondo semi-transparente]                ║
║                                                                   ║
║  RESULT:       💀 CITADEL FALLEN                                 ║
║  TARGET:       $1,200,000 MCAP  (Tick -198,240)                  ║
║  BREACH:       Price fell to $1,196,200 at 14:32 UTC             ║
║  DURATION:     14 hours, 22 minutes                              ║
║                                                                   ║
║  ─── DEFENDERS ──────────────────────────────────────────────   ║
║  1. 0x4a3b  $4,200  $134 fees  [LAST STAND] [VETERAN]           ║
║  2. 0xf2c1  $2,600  $83 fees   [FIRST GUARDIAN]                 ║
║  3. 0x9de2  $1,800  $57 fees                                     ║
║                                                                   ║
║  ─── TIMELINE ───────────────────────────────────────────────   ║
║  T+00:00  Wall deployed at $1.2M                                 ║
║  T+02:14  First Guardian joins (0xf2c1, $2,600)                 ║
║  T+06:30  Price enters siege range (-5% from wall)              ║
║  T+11:48  Wall integrity drops to 50% (CRUMBLING)               ║
║  T+13:55  Wall integrity drops to 25% (CRITICAL)                ║
║  T+14:22  BREACH — price crossed tick                           ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

---

## 9. SISTEMA DE BADGES

### 9.1 Lista completa de badges

| Badge | Imagen | Criterio | Cuando se asigna |
|-------|--------|----------|-----------------|
| **ARCHITECT** | badge-architect.png | Mayor posicion activa en la muralla actual | Dinamico: cambia si alguien lo supera |
| **FIRST GUARDIAN** | badge-first-guardian.png | Primer address en unirse a una muralla concreta | Permanente: al ser el primero en citadel.first_guardians |
| **FEE HARVESTER** | badge-fee-harvester.png | Top 1 en fees historicas acumuladas | Dinamico: siempre va al lider del all-time leaderboard |
| **VETERAN** | badge-veteran.png | Participado en 5 o mas batallas distintas | Permanente: cuando count(guardian_battles) >= 5 |
| **SURVIVOR** | (generar imagen) | Participo en una batalla que aguanto (HELD) | Permanente: cuando participa en batalla demolida/held |
| **LAST STAND** | (generar imagen) | Uno de los ultimos 3 en reforzar antes de una caida | Permanente: cuando breach ocurre y eras de los ultimos 3 en joinDate |

### 9.2 Como se muestran los badges

- En perfil: hexagonos grandes (80x80px) con tooltip al hover
- En War Room: hexagonos pequenos (24x24px) al lado del address
- En Battle Report: iconos pequenos (20x20px) al lado del nombre
- Los badges dinamicos (ARCHITECT, FEE HARVESTER) muestran corona animada
- Los badges permanentes tienen borde dorado

### 9.3 Logica de calculo (en /api/citadel/guardian/[addr])

```typescript
// ARCHITECT: address tiene la mayor posicion activa en la muralla actual
const currentWall = await getActiveWall()
if (currentWall) {
  const positions = await getPositionsInRange(currentWall.tickLower, currentWall.tickUpper)
  const maxLiq = positions.reduce((max, p) => p.owner === addr && p.liq > max ? p.liq : max, 0)
  const isArchitect = maxLiq > 0 && maxLiq === Math.max(...positions.map(p => p.liq))
}

// FIRST GUARDIAN: alguna vez fue el primero en una muralla
const firstGuardian = await db.query(
  'SELECT 1 FROM citadel.first_guardians WHERE address = $1', [addr]
)

// FEE HARVESTER: top 1 en fees historicas
const rank = await getFeeRank(addr) // rank = 1 si es el maximo
const isFeeHarvester = rank === 1

// VETERAN: 5 o mas batallas distintas
const battles = await db.query(
  'SELECT COUNT(*) FROM citadel.guardian_battles WHERE address = $1', [addr]
)
const isVeteran = parseInt(battles.rows[0].count) >= 5

// SURVIVOR: participo en alguna batalla HELD/DEMOLISHED
const survived = await db.query(
  `SELECT 1 FROM citadel.guardian_battles gb
   JOIN citadel.battles b ON b.wall_id = gb.wall_id
   WHERE gb.address = $1 AND b.result IN ('held', 'demolished')`, [addr]
)

// LAST STAND: en alguna batalla fallen, fue de los ultimos 3 en unirse
const lastStand = await db.query(
  `SELECT 1 FROM citadel.guardian_battles gb
   JOIN citadel.battles b ON b.wall_id = gb.wall_id
   WHERE gb.address = $1 AND b.result = 'fallen'
   AND gb.joined_at >= (
     SELECT joined_at FROM citadel.guardian_battles
     WHERE wall_id = gb.wall_id
     ORDER BY joined_at DESC LIMIT 1 OFFSET 2
   )`, [addr]
)
```

---

## 10. LEADERBOARDS Y RANKINGS

### 10.1 Guardian Hall — All-Time Leaderboard

Seccion en la pagina principal, despues del historial de batallas:

```
╔═══════════════════════════════════════════════════════════════════╗
║  GUARDIAN HALL OF FAME                                           ║
║  All-time rankings                                               ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  TABS: [ FEES EARNED ] [ BATTLES ] [ PEAK POSITION ]            ║
║                                                                   ║
║  ── FEES EARNED ──────────────────────────────────────────────  ║
║  #   ADDRESS            TOTAL FEES   BATTLES   BADGES           ║
║  1   0x4a3b... 👑        $2,847       12       [FH][V][A]       ║
║  2   0xf2c1...           $1,203        8       [FG][V]          ║
║  3   0x9de2...             $847        5       [V]              ║
║  4   0x7bb3...             $312        3                        ║
║  5   0xabc1...             $187        2                        ║
║                                                                   ║
║  [FH]=Fee Harvester  [V]=Veteran  [A]=Architect  [FG]=1st Guard ║
╚═══════════════════════════════════════════════════════════════════╝
```

### 10.2 Tabs del leaderboard

**Tab FEES EARNED:** ordenado por fees historicas totales (de leaderboard existente de zeus-liquidity)
**Tab BATTLES:** ordenado por numero de batallas participadas (citadel.guardian_battles count)
**Tab PEAK POSITION:** el mayor size de posicion individual que alguien ha puesto alguna vez

---

## 11. FLUJOS DE USUARIO COMPLETOS

### 11.1 Flujo: Nuevo usuario llega a la pagina

```
1. Llega a /
2. Ve hero con citadel-logo.png y hero-bg.png
3. Ve "ACTIVE BATTLE #7 — $850K WALL — 73% integrity — BESIEGED"
4. Ve imagen de muro con fisuras, borde rojo pulsante
5. Ve War Room: 4 guardians, $14,400 deployed
6. Hace click en "JOIN THE CITADEL"
7. Se scroll-snappea al formulario
8. Ve que necesita ZEUS (muralla por debajo del precio)
9. Conecta wallet (boton en header)
10. Ve su balance de ZEUS: 4,382,000
11. Introduce cantidad: 500,000 ZEUS
12. Preview: ~$423, est APR ~284%
13. Click "APPROVE ZEUS" -> firma tx
14. Click "JOIN THE CITADEL" -> firma tx
15. Toast: "You are now a Guardian of Battle #7!"
16. Aparece en War Room en posicion #3
17. Si era el primero (no en este caso): toast con badge FIRST GUARDIAN
```

### 11.2 Flujo: Usuario vuelve a ver su perfil

```
1. Va a /[su_address]
2. Ve sus badges ganados
3. Ve que tiene ARCHITECT en Battle #7 (mayor posicion)
4. Ve historial: 12 batallas, $2,847 fees
5. Ve posicion activa: $6,200, ganando fees en tiempo real
6. (Si conectado): ve boton "Collect Fees" -> misma funcionalidad existente
```

### 11.3 Flujo: La muralla cae (evento en tiempo real)

```
1. El precio cruza tickLower de la muralla activa
2. El sistema detecta: currentTick < wall.tickLower (polling cada 30s)
3. POST interno -> wall.status = 'fallen', batalla registrada
4. Badges LAST STAND se asignan a ultimos 3 en unirse
5. En pagina principal: transicion animada
   - Imagen cambia a wall-0.png con efecto de "collapse" (shake intenso -> fundido a ruinas)
   - Overlay rojo "CITADEL FALLEN" con efecto de glitch
   - Texto "BREACH DETECTED AT $848,900"
6. Battle Report aparece automaticamente
7. Toast para todos los guardians activos: "Battle #7 has ended. Collect your fees."
8. "AWAITING NEW WALL DEPLOYMENT..." con spinner
```

### 11.4 Flujo: Admin despliega nueva muralla

```
1. Admin va a /admin
2. Introduce password
3. Ve que no hay muralla activa / que la anterior ha caido
4. Escribe MCAP objetivo: 800000
5. Preview: tick -205,200, rango $798K-$803K, 5.8% por debajo del precio actual
6. Click "DEPLOY CITADEL WALL"
7. Modal de confirmacion: "Deploy wall at $800K? There are currently 0 guardians ready."
8. Confirma
9. POST /api/citadel/wall -> nueva entrada en BD
10. En pagina principal: transicion de "no wall" a "BATTLE #8 DEPLOYED"
11. Imagen cambia a wall-100.png (muro pristine, acabado de construir)
12. Animacion de "construction": el muro se "construye" de abajo a arriba
```

---

## 12. DISENO VISUAL — GUIA DE ESTILO

### 12.1 Paleta de colores

```css
/* Fondos */
--bg-void:       #03050f;   /* negro casi puro con toque azul */
--bg-primary:    #060b18;   /* fondo principal, azul muy oscuro */
--bg-secondary:  #0a1020;   /* secciones alternadas */
--bg-panel:      #0d1428;   /* panels y cards */
--bg-glass:      rgba(0, 245, 255, 0.03);  /* glass effect */

/* Neon principales */
--neon-cyan:     #00f5ff;   /* color principal, muralla activa */
--neon-magenta:  #ff00aa;   /* ataques de bears, alertas */
--neon-amber:    #ffb700;   /* fees, oro, rewards */
--neon-green:    #00ff88;   /* victoria, held, success */
--neon-red:      #ff2244;   /* fallen, breach, danger */

/* Texto */
--text-primary:  #e8f4ff;   /* casi blanco con toque azul */
--text-secondary:#8ba8c8;   /* texto secundario */
--text-muted:    #445566;   /* texto apagado */

/* Borders */
--border-cyan:   rgba(0, 245, 255, 0.2);
--border-panel:  rgba(0, 245, 255, 0.08);
```

### 12.2 Tipografia

```css
/* Display / Titulos: Orbitron — muy cyberpunk, futurista, anguloso */
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
--font-display: 'Orbitron', monospace;

/* Monospaced / Stats: Share Tech Mono — para numeros, datos, ticks */
@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
--font-mono: 'Share Tech Mono', monospace;

/* Body: Rajdhani — moderna, legible, semi-condensed, sci-fi feel */
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap');
--font-body: 'Rajdhani', sans-serif;
```

### 12.3 Efectos visuales definidos

**Scanline overlay** (toda la pagina):
```css
.scanlines::before {
  content: '';
  position: fixed; inset: 0; z-index: 9999; pointer-events: none;
  background: repeating-linear-gradient(
    0deg, transparent, transparent 2px,
    rgba(0, 245, 255, 0.015) 2px, rgba(0, 245, 255, 0.015) 4px
  );
}
```

**Glitch text** (titulo, al cargar o en eventos):
```css
@keyframes glitch {
  0%   { clip-path: inset(20% 0 60% 0); transform: translate(-3px, 0); }
  20%  { clip-path: inset(60% 0 10% 0); transform: translate(3px, 0); }
  40%  { clip-path: inset(40% 0 40% 0); transform: translate(-2px, 0); }
  60%  { clip-path: inset(10% 0 80% 0); transform: translate(2px, 0); }
  80%  { clip-path: inset(80% 0 5% 0);  transform: translate(-3px, 0); }
  100% { clip-path: inset(0% 0 0% 0);   transform: translate(0, 0); }
}
```

**Neon glow pulsante** (borde del panel en siege):
```css
@keyframes siege-pulse {
  0%, 100% { box-shadow: 0 0 5px var(--neon-red), 0 0 10px var(--neon-red); }
  50%       { box-shadow: 0 0 20px var(--neon-red), 0 0 40px var(--neon-magenta); }
}
```

**Wall shake** (cuando integridad < 25%):
```css
@keyframes wall-critical {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  10%       { transform: translate(-2px, -1px) rotate(-0.3deg); }
  30%       { transform: translate(2px, 1px) rotate(0.3deg); }
  50%       { transform: translate(-1px, 2px) rotate(-0.2deg); }
  70%       { transform: translate(1px, -2px) rotate(0.2deg); }
  90%       { transform: translate(-2px, 1px) rotate(-0.1deg); }
}
```

**Data rain** (hero background, CSS puro):
```css
@keyframes data-fall { 0% { transform: translateY(-100vh); opacity: 1; } 100% { transform: translateY(100vh); opacity: 0; } }
/* columnas de caracteres hex cayendo */
```

**Health bar animada:**
```css
/* Gradiente dinamico segun integridad */
/* 100-70%: cyan  ->  70-40%: cyan a naranja  ->  40-0%: naranja a rojo */
background: linear-gradient(90deg, var(--color-integrity) var(--width), transparent var(--width));
animation: bar-pulse 2s ease-in-out infinite;
```

### 12.4 Cards y panels

```css
.panel-citadel {
  background: var(--bg-panel);
  border: 1px solid var(--border-panel);
  border-radius: 2px;              /* Anguloso, no redondeado — es cyberpunk */
  box-shadow: inset 0 0 30px rgba(0, 245, 255, 0.02),
              0 0 0 1px rgba(0, 245, 255, 0.05);
  position: relative;
  overflow: hidden;
}

/* Linea decorativa cyan en esquina superior izquierda */
.panel-citadel::before {
  content: '';
  position: absolute; top: 0; left: 0;
  width: 40px; height: 2px;
  background: var(--neon-cyan);
  box-shadow: 0 0 8px var(--neon-cyan);
}
```

---

## 13. BOCETOS DE PANTALLAS

### 13.1 Pagina Principal — Mobile (375px)

```
┌────────────────────────────┐
│ ⚡CITADEL    [0x1a2b...] │ <- header sticky
├────────────────────────────┤
│ [hero-bg.png fullscreen]   │
│ [logo citadel-protocol]    │
│ "THE LAST LINE"            │
│ ZEUS MCAP: $847K           │
│ [DEFEND NOW]               │
└────────────────────────────┘
│ ⚠ SIEGE INCOMING           │
│ ┌──────────────────────┐   │
│ │ [wall-50.png]        │   │
│ │ BATTLE #7 · 58%      │   │
│ │ $850K TARGET         │   │
│ │ 4 Guardians          │   │
│ └──────────────────────┘   │
│ [REINFORCE NOW]            │
└────────────────────────────┘
│ WAR ROOM                   │
│ 1. 0x4a3b ★  $6,200 [A]   │
│ 2. 0xf2c1    $3,800        │
│ 3. 0x9de2 ⚡  $2,400 [FG]  │
└────────────────────────────┘
│ JOIN THE CITADEL           │
│ [Wall intel mini]          │
│ ZEUS: [____________] [MAX] │
│ ~$847 · Est 284% APR       │
│ [APPROVE] [JOIN]           │
└────────────────────────────┘
│ BATTLE HISTORY             │
│ [#7 active]                │
│ [#6 💀 FALLEN]             │
│ [#5 🛡 HELD]               │
└────────────────────────────┘
```

### 13.2 Pagina Principal — Desktop (1440px)

```
╔══════════════════════════════════════════════════════════════════════╗
║ [scanlines overlay toda la pagina]                                  ║
╠══ HEADER ═══════════════════════════════════════════════════════════╣
║ ⚡CITADEL  |  Defend  Battle  Guardians  |  [0x1a2b...f2c1 ▼]     ║
╠══ HERO ═════════════════════════════════════════════════════════════╣
║  [hero-bg.png + data rain CSS + parallax]                          ║
║                                                                     ║
║  [citadel-logo.png]                                                ║
║  T H E   L A S T   L I N E   O F   D E F E N S E                  ║
║  ZEUS MCAP: $847,230  ████▓▒░  4 Guardians · $14,400 deployed    ║
║  [DEFEND NOW ▶]  [VIEW BATTLE]                                     ║
╠══ ACTIVE BATTLE ════════════════════════════════════════════════════╣
║                                                                     ║
║  ⚠ BATTLE #7 — SIEGE INCOMING                      [borde rojo]   ║
║                                                                     ║
║  ┌── LEFT: WALL IMAGE ───────┐  ┌── RIGHT: STATS + WAR ROOM ───┐  ║
║  │                           │  │  TARGET: $850,000 MCAP        │  ║
║  │  [wall-50.png]            │  │  INTEGRITY: ██████░░ 58%      │  ║
║  │  [particles CSS]          │  │  STATUS: CRUMBLING ⚠          │  ║
║  │  [shake animation]        │  │                               │  ║
║  │                           │  │  CURRENT: $854,200  (-0.5%)   │  ║
║  │                           │  │  GUARDIANS: 4 active          │  ║
║  │                           │  │  TOTAL LIQ: $14,400           │  ║
║  │                           │  │                               │  ║
║  └───────────────────────────┘  │  WAR ROOM                     │  ║
║                                 │  1. 0x4a3b★  $6,200 [A]      │  ║
║                                 │  2. 0xf2c1   $3,800           │  ║
║                                 │  3. 0x9de2⚡  $2,400 [FG]    │  ║
║                                 │  4. 0x7bb3   $2,000 [V]      │  ║
║  [REINFORCE THE WALL ▶]         └───────────────────────────────┘  ║
╠══ JOIN FORM ════════════════════════════════════════════════════════╣
║                                                                     ║
║  [left col: rally-poster.png]  [right col: form completo]          ║
╠══ BATTLE HISTORY ═══════════════════════════════════════════════════╣
║  [cards en grid 3 columnas]                                        ║
╠══ GUARDIAN HALL ════════════════════════════════════════════════════╣
║  [leaderboard con tabs]                                            ║
╚══ FOOTER ═══════════════════════════════════════════════════════════╝
```

### 13.3 Admin Backoffice — Desktop

```
╔══════════════════════════════════════════════════════════════════════╗
║ [admin-bg.png con overlay muy oscuro 85%]                          ║
║ [scanlines]                                                         ║
╠══ HEADER ═══════════════════════════════════════════════════════════╣
║ ⚡ CITADEL COMMAND        ZEUS: $847K  ETH: $3,241   [LOGOUT]     ║
╠══ DEPLOY SECTION ════════════════════════════════════════════════════╣
║  ┌── DEPLOY NEW WALL ──────────────────────────────────────────┐   ║
║  │  [label] TARGET MARKET CAP                                  │   ║
║  │  [ $  850,000              ]  <- input                      │   ║
║  │                                                             │   ║
║  │  ┌── PREVIEW ──────────────────────────────────────────┐   │   ║
║  │  │  Tick:   -204,360 / -204,300                        │   │   ║
║  │  │  MCAP:   $848,200 — $853,100                        │   │   ║
║  │  │  Distance from current: -0.3%                       │   │   ║
║  │  │  ETH price: 0.000000261 ETH/ZEUS                    │   │   ║
║  │  │                                                     │   │   ║
║  │  │  [mini depth chart con zona marcada en rojo]        │   │   ║
║  │  └─────────────────────────────────────────────────────┘   │   ║
║  │                                                             │   ║
║  │  [⚡ DEPLOY CITADEL WALL]                                   │   ║
║  └─────────────────────────────────────────────────────────────┘   ║
╠══ ACTIVE + HISTORY ══════════════════════════════════════════════════╣
║  [ver boceto completo en seccion 4.2]                              ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## 14. ARQUITECTURA TECNICA

### 14.1 Stack (igual que zeus-liquidity, sin cambios)

- Next.js 16, App Router, TypeScript strict
- Tailwind CSS v4
- wagmi v3 + viem + @reown/appkit
- @tanstack/react-query v5
- PostgreSQL (pg) — mismo servidor, schema `citadel`
- Alchemy RPC
- CoinGecko API
- Vitest para tests
- Vercel (deploy)

### 14.2 Polling y tiempo real

El "tiempo real" se consigue con polling en el cliente:

```typescript
// Estado de la muralla (integridad, currentTick) — cada 30s
useQuery({ queryKey: ['citadel-wall'], refetchInterval: 30_000 })

// Precio de ZEUS — cada 60s (ya existente)
useQuery({ queryKey: ['zeus-price'], refetchInterval: 60_000 })

// War Room (guardians activos) — cada 60s
useQuery({ queryKey: ['war-room'], refetchInterval: 60_000 })
```

El servidor detecta si la muralla ha caido cuando llaman a GET /api/citadel/wall:
1. Llama a getCurrentPoolTick (ya existe en lib/uniswap/positions.ts)
2. Si currentTick < wall.tickLower && wall.status === 'active':
   - Marca wall como 'fallen'
   - Crea entrada en citadel.battles
   - Asigna badges LAST STAND

### 14.3 Deteccion de quienes son Guardians de la muralla activa

Para saber quienes tienen posiciones en el rango de la muralla:
1. Reutilizar la logica de `/api/positions/all` existente
2. Filtrar posiciones donde tickLower === wall.tick && tickUpper === wall.tick + 60
3. Cruzar con citadel.guardian_battles para el listado del War Room

### 14.4 Calculo de integridad

```typescript
async function getWallIntegrity(wall: CitadelWall): Promise<number> {
  // Obtener liquidez actual en ese tick range on-chain
  const currentLiq = await getLiquidityAtRange(wall.tick, wall.tick + 60)

  // Actualizar peak si es mayor
  if (!wall.peak_liquidity || currentLiq > BigInt(wall.peak_liquidity)) {
    await updatePeakLiquidity(wall.id, currentLiq.toString())
    return 100
  }

  const peak = BigInt(wall.peak_liquidity)
  if (peak === 0n) return 100

  return Math.round(Number((currentLiq * 100n) / peak))
}
```

---

## 15. BASE DE DATOS — SCHEMA COMPLETO

### 15.1 Schema separation

Se usa el schema `citadel` dentro de la misma PostgreSQL de zeus-liquidity.
Las tablas existentes (zeus_apr_cache, etc.) permanecen en el schema `public`.

```sql
CREATE SCHEMA IF NOT EXISTS citadel;
```

### 15.2 Tablas

```sql
-- La muralla activa o historial de murallas
CREATE TABLE citadel.walls (
  id              SERIAL PRIMARY KEY,
  tick_lower      INTEGER NOT NULL,
  tick_upper      INTEGER NOT NULL,  -- siempre tick_lower + 60
  mcap_usd        NUMERIC NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'fallen', 'demolished')),
  peak_liquidity  TEXT,              -- bigint como string
  fallen_at       TIMESTAMPTZ,
  demolished_at   TIMESTAMPTZ,
  notes           TEXT               -- notas del admin opcionales
);

CREATE INDEX idx_citadel_walls_status ON citadel.walls(status);

-- Registro de batallas terminadas (una por muralla cerrada)
CREATE TABLE citadel.battles (
  id             SERIAL PRIMARY KEY,
  wall_id        INTEGER NOT NULL REFERENCES citadel.walls(id),
  result         TEXT NOT NULL CHECK (result IN ('fallen', 'demolished', 'held')),
  peak_liquidity TEXT,
  guardian_count INTEGER NOT NULL DEFAULT 0,
  total_fees_usd NUMERIC DEFAULT 0,
  breach_mcap    NUMERIC,           -- MCAP cuando cayo (si result = fallen)
  ended_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Primer guardian de cada muralla
CREATE TABLE citadel.first_guardians (
  wall_id         INTEGER PRIMARY KEY REFERENCES citadel.walls(id),
  address         TEXT NOT NULL,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_citadel_fg_address ON citadel.first_guardians(address);

-- Participacion de guardians por batalla (uno por address por muralla)
CREATE TABLE citadel.guardian_battles (
  id          SERIAL PRIMARY KEY,
  address     TEXT NOT NULL,
  wall_id     INTEGER NOT NULL REFERENCES citadel.walls(id),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_last_stand BOOLEAN DEFAULT FALSE,
  UNIQUE(address, wall_id)
);

CREATE INDEX idx_citadel_gb_address ON citadel.guardian_battles(address);
CREATE INDEX idx_citadel_gb_wall ON citadel.guardian_battles(wall_id);
```

### 15.3 Funcion de migracion en lib/db.ts

```typescript
export async function ensureCitadelSchema(): Promise<void> {
  const db = getDb()
  await db.query('CREATE SCHEMA IF NOT EXISTS citadel')
  await db.query(`CREATE TABLE IF NOT EXISTS citadel.walls (...)`)
  await db.query(`CREATE TABLE IF NOT EXISTS citadel.battles (...)`)
  await db.query(`CREATE TABLE IF NOT EXISTS citadel.first_guardians (...)`)
  await db.query(`CREATE TABLE IF NOT EXISTS citadel.guardian_battles (...)`)
  // indices...
}
```

---

## 16. APIS — ESPECIFICACION COMPLETA

### GET /api/citadel/wall

Retorna la muralla activa con integridad calculada en tiempo real.

```typescript
// Response
{
  wall: {
    id: number
    tick_lower: number
    tick_upper: number
    mcap_usd: number
    created_at: string
    status: 'active' | 'fallen' | 'demolished'
    peak_liquidity: string
  } | null,
  integrity: number,          // 0-100
  state: 'impenetrable' | 'besieged' | 'crumbling' | 'critical' | 'fallen' | 'none'
  current_tick: number,
  distance_pct: number,       // % que le falta al precio para llegar a la muralla
  guardian_count: number,
  total_liquidity_usd: number
}

// Si wall.status === 'active' && currentTick < wall.tick_lower:
// -> deteccion automatica de caida: actualiza status, crea batalla, asigna badges
// -> retorna con status = 'fallen'
```

### POST /api/citadel/wall

Requiere header `x-admin-password`.

```typescript
// Request body
{ mcap_usd: number }

// Logica:
// 1. Verificar auth
// 2. Calcular tick_lower = mcapToTick(mcap_usd, ethPrice, totalSupply)
// 3. tick_upper = tick_lower + 60
// 4. Si hay muralla activa: demolerla primero
// 5. Insertar en citadel.walls
// 6. Response: { wall: CitadelWall }
```

### DELETE /api/citadel/wall/[id]

Requiere header `x-admin-password`.

```typescript
// Logica:
// 1. Verificar auth
// 2. Actualizar wall.status = 'demolished'
// 3. Insertar en citadel.battles con result = 'demolished'
// 4. Response: { success: true }
```

### GET /api/citadel/battles

```typescript
// Response
{
  battles: Array<{
    id: number
    wall_id: number
    result: 'fallen' | 'demolished' | 'held'
    peak_liquidity: string
    guardian_count: number
    total_fees_usd: number
    breach_mcap: number | null
    ended_at: string
    wall: { tick_lower, tick_upper, mcap_usd, created_at }
  }>
}
```

### GET /api/citadel/guardian/[addr]

```typescript
// Response
{
  address: string,
  battles_count: number,
  battles_survived: number,
  battles: Array<{ wall_id, mcap_usd, result, joined_at, is_last_stand }>,
  badges: {
    architect: boolean,      // dinamico
    first_guardian: boolean, // permanente
    fee_harvester: boolean,  // dinamico (top1)
    veteran: boolean,        // permanente (>= 5 battles)
    survivor: boolean,       // permanente (alguna batalla held)
    last_stand: boolean,     // permanente (alguna batalla fallen, ultimo 3)
  },
  // Datos de zeus-liquidity existentes:
  fees_total_usd: number,
  fees_pending_usd: number,
  peak_position_usd: number,
  positions: ZeusPosition[]
}
```

### POST /api/citadel/guardian/join

```typescript
// Request body
{ address: string, wall_id: number, tx_hash: string }

// Logica:
// 1. Verificar que la muralla existe y esta activa
// 2. Verificar que el tx_hash es valido (opcional: llamar a eth_getTransaction)
// 3. INSERT INTO citadel.guardian_battles (address, wall_id) ON CONFLICT DO NOTHING
// 4. Si es el primero: INSERT INTO citadel.first_guardians (wall_id, address)
// 5. Response: { registered: true, is_first_guardian: boolean }
```

---

## 17. COMPONENTES UI — LISTA COMPLETA

### Nuevos componentes

| Ruta | Descripcion |
|------|-------------|
| `app/admin/page.tsx` | Backoffice con auth, deploy/demolish, historial |
| `app/battles/page.tsx` | Historial completo de batallas |
| `app/api/citadel/wall/route.ts` | GET + POST |
| `app/api/citadel/wall/[id]/route.ts` | DELETE |
| `app/api/citadel/battles/route.ts` | GET historial |
| `app/api/citadel/guardian/[addr]/route.ts` | GET perfil + badges |
| `app/api/citadel/guardian/join/route.ts` | POST join |
| `components/citadel/ActiveBattle.tsx` | Seccion central: imagen muro + stats, 4 estados |
| `components/citadel/WallImage.tsx` | Imagen del muro con animaciones segun estado |
| `components/citadel/WallHealthBar.tsx` | Barra de integridad animada |
| `components/citadel/WarRoom.tsx` | Tabla de guardians activos con badges |
| `components/citadel/JoinCitadelForm.tsx` | Form preconfigurado al tick de la muralla |
| `components/citadel/BattleHistory.tsx` | Cards de batallas pasadas |
| `components/citadel/BattleReportModal.tsx` | Modal con detalle de una batalla |
| `components/citadel/GuardianBadges.tsx` | Display de badges hexagonales |
| `components/citadel/GuardianHall.tsx` | Leaderboard all-time con tabs |
| `components/citadel/DataRain.tsx` | Animacion matrix rain CSS (hero background) |
| `components/citadel/SiegePulse.tsx` | Efecto de borde pulsante en siege mode |
| `hooks/useCitadelWall.ts` | useQuery para wall status, polling 30s |
| `hooks/useCitadelBattles.ts` | useQuery para historial de batallas |
| `hooks/useGuardianProfile.ts` | useQuery para perfil y badges de un address |
| `lib/citadel/wallState.ts` | Funciones: getWallState, getWallIntegrity, detectBreach |

### Componentes existentes modificados

| Ruta | Modificacion |
|------|-------------|
| `app/page.tsx` | Rediseno completo: nuevo layout cyberpunk, integra ActiveBattle, WarRoom, JoinCitadelForm, BattleHistory, GuardianHall |
| `app/[address]/page.tsx` | Anade GuardianBadges, battle history del guardian, stats de citadel |
| `app/globals.css` | Nueva paleta completa, fuentes Orbitron+Rajdhani+ShareTechMono, animaciones, scanlines |
| `app/layout.tsx` | Nuevas fuentes |
| `lib/db.ts` | Anade ensureCitadelSchema() con las 4 nuevas tablas |
| `components/positions/PositionsList.tsx` | Integra info de muralla activa si la posicion coincide con el tick |

---

## APENDICE: VARIABLES DE ENTORNO

```env
# Existentes (mismas de zeus-liquidity)
NEXT_PUBLIC_COINGECKO_API_KEY=
ALCHEMY_API_KEY=
NEXT_PUBLIC_REOWN_PROJECT_ID=
DATABASE_URL=
NEXT_PUBLIC_CHAIN_ID=1

# Nueva
ADMIN_PASSWORD=    # contrasena del backoffice /admin (solo servidor)
```

---

*CITADEL PROTOCOL — Game Design Document v1.0*
*Base project: zeus-liquidity | Target repo: gotoalberto/helm*
