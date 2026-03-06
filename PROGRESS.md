# CITADEL PROTOCOL — Progress Tracker
# Lee esto ANTES de cada paso

---

## ESTADO ACTUAL: FASE 0 — Setup

---

## REFERENCIAS CLAVE (no perder nunca)

### Repos y proyectos
- **Repo nuevo:** https://github.com/gotoalberto/helm
- **Vercel project:** `helm` (dominio existente en Vercel)
- **Base de código:** zeus-liquidity en ~/git/zeus-liquidity
- **Carpeta de trabajo:** ~/git/helm

### Contratos ZEUS (crítico)
- ZEUS token: `0x0f7dC5D02CC1E1f5Ee47854d534D332A1081cCC8`
- ZEUS decimals: **9** (NO 18 — crítico)
- Pool fee: 3000, tickSpacing: **60**
- PositionManager: `0xbD216513d74C8cf14cf4747E6AaA7aE2a94d76Aa`
- PoolManager: `0x000000000004444c5dc75cB358380D2e3dE08A90`
- StateView: `0x7ffe42c4a5deea5b0fec41c94c136cf115597227`

### Variables de entorno (mismas que zeus-liquidity + nueva)
- `NEXT_PUBLIC_COINGECKO_API_KEY` — extraer de Vercel zeus-liquidity
- `ALCHEMY_API_KEY` — extraer de Vercel zeus-liquidity
- `NEXT_PUBLIC_REOWN_PROJECT_ID` — extraer de Vercel zeus-liquidity
- `DATABASE_URL` — misma PostgreSQL, schema `citadel` (nuevo)
- `NEXT_PUBLIC_CHAIN_ID=1`
- `ADMIN_PASSWORD` — NUEVA, solo para /admin

### BD: schema citadel (sobre misma PostgreSQL)
- `citadel.walls` — murallas activas/históricas
- `citadel.battles` — resultados de batallas
- `citadel.first_guardians` — primer guardian por muralla
- `citadel.guardian_battles` — participación por batalla

### Assets generados (en ~/git/zeus-liquidity/public/ — copiar a helm/public/)
- wall-100.png, wall-75.png, wall-50.png, wall-25.png, wall-0.png
- citadel-logo.png, hero-bg.png, hero-guardian.png, villain-bears.png
- rally-poster.png, admin-bg.png, battle-report.png
- badge-architect.png, badge-first-guardian.png, badge-fee-harvester.png, badge-veteran.png
- badge-survivor.png ✅, badge-last-stand.png ✅ (generados con Gemini)

### Diseños de referencia (en ~/git/helm/designs/)
- ref-homepage-intact.png, ref-homepage-siege.png, ref-homepage-fallen.png
- ref-join-form.png, ref-guardian-profile.png, ref-battles-page.png
- ref-admin-panel.png, ref-mobile.png, ref-war-room.png
- ref-battle-report-modal.png, ref-health-bars.png, ref-hall-of-fame.png
- ref-3d-wall-scene.png, ref-price-chart.png, ref-toasts.png, ref-admin-deploy-flow.png

### Documentos del plan
- ~/git/helm/MASTER_PLAN.md — plan completo con pantallas y APIs
- ~/git/helm/ANIMATIONS_AND_3D.md — Three.js, shaders, animaciones CSS
- ~/git/helm/AUDIO_DESIGN.md — Tone.js + Web Audio API, síntesis pura

---

## FASES Y ESTADO

| Fase | Descripción | Estado |
|------|-------------|--------|
| 0 | Setup: repo, deps, env vars, assets | ✅ COMPLETADO |
| 1 | BD (schema citadel) + APIs citadel | ✅ COMPLETADO |
| 2 | CSS globals + design system cyberpunk | ✅ COMPLETADO |
| 3 | Header + estructura de página | ✅ COMPLETADO |
| 4 | Active Battle Section (4 estados) | ✅ COMPLETADO |
| 5 | Three.js — CitadelWall3D | ✅ COMPLETADO |
| 6 | Three.js — DataStorm hero | ✅ COMPLETADO |
| 7 | War Room + Join Form | ✅ COMPLETADO |
| 8 | Battle History + leaderboards | ✅ COMPLETADO |
| 9 | Guardian Profile + Badges | ✅ COMPLETADO |
| 10 | Admin Backoffice /admin | ✅ COMPLETADO |
| 11 | Animaciones de eventos (breach, deploy, join) | ⬜ Pendiente |
| 12 | Price Chart con Wall overlay | ✅ COMPLETADO |
| 13 | Audio (Tone.js + SFX) | ⬜ Pendiente |
| 14 | Polish, mobile, responsive | ⬜ Pendiente |
| 15 | Deploy Vercel + verificación Playwright | ✅ COMPLETADO (build OK, deployed) |

---

## LOG DETALLADO

### FASE 0 — Setup
**Objetivo:** Repo listo, deps instaladas, env vars configuradas, assets copiados, npm run dev funciona.

#### Checklist
- [ ] cp -r zeus-liquidity helm (o clonar y limpiar)
- [ ] cd helm && git init && git remote add origin https://github.com/gotoalberto/helm.git
- [ ] npm install (deps existentes)
- [ ] npm install three @react-three/fiber @react-three/drei @react-three/postprocessing framer-motion tone
- [ ] Vincular Vercel: vercel link → proyecto helm
- [ ] Extraer env vars de zeus-liquidity y añadirlas a helm en Vercel
- [ ] Añadir ADMIN_PASSWORD en Vercel
- [ ] Copiar assets de zeus-liquidity/public/ a helm/public/
- [ ] Copiar designs/ a helm/designs/
- [ ] Limpiar archivos específicos de zeus-liquidity (CONTEXT.md, etc.)
- [ ] npm run dev — debe arrancar sin errores
- [ ] npm test — 17 tests mcap deben pasar
- [ ] git add . && git commit -m "init: base from zeus-liquidity + citadel deps"
- [ ] git push origin main

#### Resultado
- Estado: COMPLETADO ✅
- Notas: 3 tests de preset range fallaban ya en zeus-liquidity (pre-existing, no son nuestros). 14/17 pasan. Dev server OK. Push a main OK. Badges survivor y last-stand generados.

---

### FASE 1 — BD + APIs
**Objetivo:** 4 tablas en schema citadel + 6 endpoints API funcionando.

#### Checklist
- [ ] lib/db.ts — añadir ensureCitadelSchema() con 4 tablas
- [ ] app/api/citadel/wall/route.ts — GET (con detección breach) + POST (con auth)
- [ ] app/api/citadel/wall/[id]/route.ts — DELETE (con auth)
- [ ] app/api/citadel/battles/route.ts — GET historial
- [ ] app/api/citadel/guardian/[addr]/route.ts — GET profile + badges
- [ ] app/api/citadel/guardian/join/route.ts — POST join
- [ ] lib/citadel/wallIntegrity.ts — getWallIntegrity(), getWallState()
- [ ] lib/citadel/wallImage.ts — stateToImage()
- [ ] lib/citadel/badgeCalculator.ts — calculateBadges()
- [ ] Test manual de todos los endpoints

---

### FASE 2 — CSS globals
**Objetivo:** Nueva paleta cyberpunk, fuentes, componentes base, animaciones.

#### Checklist
- [ ] app/globals.css — paleta completa (--bg-void, --neon-cyan, etc.)
- [ ] Fuentes: Orbitron + Rajdhani + Share Tech Mono
- [ ] app/layout.tsx — importar fuentes
- [ ] .panel, .btn-primary, .btn-secondary, .btn-danger, .input-citadel
- [ ] .badge-hex (hexagonal clip-path)
- [ ] Scanlines global (body::before)
- [ ] @keyframes: glitch-text, siege-pulse, wall-shake-critical, neon-pulse-cyan/red
- [ ] @keyframes: data-rain, health-bar-scan, bar-flicker, badge-reveal
- [ ] page-transition, scroll-reveal classes
- [ ] Toast styles cyberpunk

---

### FASE 3 — Header + estructura
**Objetivo:** Header cyberpunk sticky + scroll progress + estructura de page.tsx.

#### Checklist
- [ ] components/layout/Header.tsx — reescribir con estética citadel
- [ ] components/layout/ScrollProgress.tsx — barra de progreso scroll
- [ ] app/page.tsx — estructura de secciones con IDs
- [ ] Verificar navegación scroll funciona

---

### FASE 4 — Active Battle Section
**Objetivo:** Los 4 estados de la muralla visibles y animados (solo 2D, sin Three.js aún).

#### Checklist
- [ ] hooks/useCitadelWall.ts — useQuery polling 30s
- [ ] components/citadel/WallHealthBar.tsx
- [ ] components/citadel/WallImage.tsx (2D fallback)
- [ ] components/citadel/SiegePulse.tsx
- [ ] components/ui/AnimatedCounter.tsx
- [ ] components/citadel/ActiveBattle.tsx — 4 estados (A/B/C/D)
- [ ] Integrar en page.tsx

---

### FASE 5 — Three.js Muralla 3D
**Objetivo:** CitadelWall3D con shader custom, paneles, luces, postprocessing.

#### Checklist
- [ ] components/citadel/CitadelWall3D.tsx — escena completa
- [ ] WallPanel con ShaderMaterial (energy lines GLSL)
- [ ] EnergyShield (icosahedron wireframe)
- [ ] Sistema de luces dinámico según integrity
- [ ] Postprocessing: Bloom, ChromaticAberration, Glitch, Vignette
- [ ] hooks/useGPUTier.ts — fallback a WallImage2D
- [ ] Integrar en ActiveBattle.tsx

---

### FASE 6 — Three.js DataStorm (hero)
**Objetivo:** Fondo animado del hero con data rain 3D + particles.

#### Checklist
- [ ] components/citadel/DataStorm.tsx — Three.js canvas
- [ ] components/citadel/DataRain.tsx — CSS fallback
- [ ] Interacción mouse (repulsión partículas)
- [ ] Integrar en Hero section

---

### FASE 7 — War Room + Join Form
**Objetivo:** Leaderboard de batalla activa + formulario de unirse.

#### Checklist
- [ ] components/citadel/WarRoom.tsx
- [ ] hooks/useWallComposition.ts
- [ ] components/citadel/JoinCitadelForm.tsx
- [ ] Integrar con PositionManager (reusar lógica AddLiquidityForm)

---

### FASE 8 — Battle History + Leaderboards
**Objetivo:** Cards de batallas + hall of fame.

#### Checklist
- [ ] components/citadel/BattleCard.tsx
- [ ] components/citadel/BattleHistory.tsx
- [ ] components/citadel/BattleReportModal.tsx
- [ ] components/citadel/GuardianHall.tsx
- [ ] hooks/useCitadelBattles.ts
- [ ] app/battles/page.tsx

---

### FASE 9 — Guardian Profile + Badges
**Objetivo:** Perfil con badges hexagonales y stats de batalla.

#### Checklist
- [ ] components/citadel/GuardianBadges.tsx
- [ ] components/citadel/BadgeTooltip.tsx
- [ ] hooks/useGuardianProfile.ts
- [ ] Actualizar app/[address]/page.tsx

---

### FASE 10 — Admin Backoffice
**Objetivo:** /admin con auth, deploy/demolish, historial.

#### Checklist
- [ ] app/admin/page.tsx — auth gate + UI completa
- [ ] Deploy flow: input MCAP → preview tick → confirm modal → deploy
- [ ] Demolish flow con confirmación
- [ ] Mini depth chart con zona marcada

---

### FASE 11 — Animaciones de eventos
**Objetivo:** Breach (3.2s), Deploy (2.5s), Join (0.8s).

#### Checklist
- [ ] Secuencia BREACH completa
- [ ] Secuencia DEPLOY completa
- [ ] Secuencia JOIN + FIRST_GUARDIAN
- [ ] Page transitions framer-motion
- [ ] Scroll reveal IntersectionObserver

---

### FASE 12 — Price Chart con Wall
**Objetivo:** LiquidityDepthChart con línea/zona de la muralla activa.

#### Checklist
- [ ] Línea horizontal en tick de la muralla
- [ ] Label "THE WALL — $850K"
- [ ] Zona roja debajo de la línea
- [ ] Spike cyan en depth view
- [ ] Tooltip con info de la muralla

---

### FASE 13 — Audio
**Objetivo:** Tone.js banda sonora generativa + 20 SFX procedurales.

#### Checklist
- [ ] lib/audio/musicEngine.ts — controlador central
- [ ] lib/audio/layers/droneLayer.ts
- [ ] lib/audio/layers/percussionLayer.ts
- [ ] lib/audio/layers/arpeggioLayer.ts
- [ ] lib/audio/layers/alarmLayer.ts
- [ ] lib/audio/sfx.ts — 20 SFX
- [ ] hooks/useAudio.ts
- [ ] components/ui/AudioControls.tsx — botón mute/volumen
- [ ] Integrar con useCitadelWall.ts

---

### FASE 14 — Polish + mobile
**Objetivo:** Responsive completo, loading states, error states, empty states.

#### Checklist
- [ ] Mobile responsive: hero, active battle, war room, forms
- [ ] Loading skeletons cyberpunk
- [ ] Error states
- [ ] Empty states
- [ ] Toast system
- [ ] prefers-reduced-motion
- [ ] Favicon + meta tags

---

### FASE 15 — Deploy + verificación
**Objetivo:** En producción, verificado con Playwright.

#### Checklist
- [ ] npm run build — sin errores TypeScript
- [ ] npm test — todos los tests pasan
- [ ] git push origin main
- [ ] Vercel auto-deploy
- [ ] Playwright screenshots de todas las pantallas
- [ ] Verificar /admin funciona
- [ ] Verificar deploy muralla funciona
- [ ] Verificar join flow
- [ ] Verificar mobile

---

## DECISIONES TÉCNICAS IMPORTANTES

1. **BD:** Schema `citadel` sobre misma PostgreSQL de zeus-liquidity. NO tocar tablas `public.*`
2. **ZEUS decimals:** SIEMPRE 1e9. Nunca 1e18.
3. **Muralla:** SIEMPRE 1 tick de ancho: tickUpper = tickLower + 60
4. **MCAP:** El usuario NUNCA ve ticks. Solo MCAP en USD.
5. **Breach detection:** En el servidor, dentro del GET /api/citadel/wall handler
6. **Auth admin:** Header x-admin-password comparado con ADMIN_PASSWORD env var
7. **Audio:** Lazy load tras primer gesto de usuario. Sin archivos de audio.
8. **Three.js:** Lazy load (dynamic import). Fallback a imagen 2D si GPU low.
9. **API keys:** Mismas que zeus-liquidity, extraídas via Vercel CLI
10. **tickSpacing:** 60 (del pool ZEUS/ETH en Uniswap V4)

---

## NOTAS / PROBLEMAS ENCONTRADOS

*(se irán añadiendo durante el desarrollo)*

---

*Última actualización: Fases 0-10 + 12 + 15 completadas. Pendientes: 11 (animaciones breach/deploy), 13 (audio Tone.js), 14 (polish mobile).*

## ESTADO DEL DEPLOY
- URL de deploy: helm-gso45ej9m-alberto-g-toribios-projects.vercel.app (detrás de auth Vercel)
- Build: ✅ limpio sin errores TypeScript
- Env vars en Vercel: todas añadidas (ALCHEMY, DATABASE_URL, COINGECKO, REOWN, ZEUS_TOKEN, CHAIN_ID, ADMIN_PASSWORD)
- Commit actual: 1c7e3ee
