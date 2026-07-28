import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sharedState } from '../store/sharedState'
import { nebulaVertexShader, nebulaFragmentShader } from '../shaders/nebula.js'

export function NebulaBackground() {
  const meshRef = useRef()

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: nebulaVertexShader,
      fragmentShader: nebulaFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uTransitionProgress: { value: 0 },
        uIsTransitioning: { value: 0 }
      },
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false
    })
  }, [])

  useFrame((state) => {
    const mat = meshRef.current?.material
    if (mat) {
      mat.uniforms.uTime.value = state.clock.elapsedTime
      mat.uniforms.uTransitionProgress.value = sharedState.transitionProgress
      mat.uniforms.uIsTransitioning.value = sharedState.isTransitioning ? 1 : 0
    }
  })

  return (
    <mesh ref={meshRef} renderOrder={-1}>
      <sphereGeometry args={[900, 64, 64]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}
