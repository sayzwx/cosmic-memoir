import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const vertexShader = `
  attribute vec3 aDirection;
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aLength;
  attribute float aHead;
  attribute vec3 aColor;
  uniform float uTime;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    float cycle = fract(uTime * aSpeed + aPhase);
    float life = sin(cycle * 3.14159265);
    float travel = (cycle - 0.5) * 110.0;
    vec3 tangent = normalize(aDirection);
    vec3 displaced = position + tangent * (travel + aHead * aLength);
    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    vAlpha = pow(max(life, 0.0), 2.2) * mix(0.08, 1.0, aHead);
    vColor = mix(aColor * 0.48, vec3(1.0), aHead * 0.72);
  }
`

const fragmentShader = `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor, vAlpha * 0.7);
  }
`

function random(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

export function NebulaStreaks({ count = 100 }) {
  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(count * 2 * 3)
    const directions = new Float32Array(count * 2 * 3)
    const phases = new Float32Array(count * 2)
    const speeds = new Float32Array(count * 2)
    const lengths = new Float32Array(count * 2)
    const heads = new Float32Array(count * 2)
    const colors = new Float32Array(count * 2 * 3)
    const palette = ['#b8dcff', '#eef6ff', '#ffdca6', '#91c7ff']
    const up = new THREE.Vector3(0, 1, 0)
    const radial = new THREE.Vector3()
    const tangent = new THREE.Vector3()
    const bitangent = new THREE.Vector3()

    for (let i = 0; i < count; i++) {
      const theta = random(i * 4.31 + 1.7) * Math.PI * 2
      const phi = Math.acos(2 * random(i * 7.17 + 3.4) - 1)
      const radius = 760 + random(i * 9.83 + 5.1) * 60
      radial.set(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta)
      )
      tangent.crossVectors(radial, Math.abs(radial.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : up).normalize()
      bitangent.crossVectors(radial, tangent).normalize()
      tangent.multiplyScalar(Math.cos(random(i * 11.2) * Math.PI * 2))
        .addScaledVector(bitangent, Math.sin(random(i * 11.2) * Math.PI * 2))
        .normalize()
      const center = radial.clone().multiplyScalar(radius)
      const length = 14 + random(i * 13.6 + 8.2) * 42
      const phase = random(i * 17.9 + 9.4)
      const speed = 0.025 + random(i * 19.3 + 11.6) * 0.055
      const color = new THREE.Color(palette[i % palette.length])

      for (let endpoint = 0; endpoint < 2; endpoint++) {
        const index = i * 2 + endpoint
        positions[index * 3] = center.x
        positions[index * 3 + 1] = center.y
        positions[index * 3 + 2] = center.z
        directions[index * 3] = tangent.x
        directions[index * 3 + 1] = tangent.y
        directions[index * 3 + 2] = tangent.z
        phases[index] = phase
        speeds[index] = speed
        lengths[index] = length
        heads[index] = endpoint
        colors[index * 3] = color.r
        colors[index * 3 + 1] = color.g
        colors[index * 3 + 2] = color.b
      }
    }

    const result = new THREE.BufferGeometry()
    result.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    result.setAttribute('aDirection', new THREE.BufferAttribute(directions, 3))
    result.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
    result.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
    result.setAttribute('aLength', new THREE.BufferAttribute(lengths, 1))
    result.setAttribute('aHead', new THREE.BufferAttribute(heads, 1))
    result.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))

    const shader = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false
    })
    return { geometry: result, material: shader }
  }, [count])

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
  })

  return <lineSegments geometry={geometry} material={material} renderOrder={-0.5} frustumCulled={false} />
}
