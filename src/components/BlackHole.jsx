import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sharedState } from '../store/sharedState'

export function BlackHole() {
  const horizonRef = useRef()
  const ringRef = useRef()

  const ringMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(0, 0.94, 1.0),
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  }, [])

  useFrame((state) => {
    const t = state.clock.elapsedTime

    if (horizonRef.current) {
      // Subtle pulsing of the event horizon silhouette
      const scale = 1.0 + Math.sin(t * 0.8) * 0.005
      horizonRef.current.scale.setScalar(scale)
    }

    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.05
      const opacity = 0.55 * (1.0 - sharedState.transitionProgress)
      ringMaterial.opacity = opacity
    }
  })

  return (
    <group>
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
