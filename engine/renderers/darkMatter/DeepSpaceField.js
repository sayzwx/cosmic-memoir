import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { getQualityBudget, MAX_ENVIRONMENT_BUDGET } from './qualityBudgets.js';
import { createRandom, disposeRenderable } from './math.js';

const VERTEX = `
  attribute float aLayer;
  attribute float aSeed;
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uMotion;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float wave = sin(uTime * (0.7 + aSeed * 1.9) + aSeed * 91.7);
    float twinkle = mix(1.0, 0.58 + 0.42 * wave * wave, uMotion);
    float layerScale = 0.72 + aLayer * 0.28;
    gl_PointSize = min(8.0, aSize * layerScale * twinkle * uPixelRatio * 520.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
    vColor = aColor * (0.82 + twinkle * 0.34);
    vAlpha = twinkle * (0.62 + aLayer * 0.16);
  }
`;

const FRAGMENT = `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float core = 1.0 - smoothstep(0.0, 0.28, r);
    float halo = 1.0 - smoothstep(0.15, 1.0, r);
    float alpha = (core + halo * 0.42) * vAlpha;
    if (alpha < 0.015) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

export function createDeepSpaceField(options = {}) {
  const capacity = Math.min(options.capacity || MAX_ENVIRONMENT_BUDGET.stars, MAX_ENVIRONMENT_BUDGET.stars);
  const random = createRandom(options.seed ?? 1837);
  const positions = new Float32Array(capacity * 3);
  const colors = new Float32Array(capacity * 3);
  const layers = new Float32Array(capacity);
  const seeds = new Float32Array(capacity);
  const sizes = new Float32Array(capacity);
  const radius = options.radius || 1900;
  const palette = [[0.58, 0.72, 1.0], [1.0, 0.9, 0.72], [0.78, 0.86, 1.0]];
  for (let i = 0; i < capacity; i++) {
    const i3 = i * 3;
    const layer = i % 3;
    const z = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const planar = Math.sqrt(1 - z * z);
    const distance = radius * (0.48 + layer * 0.23 + random() * 0.2);
    positions[i3] = Math.cos(angle) * planar * distance;
    positions[i3 + 1] = z * distance;
    positions[i3 + 2] = Math.sin(angle) * planar * distance;
    const color = palette[random() < 0.16 ? 1 : (random() < 0.28 ? 0 : 2)];
    const energy = 0.62 + random() * 0.38;
    colors[i3] = color[0] * energy;
    colors[i3 + 1] = color[1] * energy;
    colors[i3 + 2] = color[2] * energy;
    layers[i] = layer;
    seeds[i] = random();
    sizes[i] = 1.4 + Math.pow(random(), 5) * 4.2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aLayer', new THREE.BufferAttribute(layers, 1));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: options.pixelRatio || 1 }, uMotion: { value: 1 } },
    vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending
  });
  const object3D = new THREE.Points(geometry, material);
  object3D.frustumCulled = false;
  const api = {
    object3D, capacity, drawCalls: 1,
    update(_delta, elapsed) { material.uniforms.uTime.value = elapsed; },
    setQuality(quality, mobile = false) {
      geometry.setDrawRange(0, Math.min(capacity, getQualityBudget(quality, mobile).stars));
    },
    setPixelRatio(value) { material.uniforms.uPixelRatio.value = Math.min(value || 1, 2); },
    setReducedMotion(value) { material.uniforms.uMotion.value = value ? 0 : 1; },
    dispose() { disposeRenderable(object3D); }
  };
  api.setQuality(options.quality, options.mobile);
  return api;
}
