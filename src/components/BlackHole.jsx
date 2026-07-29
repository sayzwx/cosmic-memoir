import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sharedState } from '../store/sharedState'

const shellVertex = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vLocalPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vLocalPosition = position;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = viewPosition.xyz;
    gl_Position = projectionMatrix * viewPosition;
  }
`

const shellFragment = `
  uniform float uTime;
  uniform float uEnergy;
  uniform float uOpacity;
  uniform vec3 uColdColor;
  uniform vec3 uWarmColor;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vLocalPosition;

  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec3 viewDir = normalize(-vViewPosition);
    float facing = abs(dot(normalize(vNormal), viewDir));
    float rim = pow(1.0 - facing, 8.5);
    float angle = atan(vLocalPosition.y, vLocalPosition.x);
    float turbulence = sin(angle * 17.0 - uTime * 0.9) * 0.12;
    turbulence += sin(angle * 31.0 + uTime * 0.53) * 0.06;
    float brokenRing = smoothstep(0.24, 0.92, 0.58 + turbulence + hash21(floor(vLocalPosition.xy * 7.0)) * 0.22);
    float beaming = 0.55 + smoothstep(-0.8, 0.9, sin(angle + 0.5)) * 0.9;
    vec3 color = mix(uColdColor, uWarmColor, uEnergy * 0.72 + smoothstep(-0.5, 0.8, sin(angle)) * 0.22);
    float alpha = rim * brokenRing * beaming * uOpacity;
    gl_FragColor = vec4(color * (1.2 + rim * 2.6) * beaming, alpha);
  }
`

function createShellMaterial(radius, opacity) {
  return new THREE.ShaderMaterial({
    vertexShader: shellVertex,
    fragmentShader: shellFragment,
    uniforms: {
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uOpacity: { value: opacity },
      uColdColor: { value: new THREE.Color(radius < 4 ? '#c6e8ff' : '#2f75c9') },
      uWarmColor: { value: new THREE.Color(radius < 4 ? '#fff1bf' : '#d89942') }
    },
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
}

function HorizonDust() {
  const pointsRef = useRef()
  const geometry = useMemo(() => {
    const count = 420
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = 3.55 + Math.pow(Math.random(), 2) * 3.8
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = (Math.random() - 0.5) * (0.18 + radius * 0.035)
      positions[i * 3 + 2] = Math.sin(angle) * radius
    }
    const result = new THREE.BufferGeometry()
    result.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return result
  }, [])
  useFrame((state, delta) => {
    if (!pointsRef.current) return
    pointsRef.current.rotation.y -= delta * 0.085
    pointsRef.current.material.opacity = 0.36 + Math.sin(state.clock.elapsedTime * 0.8) * 0.06
  })
  return (
    <points ref={pointsRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4} geometry={geometry}>
      <pointsMaterial color="#b9dcff" size={0.13} transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  )
}

export function BlackHole() {
  const horizonRef = useRef()
  const photonRef = useRef()
  const haloRef = useRef()
  const photonMaterial = useMemo(() => createShellMaterial(3.45, 0.96), [])
  const haloMaterial = useMemo(() => createShellMaterial(4.7, 0.24), [])

  useFrame((state) => {
    const time = state.clock.elapsedTime
    const fade = 1 - THREE.MathUtils.smoothstep(sharedState.transitionProgress, 0.68, 0.84)
    photonMaterial.uniforms.uTime.value = time
    photonMaterial.uniforms.uEnergy.value = sharedState.inputEnergy
    photonMaterial.uniforms.uOpacity.value = 0.96 * fade
    haloMaterial.uniforms.uTime.value = time * 0.72
    haloMaterial.uniforms.uEnergy.value = sharedState.inputEnergy
    haloMaterial.uniforms.uOpacity.value = (0.2 + sharedState.inputEnergy * 0.08) * fade
    if (horizonRef.current) horizonRef.current.scale.setScalar(1 + Math.sin(time * 0.62) * 0.002)
    if (photonRef.current) photonRef.current.rotation.z = time * 0.018
    if (haloRef.current) haloRef.current.rotation.y = -time * 0.012
  })

  return (
    <group>
      <mesh ref={haloRef} renderOrder={3}>
        <sphereGeometry args={[4.7, 64, 48]} />
        <primitive object={haloMaterial} attach="material" />
      </mesh>
      <mesh ref={photonRef} renderOrder={5}>
        <sphereGeometry args={[3.44, 96, 64]} />
        <primitive object={photonMaterial} attach="material" />
      </mesh>
      <mesh ref={horizonRef} renderOrder={4}>
        <sphereGeometry args={[2.92, 96, 64]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <HorizonDust />
    </group>
  )
}
