import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sharedState } from '../store/sharedState'

export function BlackHole() {
  const horizonRef = useRef()
  const ringRef = useRef()
  const glowRef = useRef()

  const ringMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(0, 0.94, 1.0),
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  }, [])

  const glowMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.15, 0.35, 0.6),
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  }, [])

  const _coldColor = new THREE.Color(0.12, 0.35, 0.65)
  const _warmColor = new THREE.Color(0.9, 0.62, 0.12)
  const _tempColor = new THREE.Color()

  useFrame((state) => {
    const t = state.clock.elapsedTime

    // 4-second breathing cycle
    const breathCycle = 4.0
    const breath = (Math.sin(t * (Math.PI * 2 / breathCycle)) * 0.5 + 0.5)

    if (horizonRef.current) {
      const scale = 1.0 + Math.sin(t * 0.8) * 0.005
      horizonRef.current.scale.setScalar(scale)
    }

    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.05
      // Breathing modulates ring opacity
      const baseOpacity = 0.55 + breath * 0.2
      const opacity = baseOpacity * (1.0 - THREE.MathUtils.smoothstep(sharedState.transitionProgress, 0.68, 0.84))
      ringMaterial.opacity = opacity
    }

    if (glowRef.current) {
      // Breathing modulates glow scale and opacity
      const pulseScale = 1.0 + breath * 0.06 + Math.sin(t * 0.6) * 0.01
      glowRef.current.scale.setScalar(pulseScale)

      // Halo color shifts from cold blue to warm gold based on input energy
      const energy = sharedState.inputEnergy
      _tempColor.copy(_coldColor).lerp(_warmColor, energy)
      glowMaterial.color.copy(_tempColor)

      const baseGlow = 0.12 + breath * 0.08
      glowMaterial.opacity = baseGlow + sharedState.transitionProgress * 0.2 + energy * 0.05
    }
  })

  return (
    <group>
      {/* Gravitational lensing glow halo */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[3.8, 32, 32]} />
        <primitive object={glowMaterial} attach="material" />
      </mesh>

      {/* Event horizon - pure black sphere */}
      <mesh ref={horizonRef}>
        <sphereGeometry args={[2.6, 64, 64]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Photon ring - thin cyan Einstein ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.3, 3.5, 128]} />
        <primitive object={ringMaterial} attach="material" />
      </mesh>
    </group>
  )
}
