import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { getQualityBudget, MAX_ENVIRONMENT_BUDGET } from './qualityBudgets.js';
import { createRandom, disposeRenderable, setPosition } from './math.js';

const VERTEX = `
  attribute float aSeed;
  attribute float aPhase;
  attribute float aSize;
  attribute float aWarmth;

  uniform float uTime;

  varying float vPhase;
  varying float vSeed;
  varying float vWarmth;

  void main() {
    vPhase = aPhase;
    vSeed = aSeed;
    vWarmth = aWarmth;

    // A nearly imperceptible drift keeps the field alive without turning it noisy.
    float slowTime = uTime * 0.075 + aSeed * 19.0;
    vec3 drift = vec3(
      sin(slowTime),
      cos(slowTime * 0.83 + aSeed * 7.0),
      sin(slowTime * 1.17 + aSeed * 13.0)
    ) * (0.34 + aWarmth * 0.18);

    vec4 mvPosition = modelViewMatrix * vec4(position + drift, 1.0);
    float distanceScale = 180.0 / max(1.0, -mvPosition.z);
    gl_PointSize = clamp(aSize * distanceScale, 1.2, 8.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT = `
  uniform float uReveal;
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uBaseColor;

  varying float vPhase;
  varying float vSeed;
  varying float vWarmth;

  void main() {
    // Reveal travels through the individual particle phases rather than exposing
    // a literal line. A small soft edge prevents a mechanical threshold.
    float revealed = smoothstep(vPhase - 0.075, vPhase + 0.075, uReveal);
    if (revealed < 0.004) discard;

    vec2 point = gl_PointCoord - 0.5;
    float radiusSquared = dot(point, point) * 4.0;
    if (radiusSquared > 1.0) discard;

    float halo = exp(-radiusSquared * 3.4);
    float core = exp(-radiusSquared * 18.0);
    float pulse = 0.82 + 0.18 * sin(uTime * 0.32 + vSeed * 31.0);

    vec3 dimGold = uBaseColor * (0.48 + vWarmth * 0.16);
    vec3 paleGold = mix(uBaseColor, vec3(1.0, 0.82, 0.54), 0.28);
    vec3 color = mix(dimGold, paleGold, core * (0.34 + vWarmth * 0.26));

    // Keep the material below a conspicuous alpha even at full reveal.
    float alpha = revealed * uOpacity * pulse * (halo * 0.055 + core * 0.135);
    gl_FragColor = vec4(color, alpha);
  }
`;

const GOLDEN_BASE = new THREE.Color(0xb99a61);
const GOLDEN_PALE = new THREE.Color(0xe1c98f);

function clampCapacity(value) {
  const requested = Number.isFinite(value) ? Math.floor(value) : MAX_ENVIRONMENT_BUDGET.webSegments;
  return THREE.MathUtils.clamp(requested, 1, MAX_ENVIRONMENT_BUDGET.webSegments);
}

function sampleCurvePoint(points, t, target) {
  const segments = points.length - 1;
  const scaled = Math.min(segments - 0.0001, t * segments);
  const index = Math.floor(scaled);
  const localT = scaled - index;
  const p0 = points[Math.max(0, index - 1)];
  const p1 = points[index];
  const p2 = points[index + 1];
  const p3 = points[Math.min(points.length - 1, index + 2)];
  const t2 = localT * localT;
  const t3 = t2 * localT;

  target.set(
    0.5 * ((2.0 * p1.x) + (-p0.x + p2.x) * localT + (2.0 * p0.x - 5.0 * p1.x + 4.0 * p2.x - p3.x) * t2 + (-p0.x + 3.0 * p1.x - 3.0 * p2.x + p3.x) * t3),
    0.5 * ((2.0 * p1.y) + (-p0.y + p2.y) * localT + (2.0 * p0.y - 5.0 * p1.y + 4.0 * p2.y - p3.y) * t2 + (-p0.y + 3.0 * p1.y - 3.0 * p2.y + p3.y) * t3),
    0.5 * ((2.0 * p1.z) + (-p0.z + p2.z) * localT + (2.0 * p0.z - 5.0 * p1.z + 4.0 * p2.z - p3.z) * t2 + (-p0.z + 3.0 * p1.z - 3.0 * p2.z + p3.z) * t3)
  );
}

function createFilament(random, extent) {
  const points = [];
  const direction = new THREE.Vector3(random() * 2 - 1, (random() * 2 - 1) * 0.58, random() * 2 - 1).normalize();
  const origin = new THREE.Vector3(
    (random() * 2 - 1) * extent[0] * 0.36,
    (random() * 2 - 1) * extent[1] * 0.34,
    (random() * 2 - 1) * extent[2] * 0.36
  );
  const length = (0.92 + random() * 0.34) * Math.min(extent[0], extent[2]);
  const lateral = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0));
  if (lateral.lengthSq() < 0.01) lateral.crossVectors(direction, new THREE.Vector3(1, 0, 0));
  lateral.normalize();
  const vertical = new THREE.Vector3().crossVectors(direction, lateral).normalize();

  for (let i = 0; i < 5; i++) {
    const progress = i / 4 - 0.5;
    const bend = (random() * 2 - 1) * length * (0.09 + i * 0.012);
    const lift = (random() * 2 - 1) * extent[1] * 0.18;
    points.push(origin.clone()
      .addScaledVector(direction, progress * length)
      .addScaledVector(lateral, bend)
      .addScaledVector(vertical, lift));
  }
  return points;
}

export function createCosmicWeb(options = {}) {
  const capacity = clampCapacity(options.capacity);
  const random = createRandom(options.seed ?? 7717);
  const extent = options.extent || [980, 600, 700];
  const filamentCount = 5 + Math.floor(random() * 3);
  const filaments = Array.from({ length: filamentCount }, () => createFilament(random, extent));
  const positions = new Float32Array(capacity * 3);
  const seeds = new Float32Array(capacity);
  const phases = new Float32Array(capacity);
  const sizes = new Float32Array(capacity);
  const warmth = new Float32Array(capacity);
  const point = new THREE.Vector3();

  for (let i = 0; i < capacity; i++) {
    const filament = filaments[i % filamentCount];
    // A non-uniform sample makes small congregations, with enough scatter to
    // suggest a volume of matter rather than a rendered curve.
    const clusterT = (Math.floor(random() * 5) + random() * random()) / 5;
    sampleCurvePoint(filament, Math.min(0.999, clusterT), point);
    const spread = 4.0 + random() * 14.0;
    point.x += (random() - random()) * spread;
    point.y += (random() - random()) * spread * 0.68;
    point.z += (random() - random()) * spread;

    const offset = i * 3;
    positions[offset] = point.x;
    positions[offset + 1] = point.y;
    positions[offset + 2] = point.z;
    seeds[i] = random();
    phases[i] = THREE.MathUtils.clamp(0.025 + clusterT * 0.88 + (random() - 0.5) * 0.12, 0.01, 0.99);
    sizes[i] = 1.7 + random() * random() * 3.6;
    warmth[i] = random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aWarmth', new THREE.BufferAttribute(warmth, 1));
  geometry.setDrawRange(0, capacity);

  const baseColor = options.color
    ? new THREE.Color(options.color)
    : GOLDEN_BASE.clone().lerp(GOLDEN_PALE, random() * 0.28);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uReveal: { value: THREE.MathUtils.clamp(options.reveal ?? 0, 0, 1) },
      uTime: { value: 0 },
      uOpacity: { value: THREE.MathUtils.clamp(options.opacity ?? 0.82, 0, 1) },
      uBaseColor: { value: baseColor }
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const object3D = new THREE.Points(geometry, material);
  setPosition(object3D, options.position, [0, 0, -640]);
  object3D.frustumCulled = false;

  const api = {
    object3D,
    capacity,
    drawCalls: 1,

    update(delta = 0, elapsed) {
      object3D.rotation.y += delta * (options.rotationSpeed ?? 0.003);
      material.uniforms.uTime.value = Number.isFinite(elapsed)
        ? elapsed
        : material.uniforms.uTime.value + delta;
    },

    setReveal(value) {
      material.uniforms.uReveal.value = THREE.MathUtils.clamp(value, 0, 1);
    },

    setQuality(quality, mobile = false) {
      geometry.setDrawRange(0, Math.min(capacity, getQualityBudget(quality, mobile).webSegments));
    },

    dispose() {
      disposeRenderable(object3D);
    }
  };

  api.setQuality(options.quality, options.mobile);
  return api;
}
