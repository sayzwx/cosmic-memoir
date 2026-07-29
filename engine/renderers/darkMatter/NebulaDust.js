import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { getQualityBudget, MAX_ENVIRONMENT_BUDGET } from './qualityBudgets.js';
import { createRandom, disposeRenderable, setPosition } from './math.js';

const VERTEX = `
  attribute float aSeed;
  attribute float aDensity;
  uniform float uTime;
  uniform float uMotion;
  varying float vDensity;
  varying float vSeed;
  void main() {
    vec3 p = position;
    p.y += sin(aSeed * 41.0 + uTime * 0.07) * 4.0 * uMotion;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = min(18.0, (5.0 + aDensity * 11.0) * 480.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
    vDensity = aDensity; vSeed = aSeed;
  }
`;

const FRAGMENT = `
  varying float vDensity; varying float vSeed;
  void main() {
    vec2 q = gl_PointCoord - 0.5;
    float d = length(q * vec2(0.72, 1.0)) * 2.0;
    float alpha = (1.0 - smoothstep(0.18, 1.0, d)) * (0.025 + vDensity * 0.095);
    if (alpha < 0.012) discard;
    vec3 cool = vec3(0.16,0.25,0.46), warm = vec3(0.58,0.22,0.34);
    gl_FragColor = vec4(mix(cool, warm, smoothstep(0.52,0.9,vSeed)), alpha);
  }
`;

export function createNebulaDust(options = {}) {
  const capacity = Math.min(options.capacity || MAX_ENVIRONMENT_BUDGET.dust, MAX_ENVIRONMENT_BUDGET.dust);
  const random = createRandom(options.seed ?? 9091);
  const positions = new Float32Array(capacity * 3);
  const seeds = new Float32Array(capacity);
  const density = new Float32Array(capacity);
  const extent = options.extent || [920, 420, 500];
  for (let i = 0; i < capacity; i++) {
    const i3 = i * 3;
    const lane = random() * 2 - 1;
    positions[i3] = lane * extent[0];
    positions[i3 + 1] = Math.sin(lane * 5.4) * extent[1] * 0.34 + (random() * 2 - 1) * extent[1] * 0.28;
    positions[i3 + 2] = (random() * 2 - 1) * extent[2];
    seeds[i] = random();
    density[i] = Math.pow(random(), 1.8);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aDensity', new THREE.BufferAttribute(density, 1));
  const material = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uMotion: { value: 1 } },
    vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending });
  const object3D = new THREE.Points(geometry, material);
  setPosition(object3D, options.position, [0, 0, -520]);
  object3D.frustumCulled = false;
  const api = {
    object3D, capacity, drawCalls: 1,
    update(_delta, elapsed) { material.uniforms.uTime.value = elapsed; },
    setQuality(quality, mobile = false) {
      geometry.setDrawRange(0, Math.min(capacity, getQualityBudget(quality, mobile).dust));
    },
    setReducedMotion(value) { material.uniforms.uMotion.value = value ? 0 : 1; },
    dispose() { disposeRenderable(object3D); }
  };
  api.setQuality(options.quality, options.mobile);
  return api;
}
