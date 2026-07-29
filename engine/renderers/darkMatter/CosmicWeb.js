import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { getQualityBudget, MAX_ENVIRONMENT_BUDGET } from './qualityBudgets.js';
import { createRandom, disposeRenderable, setPosition } from './math.js';

const VERTEX = `
  attribute float aPhase;
  varying float vPhase;
  void main() {
    vPhase = aPhase;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = `
  uniform float uReveal;
  uniform vec3 uColor;
  varying float vPhase;
  void main() {
    float visible = 1.0 - smoothstep(uReveal - 0.035, uReveal + 0.035, vPhase);
    if (visible < 0.01) discard;
    gl_FragColor = vec4(uColor, visible * 0.28);
  }
`;

export function createCosmicWeb(options = {}) {
  const capacity = Math.min(options.capacity || MAX_ENVIRONMENT_BUDGET.webSegments, MAX_ENVIRONMENT_BUDGET.webSegments);
  const random = createRandom(options.seed ?? 7717);
  const nodeCount = Math.ceil(capacity * 0.56) + 9;
  const nodes = new Float32Array(nodeCount * 3);
  const extent = options.extent || [980, 600, 700];
  for (let i = 0; i < nodeCount; i++) {
    const i3 = i * 3;
    nodes[i3] = (random() * 2 - 1) * extent[0];
    nodes[i3 + 1] = (random() * 2 - 1) * extent[1];
    nodes[i3 + 2] = (random() * 2 - 1) * extent[2];
  }
  const positions = new Float32Array(capacity * 6);
  const phases = new Float32Array(capacity * 2);
  for (let i = 0; i < capacity; i++) {
    const a = i % nodeCount;
    const b = (a + 1 + (i % 3) * 7) % nodeCount;
    const ai = a * 3, bi = b * 3, out = i * 6;
    positions[out] = nodes[ai]; positions[out + 1] = nodes[ai + 1]; positions[out + 2] = nodes[ai + 2];
    positions[out + 3] = nodes[bi]; positions[out + 4] = nodes[bi + 1]; positions[out + 5] = nodes[bi + 2];
    const phase = Math.min(0.995, Math.hypot(nodes[ai], nodes[ai + 1]) / Math.hypot(extent[0], extent[1]) + random() * 0.12);
    phases[i * 2] = phase; phases[i * 2 + 1] = phase;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  const material = new THREE.ShaderMaterial({ uniforms: {
    uReveal: { value: options.reveal ?? 0 }, uColor: { value: new THREE.Color(options.color || 0x4d73a2) }
  }, vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false,
  blending: THREE.AdditiveBlending });
  const object3D = new THREE.LineSegments(geometry, material);
  setPosition(object3D, options.position, [0, 0, -640]);
  object3D.frustumCulled = false;
  const api = {
    object3D, capacity, drawCalls: 1,
    update(delta) { object3D.rotation.y += delta * (options.rotationSpeed ?? 0.003); },
    setReveal(value) { material.uniforms.uReveal.value = THREE.MathUtils.clamp(value, 0, 1); },
    setQuality(quality, mobile = false) {
      geometry.setDrawRange(0, Math.min(capacity, getQualityBudget(quality, mobile).webSegments) * 2);
    },
    dispose() { disposeRenderable(object3D); }
  };
  api.setQuality(options.quality, options.mobile);
  return api;
}
