import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { getQualityBudget, MAX_ENVIRONMENT_BUDGET } from './qualityBudgets.js';
import { createRandom, disposeRenderable, setPosition } from './math.js';

const VERTEX = `
  attribute float aSeed;
  attribute float aDensity;
  attribute float aWarmth;
  uniform float uTime;
  uniform float uMotion;
  uniform float uPixelRatio;
  varying float vDensity;
  varying float vWarmth;
  varying float vSeed;
  void main() {
    vec3 p = position;
    // Gentle floating: vertical sine + horizontal drift for cinematic feel
    float wave = sin(aSeed * 41.0 + uTime * 0.07);
    p.y += wave * 4.0 * uMotion;
    p.x += sin(aSeed * 73.0 + uTime * 0.03) * 2.0 * uMotion;
    p.z += cos(aSeed * 59.0 + uTime * 0.02) * 2.0 * uMotion;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float sizeBase = 3.0 + aDensity * 14.0;
    gl_PointSize = min(22.0, sizeBase * uPixelRatio * 480.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
    vDensity = aDensity;
    vWarmth = aWarmth;
    vSeed = aSeed;
  }
`;

const FRAGMENT = `
  varying float vDensity;
  varying float vWarmth;
  varying float vSeed;
  void main() {
    // Soft glow: bright core + diffuse halo
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv * vec2(0.72, 1.0)) * 2.0;
    float core = 1.0 - smoothstep(0.0, 0.30, r);
    float halo = 1.0 - smoothstep(0.10, 1.0, r);
    float alpha = (core * 0.80 + halo * 0.50) * (0.030 + vDensity * 0.12);
    if (alpha < 0.015) discard;

    // Palette: cool (dark purple / indigo)  <->  warm (gold-red)
    vec3 coolA = vec3(0.102, 0.063, 0.251);  // #1a1040  dark purple
    vec3 coolB = vec3(0.165, 0.125, 0.376);  // #2a2060  indigo
    vec3 warmA = vec3(0.416, 0.165, 0.125);  // #6a2a20  deep gold-red
    vec3 warmB = vec3(0.541, 0.227, 0.165);  // #8a3a2a  gold-red

    float coolBlend = smoothstep(0.0, 0.6, vSeed);
    vec3 cool = mix(coolA, coolB, coolBlend);
    vec3 warm = mix(warmA, warmB, coolBlend);
    vec3 color = mix(cool, warm, vWarmth);

    // Subtle per-particle shimmer
    color *= 0.85 + 0.30 * sin(vSeed * 127.0 + vDensity * 31.0);

    gl_FragColor = vec4(color, alpha);
  }
`;

/**
 * Create a nebula dust particle system with a cinematic glow effect.
 *
 * Accepted options:
 *   capacity  – maximum particle count (defaults to MAX_ENVIRONMENT_BUDGET.dust)
 *   seed      – RNG seed for reproducible layouts
 *   extent    – [width, height, depth] of the bounding volume
 *   position  – [x, y, z] world position (default [0, 0, -520])
 *   quality   – 'low' | 'medium' | 'high'
 *   mobile    – boolean, caps particle count further on mobile
 *   pixelRatio – device pixel ratio for crisp point sizes
 *
 * Returns { object3D, capacity, drawCalls, update, setQuality, setPixelRatio, setReducedMotion, dispose }
 */
export function createNebulaDust(options = {}) {
  const capacity = Math.min(
    options.capacity || MAX_ENVIRONMENT_BUDGET.dust,
    MAX_ENVIRONMENT_BUDGET.dust
  );
  const random = createRandom(options.seed ?? 9091);
  const positions = new Float32Array(capacity * 3);
  const seeds = new Float32Array(capacity);
  const density = new Float32Array(capacity);
  const warmth = new Float32Array(capacity);
  const extent = options.extent || [920, 420, 500];

  for (let i = 0; i < capacity; i++) {
    const i3 = i * 3;
    const lane = random() * 2 - 1;
    positions[i3] = lane * extent[0];
    positions[i3 + 1] = Math.sin(lane * 5.4) * extent[1] * 0.34
      + (random() * 2 - 1) * extent[1] * 0.28;
    positions[i3 + 2] = (random() * 2 - 1) * extent[2];
    seeds[i] = random();
    density[i] = Math.pow(random(), 1.8);
    warmth[i] = random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aDensity', new THREE.BufferAttribute(density, 1));
  geometry.setAttribute('aWarmth', new THREE.BufferAttribute(warmth, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMotion: { value: 1 },
      uPixelRatio: { value: options.pixelRatio || 1 }
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const object3D = new THREE.Points(geometry, material);
  setPosition(object3D, options.position, [0, 0, -520]);
  object3D.frustumCulled = false;

  const api = {
    object3D,
    capacity,
    drawCalls: 1,

    update(_delta, elapsed) {
      material.uniforms.uTime.value = elapsed;
    },

    setQuality(quality, mobile = false) {
      geometry.setDrawRange(
        0,
        Math.min(capacity, getQualityBudget(quality, mobile).dust)
      );
    },

    setPixelRatio(value) {
      material.uniforms.uPixelRatio.value = Math.min(value || 1, 2);
    },

    setReducedMotion(value) {
      material.uniforms.uMotion.value = value ? 0 : 1;
    },

    dispose() {
      disposeRenderable(object3D);
    }
  };

  api.setQuality(options.quality, options.mobile);
  return api;
}
