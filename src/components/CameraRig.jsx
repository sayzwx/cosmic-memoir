import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { sharedState } from '../store/sharedState'

const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))

export function CameraRig({ loginCardRef }) {
  const { camera, gl } = useThree()

  const spherical = useRef({
    radius: 55,
    theta: 0,
    phi: Math.PI / 2 - 0.35
  })
  const velocity = useRef({ theta: 0, phi: 0 })
  const targetRadius = useRef(55)
  const mousePos = useRef({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const lastPointer = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = gl.domElement

    const onPointerDown = (e) => {
      isDragging.current = true
      lastPointer.current = { x: e.clientX, y: e.clientY }
      canvas.setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e) => {
      mousePos.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1
      }

      if (isDragging.current) {
        const dx = e.clientX - lastPointer.current.x
        const dy = e.clientY - lastPointer.current.y
        velocity.current.theta -= dx * 0.004
        velocity.current.phi -= dy * 0.004
        lastPointer.current = { x: e.clientX, y: e.clientY }
      }
    }

    const onPointerUp = (e) => {
      isDragging.current = false
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId)
      }
    }

    const onWheel = (e) => {
      e.preventDefault()
      targetRadius.current += e.deltaY * 0.04
      targetRadius.current = Math.max(18, Math.min(110, targetRadius.current))
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [gl])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)

    // Expose camera for UI-side projection
    sharedState.camera = camera

    if (sharedState.isTransitioning) {
      // Wormhole transition
      sharedState.transitionProgress = Math.min(
        1,
        sharedState.transitionProgress + dt * 0.55
      )
      const t = easeOutExpo(sharedState.transitionProgress)

      camera.fov = 75 + t * 45
      camera.updateProjectionMatrix()

      spherical.current.radius = 55 * (1 - t * 0.85)
      spherical.current.theta += dt * 3.0 * t
      spherical.current.phi += dt * 1.5 * t
    } else {
      // Idle orbital drift toward center (very slow)
      spherical.current.theta += dt * 0.02

      // Apply drag velocity with spring-like damping
      spherical.current.theta += velocity.current.theta
      spherical.current.phi += velocity.current.phi
      velocity.current.theta *= 0.94
      velocity.current.phi *= 0.94

      // Clamp vertical angle
      spherical.current.phi = Math.max(
        0.25,
        Math.min(Math.PI - 0.25, spherical.current.phi)
      )

      // Smooth zoom (ease-out expo feel)
      spherical.current.radius +=
        (targetRadius.current - spherical.current.radius) * 0.04
    }

    // Convert spherical to cartesian
    const r = spherical.current.radius
    const theta = spherical.current.theta
    const phi = spherical.current.phi

    camera.position.x = r * Math.sin(phi) * Math.cos(theta)
    camera.position.y = r * Math.cos(phi)
    camera.position.z = r * Math.sin(phi) * Math.sin(theta)

    // Add subtle mouse parallax offset after lookAt
    const parallaxX = sharedState.mouseParallax.x * 2.5
    const parallaxY = sharedState.mouseParallax.y * 1.8
    camera.position.x += parallaxX
    camera.position.y += parallaxY

    camera.lookAt(0, 0, 0)

    sharedState.cameraRotation.x = camera.rotation.x
    sharedState.cameraRotation.y = camera.rotation.y

    // Update login card 3D perspective via direct DOM ref (no setState)
    if (loginCardRef.current) {
      const rotY = theta * 0.035
      const rotX = -(phi - Math.PI / 2) * 0.08
      const scale = sharedState.isTransitioning
        ? 1 - sharedState.transitionProgress * 0.3
        : 1
      const opacity = sharedState.isTransitioning
        ? 1 - sharedState.transitionProgress
        : 1
      loginCardRef.current.style.transform = `translate(-50%, -50%) perspective(1200px) rotateY(${rotY}rad) rotateX(${rotX}rad) scale(${scale})`
      loginCardRef.current.style.opacity = opacity
    }

    // Evolve gravitational wave pulse
    if (sharedState.pulseStrength > 0.005) {
      sharedState.pulseRadius += dt * 55
      sharedState.pulseStrength *= 0.94
      if (sharedState.pulseStrength < 0.005) {
        sharedState.pulseStrength = 0
        sharedState.pulseRadius = 0
      }
    }
  })

  return null
}
