import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sharedState } from '../store/sharedState'
import { galaxyVertexShader, galaxyFragmentShader } from '../shaders/galaxy.js'

export function GalaxyParticles({ count = 50000 }) {
  const pointsRef = useRef()

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const offsets = new Float32Array(count)
    const randomness = new Float32Array(count * 3)

    const branches = 4
    const galaxyRadius = 70
    const spin = 1.3
    const randomnessPower = 3.2
    const coreFactor = 0.12

    const tempColor = new THREE.Color()

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const isCore = Math.random() < coreFactor

      let r, branchAngle, spinAngle, rx, ry, rz

      if (isCore) {
        r = Math.pow(Math.random(), 2.5) * galaxyRadius * 0.12
        branchAngle = Math.random() * Math.PI * 2
        spinAngle = 0
        rx = (Math.random() - 0.5) * r * 0.4
        ry = (Math.random() - 0.5) * r * 0.4
        rz = (Math.random() - 0.5) * r * 0.4
      } else {
        r = Math.pow(Math.random(), 0.55) * galaxyRadius
        branchAngle = ((i % branches) / branches) * Math.PI * 2
        spinAngle = r * spin * 0.045
        rx = Math.pow(Math.random(), randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * 2.8
        ry = Math.pow(Math.random(), randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * 0.9
        rz = Math.pow(Math.random(), randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * 2.8
      }

      positions[i3] = Math.cos(branchAngle + spinAngle) * r + rx
      positions[i3 + 1] = ry * (isCore ? 1.0 : 0.35)
      positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * r + rz

      // HR diagram color distribution
      const roll = Math.random()
      if (roll < 0.04) {
        tempColor.setRGB(0.45, 0.55, 1.0) // Blue giant (rare)
      } else if (roll < 0.12) {
        tempColor.setRGB(0.65, 0.75, 1.0) // A-class
      } else if (roll < 0.30) {
        tempColor.setRGB(0.88, 0.9, 1.0) // F-class white
      } else if (roll < 0.55) {
        tempColor.setRGB(1.0, 0.94, 0.78) // G-class yellow (Sun-like)
      } else if (roll < 0.80) {
        tempColor.setRGB(1.0, 0.78, 0.52) // K-class orange
      } else {
        tempColor.setRGB(1.0, 0.48, 0.35) // M-class red dwarf
      }

      const brightness = (isCore ? 1.3 : 0.55 + Math.random() * 0.45) *
        (1.0 - (r / galaxyRadius) * 0.35)

      colors[i3] = tempColor.r * brightness
      colors[i3 + 1] = tempColor.g * brightness
      colors[i3 + 2] = tempColor.b * brightness

      sizes[i] = isCore ? Math.random() * 3 + 1.2 : Math.random() * 2.2 + 0.6
      offsets[i] = Math.random() * Math.PI * 2
      randomness[i3] = Math.random()
      randomness[i3 + 1] = Math.random()
      randomness[i3 + 2] = Math.random()
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1))
    geo.setAttribute('aRandom', new THREE.BufferAttribute(randomness, 3))

    const mat = new THREE.ShaderMaterial({
      vertexShader: galaxyVertexShader,
      fragmentShader: galaxyFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 38 * Math.min(window.devicePixelRatio, 2) },
        uPulseRadius: { value: 0 },
        uPulseStrength: { value: 0 },
        uPulseOrigin: { value: new THREE.Vector3(0, 0, 0) },
        uMouseParallax: { value: new THREE.Vector2(0, 0) },
        uFocusPoint: { value: new THREE.Vector3(0, 0, 0) },
        uFocusStrength: { value: 0 },
        uTransitionProgress: { value: 0 },
        uIsTransitioning: { value: 0 }
      },
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true
    })

    return { geometry: geo, material: mat }
  }, [count])

  useFrame((state) => {
    if (!pointsRef.current) return
    const mat = pointsRef.current.material
    mat.uniforms.uTime.value = state.clock.elapsedTime
    mat.uniforms.uPulseRadius.value = sharedState.pulseRadius
    mat.uniforms.uPulseStrength.value = sharedState.pulseStrength
    mat.uniforms.uPulseOrigin.value.copy(sharedState.pulseOrigin)
    mat.uniforms.uMouseParallax.value.copy(sharedState.mouseParallax)
    mat.uniforms.uFocusPoint.value.copy(sharedState.focusPoint)
    mat.uniforms.uFocusStrength.value = sharedState.focusStrength
    mat.uniforms.uTransitionProgress.value = sharedState.transitionProgress
    mat.uniforms.uIsTransitioning.value = sharedState.isTransitioning ? 1 : 0
  })

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
}
