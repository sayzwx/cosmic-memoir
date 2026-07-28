import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  EffectComposer,
  Bloom,
  DepthOfField,
  Vignette,
  ChromaticAberration,
  Noise
} from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import { sharedState } from '../store/sharedState'

export function Effects({ isMobile }) {
  const chromaRef = useRef()
  const bloomRef = useRef()

  useFrame(() => {
    if (sharedState.isTransitioning) {
      const t = sharedState.transitionProgress

      if (chromaRef.current) {
        const offset = t * 0.025
        chromaRef.current.offset.set(offset, offset)
      }

      if (bloomRef.current) {
        bloomRef.current.intensity = 1.5 + t * 4.0
        bloomRef.current.radius = 0.8 + t * 0.4
      }
    } else {
      if (chromaRef.current) {
        chromaRef.current.offset.set(0.0005, 0.0005)
      }
      if (bloomRef.current) {
        bloomRef.current.intensity = 1.5
        bloomRef.current.radius = 0.8
      }
    }
  })

  return (
    <EffectComposer multisampling={isMobile ? 0 : 4}>
      <Bloom
        ref={bloomRef}
        intensity={1.5}
        radius={0.8}
        luminanceThreshold={0.2}
        luminanceSmoothing={0.4}
        mipmapBlur
      />

      {!isMobile && (
        <DepthOfField
          focusDistance={0.018}
          focalLength={0.04}
          bokehScale={2.2}
          height={480}
        />
      )}

      <ChromaticAberration
        ref={chromaRef}
        offset={new THREE.Vector2(0.0005, 0.0005)}
        radialModulation={false}
        modulationOffset={0}
      />

      <Vignette eskil={false} offset={0.1} darkness={0.82} />

      <Noise
        premultiply
        blendFunction={BlendFunction.SOFT_LIGHT}
        opacity={0.12}
      />
    </EffectComposer>
  )
}
