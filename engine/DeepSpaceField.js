import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { getQualityBudget, MAX_ENVIRONMENT_BUDGET } from './qualityBudgets.js';
import { createRandom, disposeRenderable } from './math.js';

// ─── Vertex Shader ───────────────────────────────────────────────────────────
// Layered parallax star field with seed-driven twinkle and color variation.
const VERTEX = `
  attribute float aLayer;
  attribute float aSeed;
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aColorShift;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uMotion;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vGlowWarmth;

  void main() {
    // ── Parallax rotation: each layer rotates at a different speed ──
    // Layer 0 (far)  → slow drift
    // Layer 1 (mid)  → moderate
    // Layer 2 (near) → faster, cinematic sweep
    float speed = 0.012 + aLayer * 0.044;
    float angle = uTime * speed;
    float ca = cos(angle);
    float sa = sin(angle);
    vec3 pos = vec3(
      position.x * ca - position.z * sa,
      position.y,
      position.x * sa + position.z * ca
    );

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);

    // ── Natural twinkle ──
    // Each star gets a unique frequency and phase from its seed
    float freq  = 0.4 + aSeed * 2.8;           // 0.4 – 3.2 range
    float phase = aSeed * 91.7 + aSeed * aSeed * 13.3;
    float raw   = sin(uTime * freq + phase);

    // Soft-square for smoother on/off ramp than raw sin
    float twinkleWave = raw * raw;
    // Add a secondary slower wave for amplitude modulation (flickering)
    float slowWave = sin(uTime * (0.12 + aSeed * 0.45) + aSeed * 37.1) * 0.5 + 0.5;
    float twinkle  = mix(1.0, 0.45 + 0.55 * twinkleWave * (0.7 + 0.3 * slowWave), uMotion);

    // ── Layer scaling ──
    // Layer 0: small, dim   →   Layer 2: large, bright
    float layerScale  = 0.55 + aLayer * 0.45;
    float layerBright = 0.65 + aLayer * 0.35;

    // ── Point size ──
    float size = aSize * layerScale * (0.75 + twinkle * 0.5);
    gl_PointSize = min(12.0, size * uPixelRatio * 520.0 / max(1.0, -mv.z));
    gl_Position   = projectionMatrix * mv;

    // ── Color ──
    // Boost colour during twinkle peak, add a subtle warmth shift on edges
    float colorBoost = 0.70 + twinkle * 0.55;
    vColor = aColor * colorBoost * layerBright;

    // Pass warmth hint for fragment (red shift in halo)
    vGlowWarmth = aColor.r * 0.6 + aColorShift * 0.4;

    // ── Alpha ──
    vAlpha = twinkle * (0.48 + aLayer * 0.22);
  }
`;

// ─── Fragment Shader ─────────────────────────────────────────────────────────
// Soft glowing circle with core + halo + outer aura, slight chromatic warmth.
const FRAGMENT = `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vGlowWarmth;

  void main() {
    vec2  uv = gl_PointCoord - 0.5;
    float r  = length(uv) * 2.0;

    // ── Three-zone glow ──
    // Core: tight bright centre
    float core = exp(-r * r * 12.0);
    // Halo: soft mid glow
    float halo = exp(-r * r *  3.5);
    // Aura: very wide, faint outer spread
    float aura = exp(-r * 2.2) * 0.35;

    // ── Chromatic edge shift ──
    // Warmer tint toward the edge for a cinematic lens effect
    float edgeFactor = 1.0 - core;
    vec3  chromatic  = vec3(0.12, 0.04, -0.02) * edgeFactor * vGlowWarmth;

    vec3 color = vColor + chromatic;
    float alpha = (core * 1.0 + halo * 0.55 + aura) * vAlpha;

    if (alpha < 0.003) discard;

    gl_FragColor = vec4(color, alpha);
  }
`;

// ─── Colour Palette ──────────────────────────────────────────────────────────
// 5 star spectral types in sRGB (linear-ish for shader multiplication).
const PALETTE = Object.freeze([
  // [r, g, b, warmthHint]
  [0.561, 0.773, 1.000, 0.0], // Blue-white   #8fc5ff
  [1.000, 0.863, 0.651, 1.0], // Warm gold    #ffdca6
  [0.859, 0.910, 1.000, 0.0], // Cool white   #dbe8ff
  [0.910, 0.604, 0.424, 0.8], // Red dwarf    #e89a6c
  [1.000, 0.722, 0.471, 0.9], // Orange giant #ffb878
]);

// Colour distribution weights (sum = 1.0)
const COLOR_WEIGHTS = [0.28, 0.18, 0.32, 0.10, 0.12];

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createDeepSpaceField(options = {}) {
  const capacity = Math.min(
    options.capacity || MAX_ENVIRONMENT_BUDGET.stars,
    MAX_ENVIRONMENT_BUDGET.stars
  );
  const random   = createRandom(options.seed ?? 1837);
  const radius   = options.radius || 2200;

  // ── Geometry buffers ──
  const positions   = new Float32Array(capacity * 3);
  const colors      = new Float32Array(capacity * 3);
  const layers      = new Float32Array(capacity);
  const seeds       = new Float32Array(capacity);
  const sizes       = new Float32Array(capacity);
  const colorShifts = new Float32Array(capacity); // warmth hint

  // Layer distribution: far=50%, mid=35%, near=15%
  const LAYER_RANGES = [
    { layer: 0, weight: 0.50, radiusScale: [0.90, 1.10], sizeBase: 0.8, sizePow: 5 },
    { layer: 1, weight: 0.35, radiusScale: [0.55, 0.85], sizeBase: 1.4, sizePow: 4 },
    { layer: 2, weight: 0.15, radiusScale: [0.30, 0.55], sizeBase: 2.2, sizePow: 3 },
  ];

  // Pre-compute cumulative colour weights for weighted random selection
  const cumColors = [];
  let cum = 0;
  for (let i = 0; i < COLOR_WEIGHTS.length; i++) {
    cum += COLOR_WEIGHTS[i];
    cumColors.push(cum);
  }

  let starIndex = 0;
  for (const range of LAYER_RANGES) {
    const count = Math.floor(capacity * range.weight);
    for (let i = 0; i < count && starIndex < capacity; i++, starIndex++) {
      const i3 = starIndex * 3;
      const layer = range.layer;

      // ── Spherical position ──
      const z      = random() * 2 - 1;
      const angle  = random() * Math.PI * 2;
      const planar = Math.sqrt(1 - z * z);
      const dist   = radius * (range.radiusScale[0] + random() * (range.radiusScale[1] - range.radiusScale[0]));

      positions[i3]     = Math.cos(angle) * planar * dist;
      positions[i3 + 1] = z * dist;
      positions[i3 + 2] = Math.sin(angle) * planar * dist;

      // ── Colour (weighted random from palette) ──
      const roll = random();
      let ci = 0;
      for (let c = 0; c < cumColors.length; c++) {
        if (roll < cumColors[c]) { ci = c; break; }
      }
      const pal = PALETTE[ci];
      // Add subtle per-star energy variation (±15%)
      const energy = 0.85 + random() * 0.30;
      colors[i3]     = pal[0] * energy;
      colors[i3 + 1] = pal[1] * energy;
      colors[i3 + 2] = pal[2] * energy;
      colorShifts[starIndex] = pal[3];

      // ── Layer ──
      layers[starIndex] = layer;

      // ── Seed (for twinkle / shader variation) ──
      seeds[starIndex] = 0.1 + random() * 0.9;

      // ── Size ──
      // Use power distribution so most stars are small, a few are large
      sizes[starIndex] = range.sizeBase + Math.pow(random(), range.sizePow) * 5.0;
    }
  }

  // Fill any remaining slots (safety net) with far-layer stars
  while (starIndex < capacity) {
    const i3 = starIndex * 3;
    const z      = random() * 2 - 1;
    const angle  = random() * Math.PI * 2;
    const planar = Math.sqrt(1 - z * z);
    const dist   = radius * (0.90 + random() * 0.20);
    positions[i3]     = Math.cos(angle) * planar * dist;
    positions[i3 + 1] = z * dist;
    positions[i3 + 2] = Math.sin(angle) * planar * dist;

    const roll = random();
    let ci = 0;
    for (let c = 0; c < cumColors.length; c++) {
      if (roll < cumColors[c]) { ci = c; break; }
    }
    const pal = PALETTE[ci];
    const energy = 0.85 + random() * 0.30;
    colors[i3]     = pal[0] * energy;
    colors[i3 + 1] = pal[1] * energy;
    colors[i3 + 2] = pal[2] * energy;

    layers[starIndex]      = 0;
    seeds[starIndex]       = 0.1 + random() * 0.9;
    sizes[starIndex]       = 0.8 + Math.pow(random(), 5) * 5.0;
    colorShifts[starIndex] = pal[3];
    starIndex++;
  }

  // ── Build geometry ──
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',    new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor',      new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aLayer',      new THREE.BufferAttribute(layers, 1));
  geometry.setAttribute('aSeed',       new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aSize',       new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aColorShift', new THREE.BufferAttribute(colorShifts, 1));

  // ── Material ──
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime:       { value: 0 },
      uPixelRatio: { value: options.pixelRatio || 1 },
      uMotion:     { value: 1 },
    },
    vertexShader:   VERTEX,
    fragmentShader: FRAGMENT,
    transparent:    true,
    depthWrite:     false,
    blending:       THREE.AdditiveBlending,
  });

  // ── Mesh ──
  const object3D = new THREE.Points(geometry, material);
  object3D.frustumCulled = false;

  // ── API ──
  const api = {
    object3D,
    capacity,
    drawCalls: 1,

    update(_delta, elapsed) {
      material.uniforms.uTime.value = elapsed;
    },

    setQuality(quality, mobile = false) {
      const budget = getQualityBudget(quality, mobile);
      geometry.setDrawRange(0, Math.min(capacity, budget.stars));
    },

    setPixelRatio(value) {
      material.uniforms.uPixelRatio.value = Math.min(value || 1, 2);
    },

    setReducedMotion(value) {
      material.uniforms.uMotion.value = value ? 0 : 1;
    },

    dispose() {
      disposeRenderable(object3D);
    },
  };

  // Apply initial quality
  api.setQuality(options.quality, options.mobile);

  return api;
}
