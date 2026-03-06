"use client"

/**
 * DataStorm — Three.js hero background
 * Particles + data rain 3D effect with mouse repulsion
 */

import { useRef, useMemo, useEffect, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"

// ─── Particle Field ──────────────────────────────────────────────────────────
function ParticleField({ mousePos }: { mousePos: { x: number; y: number } }) {
  const count = 200
  const pointsRef = useRef<THREE.Points>(null)
  const { viewport } = useThree()

  const { positions, velocities } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * viewport.width * 2
      positions[i * 3 + 1] = (Math.random() - 0.5) * viewport.height * 2
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10
      velocities[i * 3] = (Math.random() - 0.5) * 0.01
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.01
      velocities[i * 3 + 2] = 0
    }
    return { positions, velocities }
  }, [viewport]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    if (!pointsRef.current) return
    const pos = (pointsRef.current.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array
    const mx = mousePos.x * viewport.width
    const my = mousePos.y * viewport.height

    for (let i = 0; i < count; i++) {
      const xi = i * 3
      const yi = i * 3 + 1

      // Mouse repulsion
      const dx = pos[xi] - mx
      const dy = pos[yi] - my
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 2) {
        const force = (2 - dist) / 2
        velocities[xi] += (dx / dist) * force * 0.05
        velocities[yi] += (dy / dist) * force * 0.05
      }

      // Apply velocity + damping
      velocities[xi] *= 0.95
      velocities[yi] *= 0.95
      pos[xi] += velocities[xi]
      pos[yi] += velocities[yi]

      // Wrap around edges
      if (pos[xi] > viewport.width) pos[xi] = -viewport.width
      if (pos[xi] < -viewport.width) pos[xi] = viewport.width
      if (pos[yi] > viewport.height) pos[yi] = -viewport.height
      if (pos[yi] < -viewport.height) pos[yi] = viewport.height
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#00f5ff" size={0.05} transparent opacity={0.5} />
    </points>
  )
}

// ─── Data Rain Columns ───────────────────────────────────────────────────────
function DataRainColumns() {
  const count = 30
  const groupRef = useRef<THREE.Group>(null)

  const columns = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      x: (Math.random() - 0.5) * 30,
      speed: 0.5 + Math.random() * 1.5,
      y: (Math.random() - 0.5) * 20,
      opacity: 0.1 + Math.random() * 0.4,
    }))
  }, [])

  useFrame((_, delta) => {
    if (!groupRef.current) return
    columns.forEach((col, i) => {
      const child = groupRef.current!.children[i] as THREE.Mesh
      if (!child) return
      col.y -= col.speed * delta
      if (col.y < -10) col.y = 10
      child.position.y = col.y
    })
  })

  return (
    <group ref={groupRef}>
      {columns.map((col, i) => (
        <mesh key={i} position={[col.x, col.y, -5]}>
          <planeGeometry args={[0.02, 2]} />
          <meshBasicMaterial color="#00f5ff" transparent opacity={col.opacity} />
        </mesh>
      ))}
    </group>
  )
}

// ─── Scene ───────────────────────────────────────────────────────────────────
function StormScene({ mousePos }: { mousePos: { x: number; y: number } }) {
  return (
    <>
      <ParticleField mousePos={mousePos} />
      <DataRainColumns />
    </>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export function DataStorm({ style }: { style?: React.CSSProperties }) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      setMousePos({
        x: ((e.clientX - rect.left) / rect.width - 0.5) * 2,
        y: -((e.clientY - rect.top) / rect.height - 0.5) * 2,
      })
    }
    window.addEventListener("mousemove", onMouseMove)
    return () => window.removeEventListener("mousemove", onMouseMove)
  }, [])

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", ...style }}>
      <Canvas camera={{ position: [0, 0, 10], fov: 60 }} gl={{ antialias: false, alpha: true }}>
        <StormScene mousePos={mousePos} />
      </Canvas>
    </div>
  )
}
