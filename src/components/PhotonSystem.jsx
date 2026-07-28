import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sharedState } from '../store/sharedState'
import { photonVertexShader, photonFragmentShader } from '../shaders/photon.js'

const PHOTON_COUNT = 60
const PHOTON_LIFETIME = 2.2

export function PhotonSystem() {
  const pointsRef = useRef()

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(PHOTON_COUNT * 3)
    const active = new Float32Array(PHOTON_COUNT)
    const progress = new Float32Array(PHOTON_COUNT)
    const startPos = new Float32Array(PHOTON_COUNT * 3)
    const angle = new Float32Array(PHOTON_COUNT)
    const radius = new Float32Array(PHOTON_COUNT)
    const speed = new Float32Array(PHOTON_COUNT)
    const colors = new Float32Array(PHOTON_COUNT * 3)
    const sizes = new Float32Array(PHOTON_COUNT)

    for (let i = 0; i < PHOTON_COUNT; i++) {
      colors[i * 3] = 0.0
      colors[i * 3 + 1] = 0.94
      colors[i * 3 + 2] = 1.0
      sizes[i] = 1.0 + Math.random() * 0.8
      active[i] = 0
      progress[i] = 0
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aActive', new THREE.BufferAttribute(active, 1))
    geo.setAttribute('aProgress', new THREE.BufferAttribute(progress, 1))
    geo.setAttribute('aStartPos', new THREE.BufferAttribute(startPos, 3))
    geo.setAttribute('aAngle', new THREE.BufferAttribute(angle, 1))
    geo.setAttribute('aRadius', new THREE.BufferAttribute(radius, 1))
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1))
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

    const mat = new THREE.ShaderMaterial({
      vertexShader: photonVertexShader,
      fragmentShader: photonFragmentShader,
      uniforms: {
        uTime: { value: 0 }
      },
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true
    })

    return { geometry: geo, material: mat }
  }, [])

  const photonData = useRef(
    Array(PHOTON_COUNT)
      .fill(null)
      .map(() => ({
        active: false,
        progress: 0,
        startX: 0,
        startY: 0,
        startZ: 0,
        angle: 0,
        radius: 0,
        speed: 0
      }))
  )

  useFrame((state, delta) => {
    if (!pointsRef.current) return

    const geo = pointsRef.current.geometry
    const activeAttr = geo.attributes.aActive
    const progressAttr = geo.attributes.aProgress
    const startPosAttr = geo.attributes.aStartPos
    const angleAttr = geo.attributes.aAngle
    const radiusAttr = geo.attributes.aRadius
    const speedAttr = geo.attributes.aSpeed

    // Consume new photon requests from shared state
    while (sharedState.photons.length > 0) {
      const photon = sharedState.photons.shift()
      const slot = photonData.current.findIndex((p) => !p.active)
      if (slot >= 0) {
        const p = photonData.current[slot]
        p.active = true
        p.progress = 0
        p.startX = photon.pos.x
        p.startY = photon.pos.y
        p.startZ = photon.pos.z
        p.angle = photon.angle
        p.radius = photon.radius
        p.speed = photon.speed
      }
    }

    for (let i = 0; i < PHOTON_COUNT; i++) {
      const p = photonData.current[i]

      if (p.active) {
        p.progress += delta / PHOTON_LIFETIME
        if (p.progress >= 1.0) {
          p.active = false
          p.progress = 0
        }
      }

      activeAttr.array[i] = p.active ? 1 : 0
      progressAttr.array[i] = p.progress
      startPosAttr.array[i * 3] = p.startX
      startPosAttr.array[i * 3 + 1] = p.startY
      startPosAttr.array[i * 3 + 2] = p.startZ
      angleAttr.array[i] = p.angle
      radiusAttr.array[i] = p.radius
      speedAttr.array[i] = p.speed
    }

    activeAttr.needsUpdate = true
    progressAttr.needsUpdate = true
    startPosAttr.needsUpdate = true
    angleAttr.needsUpdate = true
    radiusAttr.needsUpdate = true
    speedAttr.needsUpdate = true

    pointsRef.current.material.uniforms.uTime.value = state.clock.elapsedTime
  })

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
    />
  )
}
