import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sharedState } from '../store/sharedState'
import {
  accretionDiskVertexShader,
  accretionDiskFragmentShader
} from '../shaders/accretionDisk.js'

export function AccretionDisk() {
  const mainDiskRef = useRef()
  const lensedDiskRef = useRef()

  const createMaterial = () =>
    new THREE.ShaderMaterial({
      vertexShader: accretionDiskVertexShader,
      fragmentShader: accretionDiskFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uTransitionProgress: { value: 0 },
        uIsTransitioning: { value: 0 }
      },
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })

  const mainMaterial = useMemo(() => createMaterial(), [])
  const lensedMaterial = useMemo(() => createMaterial(), [])

  useFrame((state) => {
    const t = state.clock.elapsedTime

    if (mainDiskRef.current) {
      mainDiskRef.current.rotation.z = t * 0.04
      mainDiskRef.current.material.uniforms.uTime.value = t
      mainDiskRef.current.material.uniforms.uTransitionProgress.value =
        sharedState.transitionProgress
      mainDiskRef.current.material.uniforms.uIsTransitioning.value =
        sharedState.isTransitioning ? 1 : 0
    }

    if (lensedDiskRef.current) {
      lensedDiskRef.current.rotation.y = t * 0.025
      lensedDiskRef.current.material.uniforms.uTime.value = t
      lensedDiskRef.current.material.uniforms.uTransitionProgress.value =
        sharedState.transitionProgress
      lensedDiskRef.current.material.uniforms.uIsTransitioning.value =
        sharedState.isTransitioning ? 1 : 0
    }
  })

  return (
    <group>
      {/* Main accretion disk - slightly tilted */}
      <mesh ref={mainDiskRef} rotation={[-Math.PI / 2 + 0.14, 0, 0]}>
        <ringGeometry args={[3.5, 18.0, 320, 8]} />
        <primitive object={mainMaterial} attach="material" />
      </mesh>

      {/* Lensed "halo" disk - vertical arc simulating gravitational lensing */}
      <mesh ref={lensedDiskRef} rotation={[0.14, 0, 0]}>
        <ringGeometry args={[3.7, 16.0, 320, 8]} />
        <primitive object={lensedMaterial} attach="material" />
      </mesh>
    </group>
  )
}
