import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const STAR_CONFIG = [
  { radius: 10.5, inclination: 0.32, phase: 0.2, speed: 0.12, color: '#8fc7ff', size: 0.34 },
  { radius: 13.5, inclination: -0.58, phase: 2.0, speed: -0.085, color: '#ffd27a', size: 0.42 },
  { radius: 16.5, inclination: 0.92, phase: 3.7, speed: 0.065, color: '#9fb8ff', size: 0.3 },
  { radius: 19.5, inclination: -1.18, phase: 5.0, speed: -0.052, color: '#ffb45f', size: 0.48 },
  { radius: 23.5, inclination: 0.48, phase: 1.15, speed: 0.038, color: '#b9ddff', size: 0.28 }
]

function CompanionStar({ config, onActivate }) {
  const groupRef = useRef()
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const context = canvas.getContext('2d')
    const center = 64
    const color = new THREE.Color(config.color)
    const rgb = `${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}`
    const glow = context.createRadialGradient(center, center, 0, center, center, 64)
    glow.addColorStop(0, 'rgba(255,255,255,1)')
    glow.addColorStop(0.08, `rgba(${rgb},1)`)
    glow.addColorStop(0.25, `rgba(${rgb},0.75)`)
    glow.addColorStop(0.58, `rgba(${rgb},0.18)`)
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    context.fillStyle = glow
    context.fillRect(0, 0, 128, 128)
    context.save()
    context.translate(center, center)
    context.globalCompositeOperation = 'lighter'
    const flare = context.createLinearGradient(-64, 0, 64, 0)
    flare.addColorStop(0, 'rgba(255,255,255,0)')
    flare.addColorStop(0.5, 'rgba(255,255,255,0.95)')
    flare.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = flare
    context.fillRect(-64, -1, 128, 2)
    const vertical = context.createLinearGradient(0, -64, 0, 64)
    vertical.addColorStop(0, 'rgba(255,255,255,0)')
    vertical.addColorStop(0.5, 'rgba(255,255,255,0.8)')
    vertical.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = vertical
    context.fillRect(-1, -64, 2, 128)
    context.restore()
    const result = new THREE.CanvasTexture(canvas)
    result.colorSpace = THREE.SRGBColorSpace
    return result
  }, [config.color])
  const coreColor = useMemo(() => new THREE.Color(config.color), [config.color])
  const activate = (event) => {
    event.stopPropagation()
    onActivate()
  }

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const angle = config.phase + t * config.speed
    const x = Math.cos(angle) * config.radius
    const flatZ = Math.sin(angle) * config.radius
    const y = flatZ * Math.sin(config.inclination)
    const z = flatZ * Math.cos(config.inclination)

    if (groupRef.current) {
      groupRef.current.position.set(x, y, z)
      groupRef.current.rotation.y = -angle
    }

    const pulse = 1 + Math.sin(t * 2.1 + config.phase) * 0.08
    if (groupRef.current) groupRef.current.scale.setScalar(pulse)
  })

  return (
    <group ref={groupRef} className="companion-star" onPointerDown={activate}>
      <pointLight color={coreColor} intensity={1.6} distance={9} decay={2} />
      <mesh onPointerDown={activate}>
        <sphereGeometry args={[Math.max(0.9, config.size * 2.8), 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <sprite scale={[config.size * 4.8, config.size * 4.8, 1]} renderOrder={4} onPointerDown={activate}>
        <spriteMaterial
          map={texture}
          transparent
          opacity={1}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </group>
  )
}

export function CompanionStars({ hidden, onActivate }) {
  const groupRef = useRef()

  useFrame((_, delta) => {
    if (!groupRef.current) return
    const target = hidden ? 0 : 1
    groupRef.current.scale.lerp(new THREE.Vector3(target, target, target), Math.min(1, delta * 4))
    groupRef.current.visible = groupRef.current.scale.x > 0.01
  })

  return (
    <group ref={groupRef}>
      {STAR_CONFIG.map((config, index) => (
        <CompanionStar key={index} config={config} onActivate={onActivate} />
      ))}
    </group>
  )
}
