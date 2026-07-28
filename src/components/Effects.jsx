import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  EffectComposer,
  Bloom,
  Vignette,
  ChromaticAberration,
  Noise
} from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import { sharedState } from '../store/sharedState'

export function Effects() {
  const chromaRef = useRef()
  const bloomRef = useRef()
  const vignetteRef = useRef()

  useFrame(() => {
    if (sharedState.isTransitioning) {
      const t = sharedState.transitionProgress

      // Progressive chromatic aberration for warp distortion
      if (chromaRef.current) {
        const offset = 0.0005 + Math.sin(Math.min(1, t / 0.88) * Math.PI) * 0.022
        const chromaAngle = t * Math.PI * 5
        chromaRef.current.offset.set(
          Math.cos(chromaAngle) * offset,
          Math.sin(chromaAngle) * offset
        )
      }

      // Bloom intensifies during warp
      if (bloomRef.current) {
        bloomRef.current.intensity = 0.5 + t * 2.2
        bloomRef.current.radius = 0.5 + t * 0.5
        bloomRef.current.luminanceThreshold = Math.max(0.1, 0.35 - t * 0.2)
      }

      // Vignette darkens edges for tunnel effect
      if (vignetteRef.current) {
        vignetteRef.current.darkness = 0.82 + Math.sin(Math.min(1, t / 0.88) * Math.PI) * 0.16
      }
    } else {
      if (chromaRef.current) {
        chromaRef.current.offset.set(0.0005, 0.0005)
      }
      if (bloomRef.current) {
        bloomRef.current.intensity = 0.5
        bloomRef.current.radius = 0.5
        bloomRef.current.luminanceThreshold = 0.35
      }
      if (vignetteRef.current) {
        vignetteRef.current.darkness = 0.82
      }
    }
  })

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        ref={bloomRef}
        intensity={0.5}
        radius={0.5}
        luminanceThreshold={0.35}
        luminanceSmoothing={0.3}
        mipmapBlur
      />

      <ChromaticAberration
        ref={chromaRef}
        offset={new THREE.Vector2(0.0005, 0.0005)}
        radialModulation={false}
        modulationOffset={0}
      />

      <Vignette ref={vignetteRef} eskil={false} offset={0.1} darkness={0.82} />

      <Noise
        premultiply
        blendFunction={BlendFunction.SOFT_LIGHT}
        opacity={0.12}
      />
    </EffectComposer>
  )
}
