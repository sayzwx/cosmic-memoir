import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const noiseGLSL = `
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z
    );
  }
  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += noise(p) * amplitude;
      p = p * 2.03 + 7.1;
      amplitude *= 0.5;
    }
    return value;
  }
`

const sphereVertex = `
  varying vec3 vNormal;
  varying vec3 vObjectNormal;
  varying vec3 vPosition;
  varying vec3 vViewPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vObjectNormal = normalize(normal);
    vPosition = position;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = viewPosition.xyz;
    gl_Position = projectionMatrix * viewPosition;
  }
`

const planetFragment = `
  uniform vec3 uDeepColor;
  uniform vec3 uMidColor;
  uniform vec3 uHighColor;
  uniform vec3 uLightDirection;
  uniform float uSeed;
  uniform float uGas;
  varying vec3 vNormal;
  varying vec3 vObjectNormal;
  varying vec3 vPosition;
  varying vec3 vViewPosition;
  ${noiseGLSL}
  void main() {
    vec3 n = normalize(vNormal);
    vec3 objectNormal = normalize(vObjectNormal);
    float broad = fbm(vPosition * 0.52 + uSeed);
    float detail = fbm(vPosition * 2.7 + uSeed * 2.1);
    float bands = sin(vPosition.y * 2.8 + broad * 6.0 + detail * 1.4) * 0.5 + 0.5;
    float terrain = smoothstep(0.40, 0.68, broad * 0.72 + detail * 0.38);
    float pattern = mix(terrain, smoothstep(0.18, 0.82, bands), uGas);
    vec3 surface = mix(uDeepColor, uMidColor, pattern);
    surface = mix(surface, uHighColor, smoothstep(0.70, 0.92, detail) * (0.35 + uGas * 0.4));
    float ndl = dot(objectNormal, normalize(uLightDirection));
    float light = smoothstep(-0.18, 0.55, ndl);
    float terminator = exp(-abs(ndl) * 7.0);
    float rim = pow(1.0 - max(dot(n, normalize(-vViewPosition)), 0.0), 3.2);
    surface *= 0.055 + light * 0.95;
    surface += uMidColor * terminator * 0.09 + uHighColor * rim * light * 0.14;
    gl_FragColor = vec4(surface, 1.0);
  }
`

const starFragment = `
  uniform vec3 uColor;
  uniform vec3 uHotColor;
  uniform float uTime;
  uniform float uSeed;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vViewPosition;
  ${noiseGLSL}
  void main() {
    vec3 flow = vPosition * 0.72 + vec3(0.0, uTime * 0.035, uTime * 0.018);
    float cells = fbm(flow + uSeed);
    float filaments = fbm(flow * 2.8 - vec3(uTime * 0.05, 0.0, 0.0));
    float activity = smoothstep(0.52, 0.84, cells * 0.72 + filaments * 0.45);
    float limb = pow(max(dot(normalize(vNormal), normalize(-vViewPosition)), 0.0), 0.32);
    vec3 color = mix(uColor * 0.72, uHotColor, activity);
    color *= 0.62 + limb * 0.74;
    gl_FragColor = vec4(color, 1.0);
  }
`

const coronaFragment = `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  void main() {
    float fresnel = 1.0 - abs(dot(normalize(vNormal), normalize(-vViewPosition)));
    float alpha = pow(fresnel, 2.5) * uOpacity;
    gl_FragColor = vec4(uColor, alpha);
  }
`

const SYSTEMS = [
  {
    position: [112, 72, -96], rotation: [0.18, -0.64, 0.12], starRadius: 5.4,
    starColor: '#f4a85f', hotColor: '#fff1c7', seed: 1.7,
    planets: [
      { orbit: 18, radius: 3.4, speed: 0.028, phase: 0.7, deep: '#172e46', mid: '#397d96', high: '#b8d9cf', atmosphere: '#7edcff', gas: 0, ring: null, moon: true },
      { orbit: 29, radius: 4.8, speed: -0.014, phase: 3.1, deep: '#492312', mid: '#b35c2f', high: '#efb46c', atmosphere: '#ffab66', gas: 1, ring: '#bf895f', moon: false }
    ]
  },
  {
    position: [-138, -54, -104], rotation: [-0.24, 0.35, -0.3], starRadius: 4.2,
    starColor: '#96caff', hotColor: '#f1f7ff', seed: 8.4,
    planets: [
      { orbit: 17, radius: 3.8, speed: -0.022, phase: 2.2, deep: '#242039', mid: '#635783', high: '#c4b6dc', atmosphere: '#a7b8ff', gas: 1, ring: '#8d91b9', moon: true },
      { orbit: 27, radius: 2.7, speed: 0.018, phase: 4.7, deep: '#24341f', mid: '#687957', high: '#b8b07d', atmosphere: '#b8d79c', gas: 0, ring: null, moon: false }
    ]
  },
  {
    position: [-82, 91, 133], rotation: [0.42, 0.7, 0.18], starRadius: 3.7,
    starColor: '#ffe0a0', hotColor: '#fff9e8', seed: 14.1,
    planets: [
      { orbit: 16, radius: 3.1, speed: 0.026, phase: 0.2, deep: '#3c2330', mid: '#995068', high: '#deb0a5', atmosphere: '#f1a4b1', gas: 0, ring: null, moon: true },
      { orbit: 25, radius: 4.3, speed: -0.012, phase: 2.8, deep: '#4a381d', mid: '#a9874d', high: '#e2c88c', atmosphere: '#d9c68b', gas: 1, ring: '#aa9167', moon: false }
    ]
  },
  {
    position: [146, -83, 118], rotation: [-0.3, -0.4, 0.35], starRadius: 4.6,
    starColor: '#ef8b68', hotColor: '#ffe2bf', seed: 21.6,
    planets: [
      { orbit: 19, radius: 3.6, speed: 0.019, phase: 1.8, deep: '#142b38', mid: '#2d6c70', high: '#83bba7', atmosphere: '#66c8c6', gas: 0, ring: null, moon: false },
      { orbit: 31, radius: 5.0, speed: -0.011, phase: 5.2, deep: '#4c2820', mid: '#995541', high: '#d69a72', atmosphere: '#e58e68', gas: 1, ring: null, moon: true }
    ]
  }
]

const FAR_STARS = [
  { position: [278, 126, -274], radius: 8.5, color: '#8fc5ff', hot: '#f4f8ff', seed: 30.1 },
  { position: [-326, 164, -238], radius: 10.5, color: '#f5a66a', hot: '#fff0cf', seed: 34.8 },
  { position: [365, -192, -156], radius: 7.2, color: '#ffe0a3', hot: '#fffbee', seed: 39.2 },
  { position: [-252, -214, 285], radius: 9.4, color: '#a7bbff', hot: '#f4f5ff', seed: 43.5 },
  { position: [118, 238, 394], radius: 12.0, color: '#e98568', hot: '#ffe2c5', seed: 47.7 },
  { position: [-418, 36, 126], radius: 6.8, color: '#c4dcff', hot: '#ffffff', seed: 52.4 },
  { position: [84, -268, -432], radius: 11.5, color: '#f1c47d', hot: '#fff7df', seed: 57.3 },
  { position: [438, 92, 248], radius: 7.8, color: '#9dcfff', hot: '#f5fbff', seed: 62.9 }
]

function seededRandom(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

function ParticleCorona({ radius, color, seed, count = 260, opacity = 0.5 }) {
  const pointsRef = useRef()
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const u = seededRandom(seed + i * 4.17)
      const v = seededRandom(seed + i * 7.31 + 2.8)
      const plume = Math.pow(seededRandom(seed + i * 9.73), 4) * radius * 1.9
      const shell = radius * (1.08 + seededRandom(seed + i * 2.43) * 0.34) + plume
      const theta = u * Math.PI * 2
      const phi = Math.acos(2 * v - 1)
      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * shell
      positions[i * 3 + 1] = Math.cos(phi) * shell
      positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * shell
    }
    const result = new THREE.BufferGeometry()
    result.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return result
  }, [count, radius, seed])
  useFrame((state, delta) => {
    if (!pointsRef.current) return
    pointsRef.current.rotation.y += delta * 0.025
    pointsRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.12 + seed) * 0.035
    pointsRef.current.material.opacity = opacity * (0.86 + Math.sin(state.clock.elapsedTime * 0.7 + seed) * 0.14)
  })
  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial color={color} size={radius * 0.14} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
    </points>
  )
}

function ParticleRing({ radius, color, seed }) {
  const pointsRef = useRef()
  const geometry = useMemo(() => {
    const count = 520
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const angle = seededRandom(seed + i * 3.11) * Math.PI * 2
      const band = radius * (1.38 + seededRandom(seed + i * 5.73) * 0.92)
      positions[i * 3] = Math.cos(angle) * band
      positions[i * 3 + 1] = (seededRandom(seed + i * 8.19) - 0.5) * radius * 0.13
      positions[i * 3 + 2] = Math.sin(angle) * band
    }
    const result = new THREE.BufferGeometry()
    result.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return result
  }, [radius, seed])
  useFrame((_, delta) => {
    if (pointsRef.current) pointsRef.current.rotation.y += delta * 0.035
  })
  return (
    <points ref={pointsRef} geometry={geometry} rotation={[0.18, 0.15, -0.22]}>
      <pointsMaterial color={color} size={radius * 0.075} transparent opacity={0.52} depthWrite={false} sizeAttenuation />
    </points>
  )
}

function Star({ config }) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: sphereVertex,
    fragmentShader: starFragment,
    uniforms: {
      uColor: { value: new THREE.Color(config.starColor) },
      uHotColor: { value: new THREE.Color(config.hotColor) },
      uTime: { value: 0 },
      uSeed: { value: config.seed }
    }
  }), [config])
  useFrame((state) => { material.uniforms.uTime.value = state.clock.elapsedTime })
  return (
    <group>
      <mesh>
        <sphereGeometry args={[config.starRadius, 48, 36]} />
        <primitive object={material} attach="material" />
      </mesh>
      <ParticleCorona radius={config.starRadius} color={config.starColor} seed={config.seed} />
      <pointLight color={config.starColor} intensity={2.2} distance={70} decay={1.5} />
    </group>
  )
}

function Planet({ config, starColor, seed }) {
  const orbitRef = useRef()
  const planetRef = useRef()
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: sphereVertex,
    fragmentShader: planetFragment,
    uniforms: {
      uDeepColor: { value: new THREE.Color(config.deep) },
      uMidColor: { value: new THREE.Color(config.mid) },
      uHighColor: { value: new THREE.Color(config.high) },
      uLightDirection: { value: new THREE.Vector3(-1, 0.18, 0.4).normalize() },
      uSeed: { value: seed },
      uGas: { value: config.gas }
    }
  }), [config, seed])
  useFrame((state, delta) => {
    if (orbitRef.current) orbitRef.current.rotation.y = config.phase + state.clock.elapsedTime * config.speed
    if (planetRef.current) planetRef.current.rotation.y += delta * (config.gas ? 0.05 : 0.025)
  })
  return (
    <group ref={orbitRef}>
      <group position={[config.orbit, 0, 0]}>
        <mesh ref={planetRef} rotation={[0.12, seed, -0.2]}>
          <sphereGeometry args={[config.radius, 48, 32]} />
          <primitive object={material} attach="material" />
        </mesh>
        <ParticleCorona radius={config.radius} color={config.atmosphere} seed={seed} count={110} opacity={0.24} />
        {config.ring && (
          <ParticleRing radius={config.radius} color={config.ring} seed={seed + 11.3} />
        )}
        {config.moon && (
          <mesh position={[config.radius * 1.9, config.radius * 0.25, 0.8]}>
            <sphereGeometry args={[config.radius * 0.18, 20, 14]} />
            <meshStandardMaterial color="#aab2b8" roughness={0.95} />
          </mesh>
        )}
      </group>
    </group>
  )
}

function DustCloud({ seed, color }) {
  const geometry = useMemo(() => {
    const count = 240
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = 11 + Math.random() * 29
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = (Math.random() - 0.5) * 12
      positions[i * 3 + 2] = Math.sin(angle) * radius
    }
    const result = new THREE.BufferGeometry()
    result.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return result
  }, [seed])
  return (
    <points geometry={geometry}>
      <pointsMaterial color={color} size={0.42} transparent opacity={0.38} blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  )
}

function FarStar({ config }) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: sphereVertex,
    fragmentShader: starFragment,
    uniforms: {
      uColor: { value: new THREE.Color(config.color) },
      uHotColor: { value: new THREE.Color(config.hot) },
      uTime: { value: 0 },
      uSeed: { value: config.seed }
    }
  }), [config])
  useFrame((state) => { material.uniforms.uTime.value = state.clock.elapsedTime })
  return (
    <group position={config.position}>
      <mesh>
        <sphereGeometry args={[config.radius, 32, 24]} />
        <primitive object={material} attach="material" />
      </mesh>
      <ParticleCorona radius={config.radius} color={config.color} seed={config.seed} count={180} opacity={0.34} />
    </group>
  )
}

function DeepField() {
  const geometry = useMemo(() => {
    const count = 1100
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const palette = ['#86b9ff', '#dbe8ff', '#fff1c4', '#e89a6c']
    for (let i = 0; i < count; i++) {
      const theta = seededRandom(i * 4.13 + 80) * Math.PI * 2
      const phi = Math.acos(2 * seededRandom(i * 7.91 + 90) - 1)
      const radius = 290 + seededRandom(i * 11.7 + 100) * 250
      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius
      positions[i * 3 + 1] = Math.cos(phi) * radius
      positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius
      const color = new THREE.Color(palette[i % palette.length])
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }
    const result = new THREE.BufferGeometry()
    result.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    result.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return result
  }, [])
  return (
    <points geometry={geometry}>
      <pointsMaterial vertexColors size={0.9} transparent opacity={0.52} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
    </points>
  )
}

function StellarSystem({ config }) {
  return (
    <group position={config.position} rotation={config.rotation}>
      <Star config={config} />
      {config.planets.map((planet, index) => (
        <Planet key={index} config={planet} starColor={config.starColor} seed={config.seed + index * 3.7} />
      ))}
      <DustCloud seed={config.seed} color={config.starColor} />
    </group>
  )
}

export function DistantCelestials() {
  return (
    <group>
      {SYSTEMS.map((config, index) => <StellarSystem key={index} config={config} />)}
      {FAR_STARS.map((config, index) => <FarStar key={`far-star-${index}`} config={config} />)}
      <DeepField />
    </group>
  )
}
