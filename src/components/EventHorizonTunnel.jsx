import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { sharedState } from '../store/sharedState'

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uAspect;

  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  mat2 rotate2d(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, -s, s, c);
  }

  void main() {
    float reveal = smoothstep(0.43, 0.58, uProgress);
    float tunnel = smoothstep(0.52, 0.74, uProgress);
    vec2 p = vUv - 0.5;
    p.x *= uAspect;

    float rawRadius = length(p);
    float warpPulse = sin(rawRadius * 20.0 - uTime * 11.0) * 0.018 * tunnel;
    float lens = 1.0 + 0.2 * tunnel / (rawRadius * 5.0 + 0.75);
    p *= lens + warpPulse;
    p *= rotate2d(-uTime * (0.12 + tunnel * 0.72) - rawRadius * tunnel * 2.8);

    float radius = length(p);
    float angle = atan(p.y, p.x) + sin(radius * 9.0 - uTime * 3.2) * 0.16 * tunnel;
    vec3 color = vec3(0.002, 0.006, 0.018);

    // Expanding depth rings form a tube that visibly rushes past the viewer.
    for (int i = 0; i < 14; i++) {
      float fi = float(i);
      float depth = fract(fi / 14.0 + uTime * (0.42 + tunnel * 0.62));
      float ringRadius = mix(0.035, 1.18, depth * depth);
      float ringWidth = mix(0.012, 0.055, depth);
      float twist = angle * 3.0 - depth * 18.0 - uTime * (1.2 + tunnel * 3.8);
      float spiralWall = 0.24 + 0.76 * pow(0.5 + 0.5 * sin(twist), 4.0);
      float ring = exp(-abs(radius - ringRadius) / ringWidth) * spiralWall;
      float fade = smoothstep(0.0, 0.12, depth) * (1.0 - smoothstep(0.78, 1.0, depth));
      vec3 ringColor = mix(vec3(0.08, 0.42, 1.35), vec3(1.25, 0.3, 0.035), hash(vec2(fi, 4.7)));
      color += ringColor * ring * fade * (0.16 + tunnel * 0.34);
    }

    // Three continuous luminous helices define the rotating tunnel wall.
    float depthPhase = log(radius + 0.025) * 7.0 - uTime * (9.0 + tunnel * 15.0);
    float helixA = pow(max(0.0, 0.5 + 0.5 * cos(angle * 3.0 + depthPhase)), 18.0);
    float helixB = pow(max(0.0, 0.5 + 0.5 * cos(angle * 3.0 + depthPhase + 2.094)), 18.0);
    float helixC = pow(max(0.0, 0.5 + 0.5 * cos(angle * 3.0 + depthPhase + 4.188)), 18.0);
    float wallMask = smoothstep(0.05, 0.28, radius) * (1.0 - smoothstep(0.72, 1.12, radius));
    color += helixA * wallMask * vec3(0.08, 0.5, 1.55) * (0.5 + tunnel * 1.5);
    color += helixB * wallMask * vec3(1.3, 0.28, 0.025) * (0.35 + tunnel);
    color += helixC * wallMask * vec3(0.22, 0.68, 1.25) * (0.42 + tunnel * 1.2);

    // Radial star streaks accelerate past the viewer at different depths.
    // Polar cells keep the streaks stable while their tails stretch outward.
    float starAngle = (angle + 3.14159265) / 6.2831853;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float sectors = 38.0 + fi * 17.0;
      float sector = floor(starAngle * sectors);
      float angularOffset = abs(fract(starAngle * sectors) - 0.5);
      float speed = 0.7 + fi * 0.28;
      float radialCell = fract(radius * (7.0 + fi * 2.0) - uTime * speed);
      float seed = hash(vec2(sector, fi * 13.7));
      float streak = (1.0 - smoothstep(0.0, 0.07, angularOffset)) *
        smoothstep(0.0, 0.12, radialCell) * (1.0 - smoothstep(0.12, 0.72, radialCell));
      streak *= step(0.76, seed) * smoothstep(0.07, 0.28, radius) *
        (1.0 - smoothstep(0.82, 1.18, radius));
      vec3 streakColor = mix(vec3(0.15, 0.58, 1.4), vec3(1.35, 0.62, 0.16), step(0.91, seed));
      color += streakColor * streak * tunnel * (1.4 + fi * 0.45);
    }

    float vanishingPoint = exp(-radius * 24.0);
    color += vanishingPoint * vec3(0.5, 0.78, 1.4) * (0.8 + tunnel * 1.5);

    // Crossing the center blows the frame to white before navigation.
    float flash = smoothstep(0.84, 0.97, uProgress);
    color = mix(color, vec3(1.0, 0.985, 0.94), flash);
    color += vec3(1.0, 0.72, 0.42) * smoothstep(0.81, 0.93, uProgress) * (1.0 - flash) * 0.7;

    float alpha = max(reveal * mix(0.26, 0.96, tunnel), flash);
    gl_FragColor = vec4(color, alpha);
  }
`

export function EventHorizonTunnel() {
  const meshRef = useRef()
  const { size } = useThree()
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uAspect: { value: 1 }
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NormalBlending
  }), [])

  useFrame((state) => {
    if (!meshRef.current) return
    const progress = sharedState.isTransitioning ? sharedState.transitionProgress : 0
    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uProgress.value = progress
    material.uniforms.uAspect.value = size.width / Math.max(1, size.height)
    meshRef.current.visible = progress > 0.41
  })

  return (
    <mesh ref={meshRef} frustumCulled={false} renderOrder={1000} visible={false}>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}
