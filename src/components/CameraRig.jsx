import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { sharedState } from '../store/sharedState'

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

const _raycaster = new THREE.Raycaster()
const _plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
const _mouseNDC = new THREE.Vector2()
const _intersect = new THREE.Vector3()
const _transitionStart = new THREE.Vector3()
const _transitionDirection = new THREE.Vector3()
const _transitionTarget = new THREE.Vector3()

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
  const warpRoll = useRef(0)
  const lastMouseTime = useRef(0)
  const transitionStarted = useRef(false)

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
        velocity.current.theta -= dx * 0.0015
        velocity.current.phi -= dy * 0.0015
        lastPointer.current = { x: e.clientX, y: e.clientY }
      }

      // Track mouse for particle fluidization
      _mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1
      _mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1
      _raycaster.setFromCamera(_mouseNDC, camera)
      _plane.normal.set(0, 1, 0)
      _plane.constant = 0
      if (_raycaster.ray.intersectPlane(_plane, _intersect)) {
        sharedState.mouseWorld.copy(_intersect)
        const now = performance.now()
        const dt = now - lastMouseTime.current
        if (dt < 100) {
          sharedState.mousePushStrength = Math.min(1.0, sharedState.mousePushStrength + 0.15)
        }
        lastMouseTime.current = now
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
      targetRadius.current += e.deltaY * 0.025
      targetRadius.current = Math.max(35, Math.min(78, targetRadius.current))
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
  }, [gl, camera])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)

    sharedState.camera = camera

    if (sharedState.isTransitioning) {
      if (!transitionStarted.current) {
        _transitionStart.copy(camera.position)
        _transitionDirection.copy(_transitionStart).normalize().negate()
        transitionStarted.current = true
      }

      sharedState.transitionProgress = Math.min(
        1,
        sharedState.transitionProgress + dt * 0.25
      )
      const progress = sharedState.transitionProgress
      const approach = easeInOutCubic(Math.min(1, progress / 0.58))
      const crossing = Math.max(0, (progress - 0.58) / 0.42)

      // A narrower FOV reinforces forward motion as the horizon fills the frame.
      camera.fov = 70 - Math.min(1, progress / 0.58) * 18 + crossing * 10
      camera.updateProjectionMatrix()

      const distance = _transitionStart.length() * (1 - approach) - crossing * 24
      camera.position.copy(_transitionDirection).multiplyScalar(-distance)
      _transitionTarget.copy(camera.position).add(_transitionDirection)
      camera.lookAt(_transitionTarget)
      // Complete two eased corkscrew rotations and return to a level frame at
      // the exit flash so the destination does not inherit a tilted camera.
      warpRoll.current = Math.PI * 4 * easeInOutCubic(progress)
    } else {
      transitionStarted.current = false
      spherical.current.theta += dt * 0.012
      spherical.current.theta += velocity.current.theta
      spherical.current.phi += velocity.current.phi
      velocity.current.theta *= 0.91
      velocity.current.phi *= 0.91
      spherical.current.phi = Math.max(0.35, Math.min(Math.PI - 0.35, spherical.current.phi))
      spherical.current.radius += (targetRadius.current - spherical.current.radius) * 0.035
      warpRoll.current *= 0.9
    }

    const theta = spherical.current.theta
    const phi = spherical.current.phi

    if (!sharedState.isTransitioning) {
      const r = spherical.current.radius
      camera.position.x = r * Math.sin(phi) * Math.cos(theta)
      camera.position.y = r * Math.cos(phi)
      camera.position.z = r * Math.sin(phi) * Math.sin(theta)

      const parallaxX = sharedState.mouseParallax.x * 1.8
      const parallaxY = sharedState.mouseParallax.y * 1.2
      camera.position.x += parallaxX
      camera.position.y += parallaxY
      camera.lookAt(0, 0, 0)
    }

    if (Math.abs(warpRoll.current) > 0.001) {
      camera.rotateZ(warpRoll.current)
    }

    sharedState.cameraRotation.x = camera.rotation.x
    sharedState.cameraRotation.y = camera.rotation.y

    if (loginCardRef.current) {
      const rotY = theta * 0.03
      const rotX = -(phi - Math.PI / 2) * 0.06
      const scale = sharedState.isTransitioning
        ? 1 - sharedState.transitionProgress * 0.4
        : 1
      const opacity = sharedState.isTransitioning
        ? Math.max(0, 1 - sharedState.transitionProgress * 1.2)
        : 1
      loginCardRef.current.style.transform = `translate(-50%, -50%) perspective(1400px) rotateY(${rotY}rad) rotateX(${rotX}rad) scale(${scale})`
      loginCardRef.current.style.opacity = opacity
    }

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
