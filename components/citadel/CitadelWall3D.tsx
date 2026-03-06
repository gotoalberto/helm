"use client"

/**
 * CitadelWall3D — Three.js 3D wall scene
 * Uses @react-three/fiber + @react-three/drei + postprocessing
 * Lazy loaded; fallback to 2D image on low GPU
 *
 * Wall states:
 *  INTACT   → full blue/cyan energy panels
 *  SIEGE    → yellow/orange cracks appearing
 *  CRITICAL → red flickering, heavy damage
 *  FALLEN   → dark rubble, red embers
 */

import { Suspense, useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Environment } from "@react-three/drei"
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from "@react-three/postprocessing"
import * as THREE from "three"
import type { WallState } from "@/lib/citadel/wallIntegrity"

// ─── Energy shader material ──────────────────────────────────────────────────
const energyVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  uniform float uTime;

  void main() {
    vUv = uv;
    vPosition = position;
    vec3 pos = position;
    pos.z += sin(pos.x * 3.0 + uTime * 2.0) * 0.02;
    pos.z += sin(pos.y * 5.0 + uTime * 1.5) * 0.015;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const energyFragmentShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  uniform float uTime;
  uniform float uIntegrity;
  uniform vec3 uColor;
  uniform vec3 uColorSecondary;

  float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898,78.233))) * 43758.5453);
  }

  void main() {
    // Energy lines horizontal
    float hLine = step(0.97, fract(vUv.y * 20.0 + uTime * 0.5));
    // Energy lines vertical
    float vLine = step(0.97, fract(vUv.x * 20.0));
    // Grid glow
    float grid = max(hLine, vLine);

    // Pulse from center
    vec2 center = vec2(0.5, 0.5);
    float dist = length(vUv - center);
    float pulse = sin(dist * 20.0 - uTime * 3.0) * 0.5 + 0.5;
    pulse *= (1.0 - dist * 1.5);

    // Noise overlay
    float noise = rand(vUv + uTime * 0.01) * 0.05;

    // Damage cracks (lower with integrity)
    float crack = step(0.98, rand(vUv * 5.0)) * (1.0 - uIntegrity);

    float intensity = grid * 0.8 + pulse * 0.3 + noise + crack * 0.5;

    // Mix colors based on integrity
    vec3 color = mix(uColorSecondary, uColor, uIntegrity);
    color += crack * vec3(1.0, 0.2, 0.0);

    float alpha = intensity * 0.85 + 0.1;
    gl_FragColor = vec4(color * intensity, alpha);
  }
`

// ─── Wall Panel Component ─────────────────────────────────────────────────────
function WallPanel({ position, integrity, wallState }: {
  position: [number, number, number]
  integrity: number
  wallState: WallState
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const primaryColor = wallState === "INTACT" ? new THREE.Color(0x00f5ff)
    : wallState === "SIEGE" ? new THREE.Color(0xffe600)
    : wallState === "CRITICAL" ? new THREE.Color(0xff6600)
    : new THREE.Color(0xff2244)

  const secondaryColor = wallState === "INTACT" ? new THREE.Color(0x004466)
    : wallState === "SIEGE" ? new THREE.Color(0x443300)
    : wallState === "CRITICAL" ? new THREE.Color(0x440000)
    : new THREE.Color(0x220000)

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uIntegrity: { value: integrity / 100 },
    uColor: { value: primaryColor },
    uColorSecondary: { value: secondaryColor },
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta
      materialRef.current.uniforms.uIntegrity.value = integrity / 100
    }
    if (meshRef.current && wallState === "CRITICAL") {
      meshRef.current.position.x = position[0] + (Math.random() - 0.5) * 0.008
    }
  })

  return (
    <mesh ref={meshRef} position={position}>
      <boxGeometry args={[1.8, 2.8, 0.1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={energyVertexShader}
        fragmentShader={energyFragmentShader}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// ─── Energy Shield ────────────────────────────────────────────────────────────
function EnergyShield({ integrity, wallState }: { integrity: number; wallState: WallState }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const color = wallState === "INTACT" ? "#00f5ff"
    : wallState === "SIEGE" ? "#ffe600"
    : wallState === "CRITICAL" ? "#ff6600"
    : "#ff2244"

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.3
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.15
      const opacity = (integrity / 100) * 0.3 + 0.05
      ;(meshRef.current.material as THREE.MeshBasicMaterial).opacity = opacity
    }
  })

  if (integrity === 0) return null

  return (
    <mesh ref={meshRef} scale={[2, 2, 2]}>
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial color={color} wireframe transparent opacity={0.15} />
    </mesh>
  )
}

// ─── Floating Particles ──────────────────────────────────────────────────────
function Particles({ integrity, wallState }: { integrity: number; wallState: WallState }) {
  const count = 80
  const color = wallState === "FALLEN" ? "#ff2244" : wallState === "CRITICAL" ? "#ff6600" : "#00f5ff"

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 8
      arr[i * 3 + 1] = (Math.random() - 0.5) * 6
      arr[i * 3 + 2] = (Math.random() - 0.5) * 4
    }
    return arr
  }, [])

  const pointsRef = useRef<THREE.Points>(null)

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.05
      const posArray = (pointsRef.current.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array
      for (let i = 0; i < count; i++) {
        posArray[i * 3 + 1] += Math.sin(state.clock.elapsedTime + i) * 0.002
      }
      pointsRef.current.geometry.attributes.position.needsUpdate = true
    }
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.04} transparent opacity={0.6} />
    </points>
  )
}

// ─── Wall Scene ──────────────────────────────────────────────────────────────
function WallScene({ integrity, wallState }: { integrity: number; wallState: WallState }) {
  const panels: [number, number, number][] = [
    [-2, 0, 0], [0, 0, 0], [2, 0, 0],
    [-1, 2.9, 0], [1, 2.9, 0],
  ]

  const ambientColor = wallState === "INTACT" ? "#002233"
    : wallState === "SIEGE" ? "#221100"
    : wallState === "CRITICAL" ? "#220000"
    : "#110000"

  const pointColor = wallState === "INTACT" ? "#00f5ff"
    : wallState === "SIEGE" ? "#ffe600"
    : wallState === "CRITICAL" ? "#ff4400"
    : "#ff2244"

  return (
    <>
      <ambientLight color={ambientColor} intensity={0.5} />
      <pointLight color={pointColor} intensity={integrity / 100 * 3 + 0.5} position={[0, 0, 3]} />
      <pointLight color={pointColor} intensity={0.5} position={[-3, 2, 2]} />

      {panels.map((pos, i) => (
        <WallPanel key={i} position={pos} integrity={integrity} wallState={wallState} />
      ))}

      <EnergyShield integrity={integrity} wallState={wallState} />
      <Particles integrity={integrity} wallState={wallState} />

      <EffectComposer>
        <Bloom intensity={wallState === "CRITICAL" ? 2.5 : wallState === "SIEGE" ? 1.5 : 1} luminanceThreshold={0.3} radius={0.8} />
        <ChromaticAberration offset={[0.002, 0.002]} radialModulation={false} modulationOffset={1} />
        <Vignette eskil={false} offset={0.1} darkness={0.8} />
      </EffectComposer>

      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} maxPolarAngle={Math.PI * 0.6} minPolarAngle={Math.PI * 0.3} />
    </>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────
interface CitadelWall3DProps {
  integrity: number
  wallState: WallState
  className?: string
  style?: React.CSSProperties
}

export function CitadelWall3D({ integrity, wallState, className, style }: CitadelWall3DProps) {
  return (
    <div className={className} style={{ width: "100%", height: "100%", ...style }}>
      <Canvas
        camera={{ position: [0, 0, 8], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <WallScene integrity={integrity} wallState={wallState} />
        </Suspense>
      </Canvas>
    </div>
  )
}
