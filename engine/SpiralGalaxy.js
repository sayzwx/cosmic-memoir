import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { getQualityBudget, MAX_ENVIRONMENT_BUDGET } from './qualityBudgets.js';
import { createRandom, disposeRenderable, setPosition } from './math.js';

// ─── Vertex Shader ───────────────────────────────────────────────────────────
// Passes per-vertex color, kind, and size to fragment; computes point size from
// view-space depth for perspective-correct billboarding.
const VERTEX = `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aKind;
  uniform float uPassage;
  varying vec3 vColor;
  varying float vKind;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float dist = max(1.0, -mv.z);

    // Perspective point size: larger base * size attribute / distance
    gl_PointSize = min(32.0, aSize * (640.0 + uPassage * 150.0) / dist);

    gl_Position = projectionMatrix * mv;
    vColor = aColor;
    vKind  = aKind;
  }
`;

// ─── Fragment Shader ─────────────────────────────────────────────────────────
// Volumetric light particle: a sharp hot inner core + a soft outer glow halo.
// Kind = 1.0 → core/bar star (brighter, larger glow)
// Kind = 2.0 → HII region (softer, wider pink-purple glow)
// Kind = 0.0 → regular arm star
const FRAGMENT = `
  varying vec3 vColor;
  varying float vKind;
  uniform float uIntensity;
  uniform float uCoreIntensity;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d  = length(uv);

    // ── Particle type classification ─────────────────────────────────────────
    float isCore = step(0.5, vKind) * (1.0 - step(1.5, vKind));
    float isHII  = step(1.5, vKind);

    // ── Volumetric two-layer glow ────────────────────────────────────────────
    // Tight bright core (Gaussian)
    float coreSigma   = mix(120.0, 35.0, isHII);
    float coreBright  = exp(-d * d * coreSigma);

    // Soft outer halo (wider Gaussian)
    float haloSigma   = mix(14.0,  5.0, isHII);
    float halo        = exp(-d * d * haloSigma);

    // Extra diffuse bloom for HII regions
    float bloomSigma  = mix(0.0, 3.5, isHII);
    float bloom       = exp(-d * d * max(bloomSigma, 0.01));

    // ── Intensity boost ──────────────────────────────────────────────────────
    // Core/bar stars get a brightness multiplier; HII regions get moderate boost
    float boost = 0.78 + isCore * 0.62 + isHII * 0.32;

    // Combine layers into a single intensity (volumetric feel)
    float coreGain = mix(1.0, uCoreIntensity, isCore);
    float intensity = (coreBright * 0.58 + halo * 0.31 + bloom * 0.16) * boost * uIntensity * coreGain;

    // ── Hot-center color saturation ──────────────────────────────────────────
    // At the particle centre the colour saturates toward white, mimicking a
    // hot volumetric light source.
    vec3 hotColor = mix(vColor, vec3(1.0, 0.76, 0.32), coreBright * (0.18 + isCore * 0.16));

    // ── Alpha discard ────────────────────────────────────────────────────────
    if (intensity < 0.005) discard;

    gl_FragColor = vec4(hotColor, intensity);
  }
`;

// ─── Colour palette helpers ──────────────────────────────────────────────────
// The galaxy follows a radial gradient:
//   Core (0-20 %)   → warm gold (#ffd700 → #ff8c00)
//   Inner arms       → pink-purple (#d4a0ff)
//   Mid arms         → indigo (#6b5bff)
//   Outer arms       → gold-white (#ffe4b5)
const CLAMP = (v) => Math.min(1, Math.max(0, v));

function radialColor(t, rnd) {
  // t ∈ [0, 1] — normalised radial distance from galactic centre
  const v = (rnd - 0.5) * 0.07; // subtle per-particle variation

  if (t < 0.20) {
    // ── Core: warm gold → orange ─────────────────────────────────────────
    const u = t / 0.20;
    return [
      CLAMP(1.00 + v),
      CLAMP(0.84 - u * 0.29 + v),
      CLAMP(0.00 + u * 0.08 + v * 0.4),
    ];
  }

  if (t < 0.45) {
    // ── Inner arms: pink-purple (#d4a0ff) ────────────────────────────────
    const u = (t - 0.20) / 0.25;
    return [
      CLAMP(0.83 + u * 0.02 + v),
      CLAMP(0.63 - u * 0.08 + v),
      CLAMP(1.00 + u * 0.00 + v),
    ];
  }

  if (t < 0.72) {
    // ── Mid arms: indigo (#6b5bff) ───────────────────────────────────────
    const u = (t - 0.45) / 0.27;
    return [
      CLAMP(0.42 - u * 0.05 + v),
      CLAMP(0.36 - u * 0.02 + v),
      CLAMP(1.00 - u * 0.15 + v),
    ];
  }

  // ── Outer arms: gold-white (#ffe4b5) ───────────────────────────────────
  const u = (t - 0.72) / 0.28;
  return [
    CLAMP(0.37 + u * 0.63 + v),
    CLAMP(0.34 + u * 0.55 + v),
    CLAMP(0.85 + u * 0.10 + v),
  ];
}

// ─── Public API ──────────────────────────────────────────────────────────────
export function createSpiralGalaxy(options = {}) {
  const capacity = Math.min(
    options.capacity || MAX_ENVIRONMENT_BUDGET.galaxy,
    MAX_ENVIRONMENT_BUDGET.galaxy,
  );

  const random   = createRandom(options.seed ?? 41041);
  const radius   = options.radius || 280;
  const arms     = options.arms || 4;

  // ── Typed arrays ───────────────────────────────────────────────────────────
  const positions = new Float32Array(capacity * 3);
  const colors    = new Float32Array(capacity * 3);
  const sizes     = new Float32Array(capacity);
  const kinds     = new Float32Array(capacity);

  // Spiral winding tightness (higher = more tightly wound)
  const SPIRAL_FACTOR = 4.2;

  // ── Fill buffers ───────────────────────────────────────────────────────────
  for (let i = 0; i < capacity; i++) {
    const i3    = i * 3;
    const roll  = i % 28; // distribution modulus

    const isBar  = roll < 2;                       // ~7.1 % core/bar
    const isHII  = roll >= 2 && roll < 5;          // ~10.7 % HII knots
    // remainder (~82.2 %) are regular arm particles

    let x, y, z;
    let radial     = 0;
    let radialNorm = 0; // normalised [0, 1]

    if (isBar) {
      // ── Bar / core particles ──────────────────────────────────────────────
      const barHalfLen = radius * 0.32;
      const barHalfWid = radius * 0.04;
      x = (random() * 2 - 1) * barHalfLen;
      y = (random() * 2 - 1) * barHalfWid * (1 - Math.abs(x) / barHalfLen);
      radial     = Math.sqrt(x * x + y * y);
      radialNorm = Math.min(radial / radius, 1);
      z = (random() * 2 - 1) * radius * 0.025;
    } else {
      // ── Spiral arm particles (including HII) ──────────────────────────────
      // Radial distance: bias toward inner regions for denser core
      radial     = Math.pow(random(), 0.70) * radius;
      radialNorm = radial / radius;

      const armIndex  = i % arms;
      const baseAngle = (armIndex * Math.PI * 2) / arms;

      // Logarithmic spiral: angle increases with log(1 + radial)
      const spiralAngle = SPIRAL_FACTOR * Math.log(1 + radial / (radius * 0.08));

      // Scatter: increases with radius for natural arm spread
      const scatter =
        (random() * 2 - 1) * (0.02 + radialNorm * 0.09) * radius;

      const angle = baseAngle + spiralAngle;
      const ca    = Math.cos(angle);
      const sa    = Math.sin(angle);

      x = ca * radial - sa * scatter;
      y = sa * radial + ca * scatter;

      // Vertical thickness: thin disc with slight flare
      z = (random() * 2 - 1) * radius * (0.018 + radialNorm * 0.035);
    }

    positions[i3]     = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;

    // ── Colour ───────────────────────────────────────────────────────────────
    const rnd = random();
    if (isBar) {
      // Core/bar: intense warm gold
      const u = radialNorm / 0.2;
      colors[i3]     = CLAMP(1.00);
      colors[i3 + 1] = CLAMP(0.84 - Math.min(u, 1) * 0.29 + rnd * 0.04);
      colors[i3 + 2] = CLAMP(rnd * 0.10);
    } else if (isHII) {
      // HII regions: pink-purple knots
      colors[i3]     = CLAMP(0.82 + rnd * 0.12);
      colors[i3 + 1] = CLAMP(0.30 + rnd * 0.20);
      colors[i3 + 2] = CLAMP(0.70 + rnd * 0.28);
    } else {
      // Regular arm particle — radial gradient
      const c = radialColor(radialNorm, rnd);
      colors[i3]     = c[0];
      colors[i3 + 1] = c[1];
      colors[i3 + 2] = c[2];
    }

    // ── Size ─────────────────────────────────────────────────────────────────
    if (isBar) {
      sizes[i] = 4.5 + rnd * 5.0; // large core particles
    } else if (isHII) {
      sizes[i] = 8.0 + rnd * 6.0; // large HII knots
    } else {
      // Regular: smaller with slight radial increase
      const baseSize = 1.8 + radialNorm * 1.2;
      sizes[i] = baseSize + rnd * 2.2;
    }

    // ── Kind ─────────────────────────────────────────────────────────────────
    // 0 = regular arm, 1 = core/bar, 2 = HII region
    kinds[i] = isBar ? 1 : (isHII ? 2 : 0);
  }

  // ─── Build geometry ────────────────────────────────────────────────────────
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor',   new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aKind',    new THREE.BufferAttribute(kinds, 1));

  // ─── Material (custom shader with volumetric glow) ─────────────────────────
  const uniforms = {
    uIntensity: { value: options.intensity ?? 1 },
    uCoreIntensity: { value: options.coreIntensity ?? 1 },
    uPassage: { value: 0 }
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader:   VERTEX,
    fragmentShader: FRAGMENT,
    transparent:    true,
    depthWrite:     false,
    blending:       THREE.AdditiveBlending,
  });

  // ─── Points object ─────────────────────────────────────────────────────────
  const object3D = new THREE.Points(geometry, material);
  setPosition(object3D, options.position, [-240, 90, -420]);
  object3D.rotation.set(
    options.inclination ?? -0.92,
    options.yaw         ?? -0.18,
    options.roll        ?? -0.28,
  );

  // ─── Public API ────────────────────────────────────────────────────────────
  const rotationSpeed = options.rotationSpeed ?? 0.018;

  const api = {
    object3D,
    capacity,
    drawCalls: 1,

    /**
     * Advance the galaxy's slow majestic rotation.
     * @param {number} delta  Time step in seconds (capped upstream).
     */
    update(delta) {
      object3D.rotation.z += delta * rotationSpeed;
    },

    /**
     * Adjust draw range based on quality / mobile budget.
     */
    setQuality(quality, mobile = false) {
      const budget = getQualityBudget(quality, mobile);
      geometry.setDrawRange(0, Math.min(capacity, budget.galaxy));
    },

    setIntensity(intensity = 1, coreIntensity = intensity) {
      uniforms.uIntensity.value = Math.max(0, intensity);
      uniforms.uCoreIntensity.value = Math.max(0, coreIntensity);
    },

    setPassage(progress = 0) {
      uniforms.uPassage.value = Math.max(0, Math.min(1, progress));
    },

    /**
     * Free GPU resources.
     */
    dispose() {
      disposeRenderable(object3D);
    },
  };

  // Apply initial quality budget
  api.setQuality(options.quality, options.mobile);

  return api;
}
