import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const STAR_VERTEX = `
  attribute float aSeed;
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aLayer;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uMotion;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float wave = sin(uTime * (0.6 + aSeed * 1.8) + aSeed * 73.1);
    float twinkle = mix(1.0, 0.55 + 0.45 * wave * wave, uMotion);
    float layerScale = 0.7 + aLayer * 0.3;
    gl_PointSize = min(7.0, aSize * layerScale * twinkle * uPixelRatio * 500.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
    vColor = aColor * (0.8 + twinkle * 0.3);
    vAlpha = twinkle * (0.58 + aLayer * 0.18);
  }
`;

const STAR_FRAGMENT = `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float core = 1.0 - smoothstep(0.0, 0.25, r);
    float halo = 1.0 - smoothstep(0.12, 1.0, r);
    float alpha = (core + halo * 0.38) * vAlpha;
    if (alpha < 0.015) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

const DUST_VERTEX = `
  attribute float aSeed;
  attribute float aDensity;
  uniform float uTime;
  uniform float uMotion;
  varying float vDensity;
  varying float vSeed;
  void main() {
    vec3 p = position;
    p.y += sin(aSeed * 37.0 + uTime * 0.06) * 3.5 * uMotion;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = min(16.0, (4.5 + aDensity * 10.0) * 460.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
    vDensity = aDensity;
    vSeed = aSeed;
  }
`;

const DUST_FRAGMENT = `
  varying float vDensity;
  varying float vSeed;
  void main() {
    vec2 q = gl_PointCoord - 0.5;
    float d = length(q * vec2(0.7, 1.0)) * 2.0;
    float alpha = (1.0 - smoothstep(0.15, 1.0, d)) * (0.02 + vDensity * 0.09);
    if (alpha < 0.01) discard;
    vec3 cool = vec3(0.14, 0.22, 0.44);
    vec3 warm = vec3(0.52, 0.18, 0.30);
    gl_FragColor = vec4(mix(cool, warm, smoothstep(0.5, 0.9, vSeed)), alpha);
  }
`;

function seededRandom(seed) {
  return function () {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

export function createDeepSpaceBackground(options = {}) {
  const group = new THREE.Group();

  const starCount = options.starCount || 4000;
  const dustCount = options.dustCount || 1200;
  const starRadius = options.starRadius || 2800;
  const dustExtent = options.dustExtent || [1200, 500, 800];
  const dustPosition = options.dustPosition || [0, 0, -600];
  const seed = options.seed ?? 3721;
  const pixelRatio = options.pixelRatio || 1;

  const random = seededRandom(seed);

  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  const starSeeds = new Float32Array(starCount);
  const starLayers = new Float32Array(starCount);

  const palette = [
    [0.55, 0.7, 1.0],
    [1.0, 0.88, 0.68],
    [0.75, 0.84, 1.0],
    [1.0, 0.75, 0.5],
    [0.9, 0.9, 1.0]
  ];

  for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;
    const layer = Math.floor(random() * 3);
    const z = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const planar = Math.sqrt(1 - z * z);
    const distance = starRadius * (0.3 + layer * 0.25 + random() * 0.25);
    starPositions[i3] = Math.cos(angle) * planar * distance;
    starPositions[i3 + 1] = z * distance;
    starPositions[i3 + 2] = Math.sin(angle) * planar * distance;

    const colorIdx = random() < 0.12 ? 1 : (random() < 0.2 ? 3 : (random() < 0.3 ? 0 : (random() < 0.5 ? 4 : 2)));
    const color = palette[colorIdx];
    const energy = 0.6 + random() * 0.4;
    starColors[i3] = color[0] * energy;
    starColors[i3 + 1] = color[1] * energy;
    starColors[i3 + 2] = color[2] * energy;

    starLayers[i] = layer;
    starSeeds[i] = random();
    starSizes[i] = 1.2 + Math.pow(random(), 4) * 4.0;
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(starColors, 3));
  starGeo.setAttribute('aLayer', new THREE.BufferAttribute(starLayers, 1));
  starGeo.setAttribute('aSeed', new THREE.BufferAttribute(starSeeds, 1));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));

  const starMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uMotion: { value: 1 }
    },
    vertexShader: STAR_VERTEX,
    fragmentShader: STAR_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const starField = new THREE.Points(starGeo, starMat);
  starField.frustumCulled = false;
  group.add(starField);

  const dustPositions = new Float32Array(dustCount * 3);
  const dustSeeds = new Float32Array(dustCount);
  const dustDensity = new Float32Array(dustCount);
  const ext = dustExtent;
  const random2 = seededRandom(seed + 1000);

  for (let i = 0; i < dustCount; i++) {
    const i3 = i * 3;
    const lane = random2() * 2 - 1;
    dustPositions[i3] = lane * ext[0];
    dustPositions[i3 + 1] = Math.sin(lane * 5.0) * ext[1] * 0.3 + (random2() * 2 - 1) * ext[1] * 0.25;
    dustPositions[i3 + 2] = (random2() * 2 - 1) * ext[2];
    dustSeeds[i] = random2();
    dustDensity[i] = Math.pow(random2(), 1.6);
  }

  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dustSeeds, 1));
  dustGeo.setAttribute('aDensity', new THREE.BufferAttribute(dustDensity, 1));

  const dustMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMotion: { value: 1 }
    },
    vertexShader: DUST_VERTEX,
    fragmentShader: DUST_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const nebula = new THREE.Points(dustGeo, dustMat);
  nebula.position.set(dustPosition[0], dustPosition[1], dustPosition[2]);
  nebula.frustumCulled = false;
  group.add(nebula);

  const api = {
    object3D: group,
    update(delta, elapsed) {
      starMat.uniforms.uTime.value = elapsed;
      dustMat.uniforms.uTime.value = elapsed;
    },
    setPixelRatio(value) {
      starMat.uniforms.uPixelRatio.value = Math.min(value || 1, 2);
    },
    setReducedMotion(value) {
      const m = value ? 0 : 1;
      starMat.uniforms.uMotion.value = m;
      dustMat.uniforms.uMotion.value = m;
    },
    dispose() {
      starGeo.dispose();
      starMat.dispose();
      dustGeo.dispose();
      dustMat.dispose();
      group.remove(starField);
      group.remove(nebula);
    }
  };

  return api;
}
