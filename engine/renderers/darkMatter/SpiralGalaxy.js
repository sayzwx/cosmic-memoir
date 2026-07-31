import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { getQualityBudget, MAX_ENVIRONMENT_BUDGET } from './qualityBudgets.js';
import { createRandom, disposeRenderable, setPosition } from './math.js';

const VERTEX = `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aKind;
  varying vec3 vColor;
  varying float vKind;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = min(16.0, aSize * 520.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
    vColor = aColor;
    vKind = aKind;
  }
`;

const FRAGMENT = `
  varying vec3 vColor;
  varying float vKind;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float glow = (1.0 - smoothstep(0.0, 1.0, d)) * (1.0 - smoothstep(0.38, 1.0, d));
    float hii = step(1.5, vKind);
    glow *= mix(0.72, 1.0, hii);
    if (glow < 0.012) discard;
    gl_FragColor = vec4(vColor, glow);
  }
`;

export function createSpiralGalaxy(options = {}) {
  const capacity = Math.min(options.capacity || MAX_ENVIRONMENT_BUDGET.galaxy, MAX_ENVIRONMENT_BUDGET.galaxy);
  const random = createRandom(options.seed ?? 41041);
  const positions = new Float32Array(capacity * 3);
  const colors = new Float32Array(capacity * 3);
  const sizes = new Float32Array(capacity);
  const kinds = new Float32Array(capacity);
  const radius = options.radius || 280;
  const arms = options.arms || 4;
  for (let i = 0; i < capacity; i++) {
    const i3 = i * 3;
    const selector = i % 20;
    const isBar = selector < 4;
    const isHII = selector === 4;
    let x;
    let y;
    let radial = 0;
    if (isBar) {
      x = (random() * 2 - 1) * radius * 0.32;
      y = (random() * 2 - 1) * radius * 0.045 * (1 - Math.abs(x) / radius);
    } else {
      radial = Math.pow(random(), 0.72) * radius;
      const arm = i % arms;
      const angle = arm * Math.PI * 2 / arms + radial / radius * Math.PI * 3.9;
      const spread = (random() * 2 - 1) * (0.025 + radial / radius * 0.085) * radius;
      x = Math.cos(angle) * radial - Math.sin(angle) * spread;
      y = Math.sin(angle) * radial + Math.cos(angle) * spread;
    }
    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = (random() * 2 - 1) * (5 + radial * 0.025);
    const core = isBar || radial < radius * 0.16;
    colors[i3] = isHII ? 1.0 : (core ? 1.0 : 0.58 + random() * 0.18);
    colors[i3 + 1] = isHII ? 0.24 : (core ? 0.76 : 0.66 + random() * 0.2);
    colors[i3 + 2] = isHII ? 0.53 : (core ? 0.42 : 1.0);
    sizes[i] = isHII ? 7 + random() * 4 : 2.2 + random() * (core ? 4.5 : 2.8);
    kinds[i] = isHII ? 2 : (isBar ? 1 : 0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aKind', new THREE.BufferAttribute(kinds, 1));
  const material = new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const object3D = new THREE.Points(geometry, material);
  setPosition(object3D, options.position, [-240, 90, -420]);
  object3D.rotation.set(options.inclination ?? -0.92, options.yaw ?? -0.18, options.roll ?? -0.28);
  const api = {
    object3D, capacity, drawCalls: 1,
    update(delta) { object3D.rotation.z += delta * (options.rotationSpeed ?? 0.025); },
    setQuality(quality, mobile = false) {
      geometry.setDrawRange(0, Math.min(capacity, getQualityBudget(quality, mobile).galaxy));
    },
    dispose() { disposeRenderable(object3D); }
  };
  api.setQuality(options.quality, options.mobile);
  return api;
}
